import { describe, expect, it } from "vitest";

function isAllowedPendingRoute(pathname: string): boolean {
  const isPendingVerificationRoute =
    pathname === "/professional-portal/pending-verification";
  return (
    isPendingVerificationRoute ||
    pathname.startsWith("/professional-portal/profile") ||
    pathname.startsWith("/professional-portal/settings")
  );
}

describe("Pending verification middleware gating allowlist", () => {
  it("allows access to pending verification page", () => {
    expect(
      isAllowedPendingRoute("/professional-portal/pending-verification"),
    ).toBe(true);
  });

  it("allows access to profile viewing and editing", () => {
    expect(isAllowedPendingRoute("/professional-portal/profile")).toBe(true);
    expect(isAllowedPendingRoute("/professional-portal/profile/edit")).toBe(
      true,
    );
  });

  it("allows access to settings and profile completion", () => {
    expect(isAllowedPendingRoute("/professional-portal/settings")).toBe(true);
    expect(
      isAllowedPendingRoute("/professional-portal/settings/complete-profile"),
    ).toBe(true);
  });

  it("blocks access to marketplace and business operational routes", () => {
    expect(isAllowedPendingRoute("/professional-portal/dashboard")).toBe(false);
    expect(isAllowedPendingRoute("/professional-portal/leads")).toBe(false);
    expect(isAllowedPendingRoute("/professional-portal/projects")).toBe(false);
    expect(isAllowedPendingRoute("/professional-portal/messages")).toBe(false);
    expect(isAllowedPendingRoute("/professional-portal/finance")).toBe(false);
    expect(isAllowedPendingRoute("/professional-portal/stores")).toBe(false);
    expect(isAllowedPendingRoute("/professional-portal/calendar")).toBe(false);
    expect(isAllowedPendingRoute("/professional-portal/portfolio")).toBe(false);
  });
});
