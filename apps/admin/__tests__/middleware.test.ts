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

import middleware from "../src/middleware";

describe("Admin Middleware - Authentication Redirect", () => {
  it("should wrap the redirect Response to ensure mutable headers", async () => {
    mockAuth.mockResolvedValue({
      userId: null,
      redirectToSignIn: vi.fn().mockImplementation(() => {
        // Return a response that mimics immutable headers (like a standard Response)
        const headers = new Headers();
        headers.set("Location", "https://buildmarket.app/sign-in");

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
      "https://buildmarket.app/sign-in",
    );
  });
});
