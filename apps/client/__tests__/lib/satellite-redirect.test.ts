import { describe, expect, it, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { redirectToSignIn } from "@/app/lib/security/middleware/redirect-policy";
import { getSafeRedirectUrl } from "@/app/lib/security/redirect-url";
import { env } from "@/app/lib/infrastructure/env";

type Writable<T> = { -readonly [P in keyof T]: T[P] };

describe("Satellite Sign-In Redirect Policy & Allow-List", () => {
  const originalClerkEnv = { ...env.clerk };
  const originalAppUrl = env.appUrl;
  const originalClientAppUrl = env.clientAppUrl;

  afterEach(() => {
    // Restore env values
    Object.assign(env.clerk as Writable<typeof env.clerk>, originalClerkEnv);
    (env as Writable<typeof env>).appUrl = originalAppUrl;
    (env as Writable<typeof env>).clientAppUrl = originalClientAppUrl;
  });

  describe("redirectToSignIn satellite vs primary resolution", () => {
    it("redirects satellite request to primary sign-in URL with full absolute redirect_url", () => {
      // Simulate satellite configuration
      (env.clerk as Writable<typeof env.clerk>).isSatellite = true;
      (env.clerk as Writable<typeof env.clerk>).primarySignInUrl =
        "https://accounts.buildmarket.app/sign-in";

      const req = new NextRequest(
        "https://verification.buildmarket.app/verification/queue?role=reviewer",
      );
      const res = redirectToSignIn(req);

      expect(res.status).toBe(307);
      const location = new URL(res.headers.get("location")!);
      expect(location.origin).toBe("https://accounts.buildmarket.app");
      expect(location.pathname).toBe("/sign-in");
      expect(location.searchParams.get("redirect_url")).toBe(
        "https://verification.buildmarket.app/verification/queue?role=reviewer",
      );
    });

    it("redirects primary request to primary sign-in URL with relative redirect_url and search params preserved", () => {
      (env.clerk as Writable<typeof env.clerk>).isSatellite = false;
      (env as Writable<typeof env>).appUrl = "https://buildmarket.app";

      const req = new NextRequest(
        "https://buildmarket.app/professional-portal?expectedRole=professional",
      );
      const res = redirectToSignIn(
        req,
        "/professional-portal?expectedRole=professional",
      );

      expect(res.status).toBe(307);
      const location = new URL(res.headers.get("location")!);
      expect(location.origin).toBe("https://buildmarket.app");
      expect(location.pathname).toBe("/sign-in");
      expect(location.searchParams.get("redirect_url")).toBe(
        "/professional-portal?expectedRole=professional",
      );
    });

    it("triggers defensive loop breaker when already on primary sign-in page", () => {
      (env.clerk as Writable<typeof env.clerk>).isSatellite = false;
      (env as Writable<typeof env>).appUrl = "https://buildmarket.app";

      const req = new NextRequest("https://buildmarket.app/sign-in");
      const res = redirectToSignIn(req);

      // Should return NextResponse.next() (status 200, no location header) instead of redirecting
      expect(res.headers.get("location")).toBeNull();
    });

    it("throws descriptive error when satellite mode is active but primarySignInUrl is missing", () => {
      (env.clerk as Writable<typeof env.clerk>).isSatellite = true;
      (env.clerk as Writable<typeof env.clerk>).primarySignInUrl =
        undefined as unknown as string;

      const req = new NextRequest("https://verification.buildmarket.app/queue");
      expect(() => redirectToSignIn(req)).toThrowError(
        /configured as a Clerk satellite.*NEXT_PUBLIC_CLERK_PRIMARY_SIGN_IN_URL/,
      );
    });
  });

  describe("getSafeRedirectUrl with clientAppUrl fallback", () => {
    it("allows preview domain when matching env.clientAppUrl", () => {
      (env as Writable<typeof env>).clientAppUrl =
        "https://preview-client.vercel.app";

      const target = "https://preview-client.vercel.app/dashboard";
      expect(getSafeRedirectUrl(target)).toBe(target);
    });

    it("rejects untrusted domains even if structured similarly to clientAppUrl", () => {
      (env as Writable<typeof env>).clientAppUrl =
        "https://preview-client.vercel.app";

      expect(
        getSafeRedirectUrl("https://preview-client.vercel.app.evil.com/login"),
      ).toBeNull();
    });
  });
});
