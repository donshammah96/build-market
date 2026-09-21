import { describe, expect, it } from "vitest";
import {
  getBooleanEnv,
  getOptionalStringEnv,
  getStringEnv,
  isAbsoluteHttpUrl,
  resolveDevAuthBypass,
  toBool,
  validateEnvGroups,
  validateSatelliteInvariants,
  type EnvGroup,
} from "./index.js";

describe("env-validation", () => {
  describe("toBool", () => {
    it("parses booleans directly", () => {
      expect(toBool(true)).toBe(true);
      expect(toBool(false)).toBe(false);
    });

    it("parses string truthy values", () => {
      expect(toBool("true")).toBe(true);
      expect(toBool("TRUE")).toBe(true);
      expect(toBool("1")).toBe(true);
      expect(toBool("yes")).toBe(true);
      expect(toBool(" YES ")).toBe(true);
    });

    it("parses string falsy or non-boolean values", () => {
      expect(toBool("false")).toBe(false);
      expect(toBool("0")).toBe(false);
      expect(toBool("no")).toBe(false);
      expect(toBool(null)).toBe(false);
      expect(toBool(undefined)).toBe(false);
      expect(toBool(123)).toBe(false);
    });
  });

  describe("isAbsoluteHttpUrl", () => {
    it("validates absolute http and https URLs", () => {
      expect(isAbsoluteHttpUrl("https://buildmarket.app")).toBe(true);
      expect(isAbsoluteHttpUrl("http://localhost:3000")).toBe(true);
    });

    it("rejects non-absolute or non-http(s) URLs", () => {
      expect(isAbsoluteHttpUrl("/sign-in")).toBe(false);
      expect(isAbsoluteHttpUrl("ftp://buildmarket.app")).toBe(false);
      expect(isAbsoluteHttpUrl("buildmarket.app")).toBe(false);
      expect(isAbsoluteHttpUrl("")).toBe(false);
      expect(isAbsoluteHttpUrl(null)).toBe(false);
      expect(isAbsoluteHttpUrl(undefined)).toBe(false);
    });
  });

  describe("env retrieval helpers", () => {
    const mockEnv = {
      FOO: "bar",
      EMPTY: "",
      BOOL_TRUE: "true",
    };

    it("getStringEnv returns value or fallback", () => {
      expect(getStringEnv(mockEnv, "FOO")).toBe("bar");
      expect(getStringEnv(mockEnv, "MISSING", "default")).toBe("default");
    });

    it("getOptionalStringEnv returns value or undefined for empty/missing", () => {
      expect(getOptionalStringEnv(mockEnv, "FOO")).toBe("bar");
      expect(getOptionalStringEnv(mockEnv, "EMPTY")).toBeUndefined();
      expect(getOptionalStringEnv(mockEnv, "MISSING")).toBeUndefined();
    });

    it("getBooleanEnv returns parsed boolean or fallback", () => {
      expect(getBooleanEnv(mockEnv, "BOOL_TRUE")).toBe(true);
      expect(getBooleanEnv(mockEnv, "MISSING", true)).toBe(true);
      expect(getBooleanEnv(mockEnv, "MISSING", false)).toBe(false);
    });
  });

  describe("validateEnvGroups", () => {
    const sampleGroups: EnvGroup[] = [
      {
        name: "Core",
        description: "Core settings",
        variables: [
          { name: "APP_NAME", required: true },
          { name: "PORT", required: false, default: "3000" },
          {
            name: "API_URL",
            required: true,
            validate: isAbsoluteHttpUrl,
            errorMessage: "Must be absolute URL",
          },
        ],
      },
    ];

    it("returns valid when required variables are present and valid", () => {
      const result = validateEnvGroups(sampleGroups, {
        APP_NAME: "ClientApp",
        API_URL: "https://api.buildmarket.app",
      });
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toContain("[Core] Using default for PORT: 3000");
    });

    it("returns invalid when required variable is missing", () => {
      const result = validateEnvGroups(sampleGroups, {
        API_URL: "https://api.buildmarket.app",
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("[Core] Missing required: APP_NAME");
    });

    it("defers required server env during build phase", () => {
      const deferSet = new Set(["APP_NAME"]);
      const result = validateEnvGroups(
        sampleGroups,
        { API_URL: "https://api.buildmarket.app" },
        "all",
        deferSet,
        true,
      );
      expect(result.valid).toBe(true);
      expect(result.warnings).toContain(
        "[Core] Deferring required server env until runtime: APP_NAME",
      );
    });

    it("fails validation if validate function returns false", () => {
      const result = validateEnvGroups(sampleGroups, {
        APP_NAME: "ClientApp",
        API_URL: "invalid-url",
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        "[Core] Invalid API_URL: Must be absolute URL",
      );
    });
  });

  describe("validateSatelliteInvariants", () => {
    it("returns no issues when isSatellite is false", () => {
      const issues = validateSatelliteInvariants({
        isSatellite: false,
        appName: "apps/admin",
      });
      expect(issues).toHaveLength(0);
    });

    it("reports missing domain and primarySignInUrl when isSatellite is true", () => {
      const issues = validateSatelliteInvariants({
        isSatellite: true,
        appName: "apps/admin",
      });
      expect(issues).toHaveLength(2);
      expect(issues[0]).toContain("NEXT_PUBLIC_CLERK_DOMAIN is unset");
      expect(issues[1]).toContain(
        "NEXT_PUBLIC_CLERK_PRIMARY_SIGN_IN_URL is unset",
      );
    });

    it("reports non-absolute primarySignInUrl", () => {
      const issues = validateSatelliteInvariants({
        isSatellite: true,
        domain: "admin.buildmarket.app",
        primarySignInUrl: "/sign-in",
        appName: "apps/admin",
      });
      expect(issues).toHaveLength(1);
      expect(issues[0]).toContain("is not an absolute http(s) URL");
    });

    it("returns no issues when satellite configuration is valid", () => {
      const issues = validateSatelliteInvariants({
        isSatellite: true,
        domain: "admin.buildmarket.app",
        primarySignInUrl: "https://buildmarket.app/sign-in",
        appName: "apps/admin",
      });
      expect(issues).toHaveLength(0);
    });
  });

  describe("resolveDevAuthBypass", () => {
    it("resolves canonical AUTH_DEV_BYPASS", () => {
      const { bypassEnabled, warnings } = resolveDevAuthBypass(
        { AUTH_DEV_BYPASS: "true" },
        false,
        "apps/client",
      );
      expect(bypassEnabled).toBe(true);
      expect(warnings).toHaveLength(0);
    });

    it("supports legacy DEV_ADMIN_BYPASS with warning", () => {
      const { bypassEnabled, warnings } = resolveDevAuthBypass(
        { DEV_ADMIN_BYPASS: "true" },
        false,
        "apps/admin",
      );
      expect(bypassEnabled).toBe(true);
      expect(warnings).toContain(
        "[apps/admin] Legacy dev bypass env var used. Consider updating to canonical AUTH_DEV_BYPASS.",
      );
    });

    it("throws error if bypass is enabled in prod-like profile", () => {
      expect(() =>
        resolveDevAuthBypass({ AUTH_DEV_BYPASS: "true" }, true, "apps/admin"),
      ).toThrow(
        "[apps/admin] Dev auth bypass (AUTH_DEV_BYPASS / DEV_ADMIN_BYPASS / BYPASS_AUTH) is strictly prohibited in staging/production environments.",
      );
    });
  });
});
