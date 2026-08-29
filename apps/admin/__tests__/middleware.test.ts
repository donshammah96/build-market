import { describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const mockAuth = vi.fn();

vi.mock("@clerk/nextjs/server", () => ({
  clerkMiddleware:
    (handler: (auth: () => Promise<unknown>, req: NextRequest) => unknown) =>
    (req: NextRequest) =>
      handler(() => mockAuth(), req),
  createRouteMatcher: (patterns: string[]) => {
    return (req: NextRequest) => {
      const pathname = req.nextUrl.pathname;
      return patterns.some((pattern) => {
        if (pattern.includes("(.*)")) {
          const prefix = pattern.replace("(.*)", "");
          return pathname === prefix || pathname.startsWith(prefix);
        }
        return pathname === pattern;
      });
    };
  },
}));

// Mock database permissions and auth sync to prevent actual db/network calls
vi.mock("@/lib/security/repository", () => ({
  securityRepository: {
    findUserPermissions: vi.fn(),
    findUserForAdminActor: vi.fn(),
  },
}));

vi.mock("@/lib/auth-sync", () => ({
  syncUserRole: vi.fn().mockResolvedValue(undefined),
}));

const { mockEnv } = vi.hoisted(() => {
  return {
    mockEnv: {
      nodeEnv: "test",
      auth: { bypassEnabled: false },
      clerk: {
        isSatellite: false,
        primarySignInUrl: "",
        domain: "admin.buildmarket.app",
      },
    },
  };
});

vi.mock("@/lib/infrastructure/env", () => ({
  env: mockEnv,
  adminEnvConfig: mockEnv,
}));

import { env } from "@/lib/infrastructure/env";
import middleware from "../src/middleware";

describe("Admin Middleware - Authentication Redirect", () => {
  it("should wrap the redirect Response to ensure mutable headers", async () => {
    mockAuth.mockResolvedValue({
      userId: null,
      redirectToSignIn: vi.fn().mockImplementation(() => {
        // Return a response that mimics immutable headers (like a standard Response)
        const headers = new Headers();
        headers.set("Location", "https://accounts.buildmarket.app/sign-in");

        // Simulating the environment's immutable response behavior
        const response = new Response(null, {
          status: 307,
          headers,
        });

        // Object.defineProperty is used to lock headers to mimic Next.js Edge / standard Response immutability
        Object.defineProperty(response.headers, "set", {
          value: () => {
            throw new TypeError("immutable");
          },
          writable: false,
          configurable: false,
        });
        Object.defineProperty(response.headers, "append", {
          value: () => {
            throw new TypeError("immutable");
          },
          writable: false,
          configurable: false,
        });

        return response;
      }),
    });

    const request = new NextRequest("https://admin.buildmarket.app/", {
      headers: {
        host: "admin.buildmarket.app",
      },
    });

    // Execute the middleware directly
    const response = await middleware(request, {} as any);

    expect(response).toBeTruthy();
    if (!response) {
      throw new Error("Response is null or undefined");
    }

    expect(response).toBeInstanceOf(NextResponse);

    // Ensure we can mutate headers on the returned response
    expect(() => {
      response.headers.set("x-test-header", "value");
    }).not.toThrow();

    expect(response.headers.get("x-test-header")).toBe("value");
    expect(response.headers.get("Location")).toBe(
      "https://accounts.buildmarket.app/sign-in",
    );
  });

  it("should redirect directly to the primary sign-in URL in satellite mode", async () => {
    env.clerk.isSatellite = true;
    env.clerk.primarySignInUrl = "https://accounts.buildmarket.app/sign-in";

    try {
      mockAuth.mockResolvedValue({
        userId: null,
      });

      const request = new NextRequest(
        "https://admin.buildmarket.app/dashboard",
        {
          headers: {
            host: "admin.buildmarket.app",
          },
        },
      );

      const response = await middleware(request, {} as any);

      expect(response).toBeTruthy();
      expect(response).toBeInstanceOf(NextResponse);
      expect(response?.headers.get("Location")).toBe(
        "https://accounts.buildmarket.app/sign-in?redirect_url=https%3A%2F%2Fadmin.buildmarket.app%2Fdashboard",
      );
      expect(response?.status).toBe(307);
    } finally {
      env.clerk.isSatellite = false;
      env.clerk.primarySignInUrl = "";
    }
  });

  it("should return a 401 JSON response for unauthenticated requests to API routes", async () => {
    mockAuth.mockResolvedValue({
      userId: null,
    });

    const request = new NextRequest(
      "https://admin.buildmarket.app/api/some-route",
      {
        headers: {
          host: "admin.buildmarket.app",
        },
      },
    );

    const response = await middleware(request, {} as any);

    expect(response).toBeTruthy();
    expect(response).toBeInstanceOf(NextResponse);
    expect(response?.status).toBe(401);

    const body = await response!.json();
    expect(body).toEqual({ error: "Unauthorized" });
  });

  it("should return a 403 JSON response for blocked users requesting API routes", async () => {
    mockAuth.mockResolvedValue({
      userId: "user_123",
      sessionClaims: {
        metadata: {
          status: "SUSPENDED",
        },
      },
    });

    const request = new NextRequest(
      "https://admin.buildmarket.app/api/some-route",
      {
        headers: {
          host: "admin.buildmarket.app",
        },
      },
    );

    const response = await middleware(request, {} as any);

    expect(response).toBeTruthy();
    expect(response).toBeInstanceOf(NextResponse);
    expect(response?.status).toBe(403);

    const body = await response!.json();
    expect(body).toEqual({ error: "Forbidden", reason: "SUSPENDED" });
  });
});
