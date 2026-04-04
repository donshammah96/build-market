import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockEnvConfig, getEnvConfigMock } = vi.hoisted(() => {
  const config = {
    appUrl: "https://app.buildmarket.test",
    apiUrl: "https://api.buildmarket.test",
    isDev: true,
    cors: {
      allowedOrigins: ["https://partner.example"],
      devAllowedOrigins: ["http://localhost:5173"],
    },
  };

  return {
    mockEnvConfig: config,
    getEnvConfigMock: vi.fn(() => config),
  };
});

vi.mock("@/app/lib/infrastructure/env", () => ({
  getEnvConfig: getEnvConfigMock,
}));

import {
  corsHeaders,
  createCorsPreflightHandler,
  handleCorsPreFlight,
  isCorsOriginAllowed,
} from "@/app/lib/api/cors";

describe("CORS helper", () => {
  beforeEach(() => {
    mockEnvConfig.appUrl = "https://app.buildmarket.test";
    mockEnvConfig.apiUrl = "https://api.buildmarket.test";
    mockEnvConfig.isDev = true;
    mockEnvConfig.cors.allowedOrigins = ["https://partner.example"];
    mockEnvConfig.cors.devAllowedOrigins = ["http://localhost:5173"];
    getEnvConfigMock.mockImplementation(() => mockEnvConfig);
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

    mockEnvConfig.isDev = false;

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
