import { describe, expect, it } from "vitest";
import {
  ASSIGNABLE_USER_ROLES,
  getAssignableUserRolesPromptText,
  isAssignableUserRole,
} from "../user-roles";

describe("user-roles", () => {
  it("exposes the expected assignable roles", () => {
    expect(ASSIGNABLE_USER_ROLES).toEqual(["CLIENT", "PROFESSIONAL", "ADMIN"]);
  });

  it("validates assignable roles with uppercase normalization expectations", () => {
    expect(isAssignableUserRole("CLIENT")).toBe(true);
    expect(isAssignableUserRole("ADMIN")).toBe(true);
    expect(isAssignableUserRole("admin")).toBe(false);
    expect(isAssignableUserRole("UNKNOWN")).toBe(false);
  });

  it("builds prompt text from shared role source", () => {
    expect(getAssignableUserRolesPromptText()).toBe(
      "CLIENT | PROFESSIONAL | ADMIN",
    );
  });
});
