import { beforeEach, describe, expect, it, vi } from "vitest";
import { userProfileComplianceService } from "@/app/lib/domains/user-profile/compliance";

const mockExportService = vi.hoisted(() => ({
  requestExport: vi.fn(),
  listUserExports: vi.fn(),
  getExportStatus: vi.fn(),
}));

const mockConsentService = vi.hoisted(() => ({
  updateConsent: vi.fn(),
  getUserConsents: vi.fn(),
}));

const mockAnonymizationService = vi.hoisted(() => ({
  deactivateUser: vi.fn(),
  getDeletionStatus: vi.fn(),
  reactivateUser: vi.fn(),
}));

vi.mock("@/app/lib/gdpr/services/export.service", () => ({
  ExportService: mockExportService,
}));

vi.mock("@/app/lib/gdpr/services/consent.service", () => ({
  ConsentService: mockConsentService,
}));

vi.mock("@/app/lib/gdpr/services/anonymization.service", () => ({
  AnonymizationService: mockAnonymizationService,
}));

describe("User-rights ownership and access policy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns not_found for foreign exportId access", async () => {
    mockExportService.getExportStatus.mockResolvedValue(null);

    const result = await userProfileComplianceService.getExportStatus({
      actor: { userId: "owner-1", correlationId: "corr-1" },
      exportId: "foreign-export-id",
    });

    expect(result).toMatchObject({
      ok: false,
      error: "not_found",
      status: 404,
    });
  });

  it("permits owner export status access", async () => {
    mockExportService.getExportStatus.mockResolvedValue({
      id: "exp-1",
      status: "READY",
      requestedAt: new Date("2026-04-13T08:00:00.000Z"),
      expiresAt: new Date("2026-04-14T08:00:00.000Z"),
      downloadedAt: null,
      fileUrl: "https://downloads.example.com/exp-1",
      fileSize: 1200,
    });

    const result = await userProfileComplianceService.getExportStatus({
      actor: { userId: "owner-1", correlationId: "corr-2" },
      exportId: "exp-1",
    });

    expect(result.ok).toBe(true);
  });

  it("routes list export lookup through actor user id", async () => {
    mockExportService.listUserExports.mockResolvedValue([]);

    const result = await userProfileComplianceService.getExportStatus({
      actor: { userId: "owner-2", correlationId: "corr-3" },
    });

    expect(result.ok).toBe(true);
    expect(mockExportService.listUserExports).toHaveBeenCalledWith("owner-2");
  });

  it("maps missing deletion status to not_found", async () => {
    mockAnonymizationService.getDeletionStatus.mockRejectedValue(
      new Error("User not found"),
    );

    const result = await userProfileComplianceService.getDeletionStatus({
      userId: "owner-missing",
      correlationId: "corr-4",
    });

    expect(result).toMatchObject({
      ok: false,
      error: "not_found",
      status: 404,
    });
  });
});
