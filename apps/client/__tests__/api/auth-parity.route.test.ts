import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "@/app/api/health/auth-parity/route";

vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn().mockResolvedValue({ userId: "user_test_node_123" }),
}));

describe("GET /api/health/auth-parity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.INTERNAL_SERVICE_SECRET = "sec123";
    process.env.STAGING_AUTH_SECRET = "stag123";
    process.env.DD_ENV = "staging";
  });

  it("returns 403 if x-internal-secret is missing or invalid", async () => {
    const req = new NextRequest(
      "http://localhost:3500/api/health/auth-parity",
      {
        headers: {
          "x-internal-secret": "wrong",
        },
      },
    );
    const res = await GET(req);
    expect(res.status).toBe(403);
  });

  it("evaluates parity between Edge header and Node session", async () => {
    const req = new NextRequest(
      "http://localhost:3500/api/health/auth-parity",
      {
        headers: {
          "x-internal-secret": "sec123",
          "x-staging-secret": "stag123",
          "x-bm-edge-user": "user_test_node_123",
        },
      },
    );
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.edgeUserId).toBe("user_test_node_123");
    expect(body.nodeUserId).toBe("user_test_node_123");
    expect(body.parity).toBe(true);
  });

  it("detects disparity when Edge user does not match Node user", async () => {
    const req = new NextRequest(
      "http://localhost:3500/api/health/auth-parity",
      {
        headers: {
          "x-internal-secret": "sec123",
          "x-staging-secret": "stag123",
          "x-bm-edge-user": "user_different",
        },
      },
    );
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.edgeUserId).toBe("user_different");
    expect(body.nodeUserId).toBe("user_test_node_123");
    expect(body.parity).toBe(false);
  });
});
