import { describe, expect, it } from "vitest";
import { getSafeRedirectUrl } from "@/app/lib/security/redirect-url";

describe("getSafeRedirectUrl (client-safe module)", () => {
  it("allows safe internal relative paths", () => {
    expect(getSafeRedirectUrl("/homeowner-dashboard")).toBe(
      "/homeowner-dashboard",
    );
    expect(getSafeRedirectUrl("/profile/complete")).toBe("/profile/complete");
    expect(getSafeRedirectUrl("/professional-portal/dashboard")).toBe(
      "/professional-portal/dashboard",
    );
  });

  it("allows absolute URLs on buildmarket.app and satellite subdomains", () => {
    expect(getSafeRedirectUrl("https://verification.buildmarket.app/")).toBe(
      "https://verification.buildmarket.app/",
    );
    expect(getSafeRedirectUrl("https://admin.buildmarket.app/dashboard")).toBe(
      "https://admin.buildmarket.app/dashboard",
    );
    expect(getSafeRedirectUrl("https://buildmarket.app/sign-in")).toBe(
      "https://buildmarket.app/sign-in",
    );
  });

  it("allows local development loopback URLs", () => {
    expect(getSafeRedirectUrl("http://localhost:3000/")).toBe(
      "http://localhost:3000/",
    );
    expect(getSafeRedirectUrl("http://127.0.0.1:3005/dashboard")).toBe(
      "http://127.0.0.1:3005/dashboard",
    );
  });

  it("rejects empty, null, or undefined values", () => {
    expect(getSafeRedirectUrl(null)).toBeNull();
    expect(getSafeRedirectUrl(undefined)).toBeNull();
    expect(getSafeRedirectUrl("")).toBeNull();
    expect(getSafeRedirectUrl("   ")).toBeNull();
  });

  it("rejects protocol-relative open redirect attempts", () => {
    expect(getSafeRedirectUrl("//evil.com")).toBeNull();
    expect(
      getSafeRedirectUrl("//verification.buildmarket.app.evil.com"),
    ).toBeNull();
  });

  it("rejects backslash and colon open redirect bypass attempts", () => {
    expect(getSafeRedirectUrl("/\\evil.com")).toBeNull();
    expect(getSafeRedirectUrl("/:evil.com")).toBeNull();
  });

  it("rejects non-http/https protocols", () => {
    expect(getSafeRedirectUrl("javascript:alert(1)")).toBeNull();
    expect(getSafeRedirectUrl("data:text/html,hack")).toBeNull();
  });

  it("rejects untrusted third-party domains", () => {
    expect(getSafeRedirectUrl("https://evil.com")).toBeNull();
    expect(getSafeRedirectUrl("https://evilbuildmarket.app")).toBeNull();
    expect(
      getSafeRedirectUrl("https://phishing.com/verification.buildmarket.app"),
    ).toBeNull();
  });
});
