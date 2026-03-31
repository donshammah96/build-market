import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  corsHeaders,
  createCorsPreflightHandler,
  handleCorsPreFlight,
  isCorsOriginAllowed,
} from "@/app/lib/api/cors";

describe("CORS helper", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://app.buildmarket.test");
    vi.stubEnv("NEXT_PUBLIC_API_URL", "https://api.buildmarket.test");
    vi.stubEnv("CORS_ALLOWED_ORIGINS", "https://partner.example");
    vi.stubEnv("CORS_DEV_ALLOWED_ORIGINS", "http://localhost:5173");
  });

  it("allows credentialed CORS only for explicitly trusted origins", () => {
    const headers = corsHeaders("https://partner.example");

    expect(headers["Access-Control-Allow-Origin"]).toBe(
      "https://partner.example",
    );
    expect(headers["Access-Control-Allow-Credentials"]).toBe("true");
    expect(headers.Vary).toContain("Origin");
  });

  it("rejects disallowed preflight requests", () => {
    const response = handleCorsPreFlight("https://evil.example");

    expect(response.status).toBe(403);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });

  it("includes env-driven dev origins only in development", () => {
    expect(isCorsOriginAllowed("http://localhost:5173")).toBe(true);

    vi.stubEnv("NODE_ENV", "production");

    expect(isCorsOriginAllowed("http://localhost:5173")).toBe(false);
  });

  it("provides a shared OPTIONS handler wrapper", () => {
    const OPTIONS = createCorsPreflightHandler();
    const response = OPTIONS(
      new Request("https://api.buildmarket.test/resource", {
        method: "OPTIONS",
        headers: {
          origin: "https://partner.example",
        },
      }),
    );

    expect(response.status).toBe(204);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe(
      "https://partner.example",
    );
  });
});
