import { describe, expect, it } from "vitest";
import { normalizeAdminAccessRole, parseSessionMetadata } from "../claims";

describe("security claims", () => {
  it("parses valid metadata fields", () => {
    const parsed = parseSessionMetadata({
      metadata: { role: "admin", isOnboarded: true },
    });

    expect(parsed).toEqual({ role: "admin", isOnboarded: true });
  });

  it("drops invalid metadata field types", () => {
    const parsed = parseSessionMetadata({
      metadata: { role: 1, isOnboarded: "yes" },
    });

    expect(parsed).toEqual({ role: undefined, isOnboarded: undefined });
  });

  it("returns undefined when session claims are missing metadata", () => {
    expect(parseSessionMetadata(undefined)).toBeUndefined();
    expect(parseSessionMetadata({})).toBeUndefined();
  });

  it("normalizes supported admin access roles and rejects unsupported roles", () => {
    expect(normalizeAdminAccessRole(" ADMIN ")).toBe("admin");
    expect(normalizeAdminAccessRole("Verification_Admin")).toBe(
      "verification_admin",
    );
    expect(normalizeAdminAccessRole("support")).toBeUndefined();
  });
});
