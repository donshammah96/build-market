import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET as previewHandler } from "@/app/api/uploads/staged/[id]/preview/route";
import { GET as downloadHandler } from "@/app/api/uploads/staged/[id]/download/route";
import { POST as scanHandler } from "@/app/api/uploads/staged/[id]/scan/route";
import { uploadRepository, uploadService } from "@/app/lib/domains/uploads";
import { getStorageProvider } from "@/app/lib/infrastructure/storage";

const mockFindStagedUploadById = vi.hoisted(() => vi.fn());
const mockRecordAuditLog = vi.hoisted(() =>
  vi.fn().mockResolvedValue(undefined),
);
const mockReadObject = vi.hoisted(() =>
  vi.fn().mockResolvedValue(Buffer.from("dummy pdf content")),
);
const mockGetPresignedDownloadUrl = vi.hoisted(() =>
  vi.fn().mockResolvedValue("https://storage.example.com/short-lived-token"),
);

vi.mock("@/app/lib/api/api-middleware", () => ({
  withAuth:
    (handler: (...args: unknown[]) => Promise<Response>) =>
    async (req: NextRequest, routeContext: any) => {
      const authHeader = req.headers.get("x-test-actor") ?? "owner";
      if (authHeader === "anonymous") {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
        });
      }

      const context =
        authHeader === "admin"
          ? { dbUserId: "usr_admin", clerkId: "clerk_admin", userRole: "ADMIN" }
          : authHeader === "other_user"
            ? {
                dbUserId: "usr_other",
                clerkId: "clerk_other",
                userRole: "USER",
              }
            : {
                dbUserId: "usr_owner",
                clerkId: "clerk_owner",
                userRole: "USER",
              };

      const params = routeContext?.params ?? routeContext;
      return handler(req, context, params);
    },
}));

vi.mock("@/app/lib/api/rate-limit", () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ success: true }),
  getRateLimitIdentifier: vi.fn().mockReturnValue("test_ip"),
  RateLimits: {
    READ: { limit: 60, window: 60000 },
    WRITE: { limit: 20, window: 60000 },
  },
}));

vi.mock("@/app/lib/domains/uploads/repository", () => ({
  assetDetailSelect: {},
  uploadRepository: {
    findStagedUploadById: mockFindStagedUploadById,
    updateStagedUploadStatus: vi.fn().mockResolvedValue({}),
    transitionStagedUploadStatus: vi
      .fn()
      .mockResolvedValue({ from: "SCAN_PENDING", to: "STAGED" }),
  },
}));

vi.mock("@/app/lib/infrastructure/storage", () => ({
  getStorageProvider: vi.fn().mockReturnValue({
    readObject: mockReadObject,
    getPresignedDownloadUrl: mockGetPresignedDownloadUrl,
  }),
}));

vi.mock("@/app/lib/audit/audit-logger", () => ({
  recordAuditLog: mockRecordAuditLog,
}));

describe("Staged Document Security & Authorization API Routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /api/uploads/staged/[id]/preview", () => {
    it("returns short-lived preview URL for document owner", async () => {
      mockFindStagedUploadById.mockResolvedValue({
        id: "stg_123",
        clerkId: "clerk_owner",
        originalName: "license.pdf",
        storageKey: "uploads/license.pdf",
        status: "STAGED",
      });

      const req = new NextRequest(
        "http://localhost:3000/api/uploads/staged/stg_123/preview",
        {
          headers: { "x-test-actor": "owner" },
        },
      );

      const res = await previewHandler(req, { params: { id: "stg_123" } });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.previewUrl).toContain("short-lived-token");
    });
  });

  describe("GET /api/uploads/staged/[id]/download", () => {
    it("allows document download for owner and emits audit log", async () => {
      mockFindStagedUploadById.mockResolvedValue({
        id: "stg_doc1",
        clerkId: "clerk_owner",
        originalName: "tax-cert.pdf",
        mimeType: "application/pdf",
        size: 4096,
        storageKey: "uploads/tax-cert.pdf",
        status: "STAGED",
      });

      const req = new NextRequest(
        "http://localhost:3000/api/uploads/staged/stg_doc1/download",
        {
          headers: { "x-test-actor": "owner" },
        },
      );

      const res = await downloadHandler(req, { params: { id: "stg_doc1" } });

      expect(res.status).toBe(200);
      expect(res.headers.get("Cache-Control")).toContain("no-store");
      expect(res.headers.get("Content-Disposition")).toContain("tax-cert.pdf");
      expect(mockRecordAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "DOCUMENT_DOWNLOADED",
          actorId: "usr_owner",
          resourceId: "stg_doc1",
        }),
      );
    });

    it("rejects unauthorized download request from non-owner user with 403 Forbidden", async () => {
      mockFindStagedUploadById.mockResolvedValue({
        id: "stg_doc1",
        clerkId: "clerk_owner",
        originalName: "tax-cert.pdf",
        mimeType: "application/pdf",
        size: 4096,
        storageKey: "uploads/tax-cert.pdf",
        status: "STAGED",
      });

      const req = new NextRequest(
        "http://localhost:3000/api/uploads/staged/stg_doc1/download",
        {
          headers: { "x-test-actor": "other_user" },
        },
      );

      const res = await downloadHandler(req, { params: { id: "stg_doc1" } });
      const json = await res.json();

      expect(res.status).toBe(403);
      expect(json.error).toContain("Unauthorized access");
    });

    it("allows document download for admin user and logs admin access", async () => {
      mockFindStagedUploadById.mockResolvedValue({
        id: "stg_doc1",
        clerkId: "clerk_owner",
        originalName: "tax-cert.pdf",
        mimeType: "application/pdf",
        size: 4096,
        storageKey: "uploads/tax-cert.pdf",
        status: "STAGED",
      });

      const req = new NextRequest(
        "http://localhost:3000/api/uploads/staged/stg_doc1/download",
        {
          headers: { "x-test-actor": "admin" },
        },
      );

      const res = await downloadHandler(req, { params: { id: "stg_doc1" } });

      expect(res.status).toBe(200);
      expect(mockRecordAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "DOCUMENT_DOWNLOADED",
          actorId: "usr_admin",
          actorRole: "ADMIN",
        }),
      );
    });

    it("rejects download requests for non-downloadable statuses (SCAN_PENDING, SCAN_FAILED, QUARANTINED) with 403 Forbidden", async () => {
      const blockedStatuses = ["SCAN_PENDING", "SCAN_FAILED", "QUARANTINED"];

      for (const status of blockedStatuses) {
        mockFindStagedUploadById.mockResolvedValueOnce({
          id: "stg_blocked",
          clerkId: "clerk_owner",
          originalName: "unverified.pdf",
          mimeType: "application/pdf",
          size: 1024,
          storageKey: "uploads/unverified.pdf",
          status,
        });

        const req = new NextRequest(
          "http://localhost:3000/api/uploads/staged/stg_blocked/download",
          {
            headers: { "x-test-actor": "owner" },
          },
        );

        const res = await downloadHandler(req, {
          params: { id: "stg_blocked" },
        });
        const json = await res.json();

        expect(res.status).toBe(403);
        expect(json.success).toBe(false);
        expect(json.error).toBeDefined();
      }
    });
  });

  describe("POST /api/uploads/staged/[id]/scan", () => {
    it("triggers scan and returns scan outcome", async () => {
      mockFindStagedUploadById.mockResolvedValue({
        id: "stg_scan_1",
        clerkId: "clerk_owner",
        originalName: "clean-contract.pdf",
        mimeType: "application/pdf",
        size: 2048,
        storageKey: "uploads/clean-contract.pdf",
        status: "SCAN_FAILED",
      });

      const req = new NextRequest(
        "http://localhost:3000/api/uploads/staged/stg_scan_1/scan",
        {
          method: "POST",
          headers: { "x-test-actor": "owner" },
        },
      );

      const res = await scanHandler(req, { params: { id: "stg_scan_1" } });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.status).toBe("STAGED");
      expect(json.data.scanResult.status).toBe("CLEAN");
    });
  });
});
