import { describe, it, expect } from "vitest";
import { GET } from "@/app/api/healthz/route";

describe("GET /api/healthz", () => {
  it("returns 200 OK with status: ok", async () => {
    const response = await GET();
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.status).toBe("ok");
    expect(body.timestamp).toBeDefined();
    expect(response.headers.get("Cache-Control")).toContain("no-store");
  });
});
