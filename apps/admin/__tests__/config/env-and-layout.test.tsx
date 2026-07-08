// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import React from "react";
import { adminEnvSchema } from "@/lib/infrastructure/env";

vi.mock("@clerk/nextjs", () => ({
  ClerkProvider: ({ children }: any) => <>{children}</>,
}));

describe("env-and-layout", () => {
  describe("env schema validation", () => {
    it("should fail validation if NEXT_PUBLIC_CLERK_PRIMARY_SIGN_IN_URL is not an absolute URL", () => {
      const result = adminEnvSchema.safeParse({
        NEXT_PUBLIC_CLERK_PRIMARY_SIGN_IN_URL: "/relative-sign-in",
      });
      expect(result.success).toBe(false);
    });

    it("should succeed validation if NEXT_PUBLIC_CLERK_PRIMARY_SIGN_IN_URL is a valid absolute URL", () => {
      const result = adminEnvSchema.safeParse({
        NEXT_PUBLIC_CLERK_PRIMARY_SIGN_IN_URL:
          "https://buildmarket.app/sign-in",
      });
      expect(result.success).toBe(true);
    });
  });

  describe("layout fail-fast check", () => {
    it("should fail fast if NEXT_PUBLIC_CLERK_IS_SATELLITE is true but NEXT_PUBLIC_CLERK_PRIMARY_SIGN_IN_URL is missing", async () => {
      vi.doMock("@/lib/infrastructure/env", () => ({
        adminEnvConfig: {
          NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_test_placeholder",
          NEXT_PUBLIC_CLERK_IS_SATELLITE: true,
          NEXT_PUBLIC_CLERK_PRIMARY_SIGN_IN_URL: undefined,
        },
      }));

      const RootLayout = (await import("@/app/layout")).default;

      await expect(async () => {
        await RootLayout({ children: <div /> });
      }).rejects.toThrow(
        "NEXT_PUBLIC_CLERK_PRIMARY_SIGN_IN_URL is required when NEXT_PUBLIC_CLERK_IS_SATELLITE is true",
      );
    }, 60000);
  });
});
