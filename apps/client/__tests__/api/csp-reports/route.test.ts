import { NextRequest } from "next/server";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST, GET } from "@/app/api/csp-reports/route";

vi.mock("@/app/lib/api/resilient-api", () => ({
  getClientLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

describe("POST /api/csp-reports", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 204 for valid legacy report-uri payload (tier 1)", async () => {
    const req = new NextRequest("http://localhost/api/csp-reports?tier=1", {
      method: "POST",
      headers: {
        "content-type": "application/csp-report",
      },
      body: JSON.stringify({
        "csp-report": {
          "document-uri": "http://localhost:3500/dashboard",
          "blocked-uri": "http://evil.com/script.js",
          "violated-directive": "script-src",
        },
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(204);
  });

  it("returns 204 for valid Reporting API payload (tier 2)", async () => {
    const req = new NextRequest("http://localhost/api/csp-reports?tier=2", {
      method: "POST",
      headers: {
        "content-type": "application/reports+json",
      },
      body: JSON.stringify([
        {
          type: "csp-violation",
          url: "http://localhost:3500/",
          body: {
            blockedURL: "http://evil.com/style.css",
            effectiveDirective: "style-src-elem",
          },
        },
      ]),
    });

    const res = await POST(req);
    expect(res.status).toBe(204);
  });

  it("rejects oversized request bodies with 413 Payload Too Large", async () => {
    const hugeString = "a".repeat(20 * 1024); // 20KB > 16KB limit
    const req = new NextRequest("http://localhost/api/csp-reports", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "content-length": String(hugeString.length),
      },
      body: JSON.stringify({ data: hugeString }),
    });

    const res = await POST(req);
    expect(res.status).toBe(413);
  });

  it("rejects non-POST HTTP methods with 405 Method Not Allowed", async () => {
    const res = await GET();
    expect(res.status).toBe(405);
    expect(res.headers.get("Allow")).toBe("POST");
  });
});
