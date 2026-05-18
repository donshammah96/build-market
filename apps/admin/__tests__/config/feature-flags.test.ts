import { describe, expect, it, vi } from "vitest";

const AdminRole = {
  SUPER_ADMIN: "SUPER_ADMIN",
  CONTENT_MODERATOR: "CONTENT_MODERATOR",
  SUPPORT_AGENT: "SUPPORT_AGENT",
  FINANCE_MANAGER: "FINANCE_MANAGER",
  AUDITOR: "AUDITOR",
} as const;

vi.mock("@build/db", () => ({
  AdminRole,
}));

async function loadFeatureFlags(
  flags: Record<string, boolean | string | undefined>,
  nodeEnv: "development" | "test" | "production" = "test",
) {
  vi.resetModules();
  vi.doMock("@/lib/infrastructure/env", () => ({
    adminEnvConfig: {
      NODE_ENV: nodeEnv,
      NEXT_PUBLIC_ADMIN_FF_V2_USER_MANAGEMENT:
        flags.NEXT_PUBLIC_ADMIN_FF_V2_USER_MANAGEMENT,
      NEXT_PUBLIC_ADMIN_FF_V2_VERIFICATION_QUEUE:
        flags.NEXT_PUBLIC_ADMIN_FF_V2_VERIFICATION_QUEUE,
      NEXT_PUBLIC_ADMIN_FF_V2_FINANCE_DASHBOARD:
        flags.NEXT_PUBLIC_ADMIN_FF_V2_FINANCE_DASHBOARD,
      NEXT_PUBLIC_ADMIN_FF_V2_AUDIT_LOG_UI:
        flags.NEXT_PUBLIC_ADMIN_FF_V2_AUDIT_LOG_UI,
      NEXT_PUBLIC_ADMIN_FF_V2_STRUCTURED_LOGGING:
        flags.NEXT_PUBLIC_ADMIN_FF_V2_STRUCTURED_LOGGING,
    },
  }));

  return import("@/lib/config/feature-flags");
}

describe("admin feature flags", () => {
  it("keeps v2 admin routes disabled by default", async () => {
    const { AdminFeatureFlag, isAdminFeatureEnabled, getAdminV2Route } =
      await loadFeatureFlags({});

    expect(
      isAdminFeatureEnabled(AdminFeatureFlag.ADMIN_V2_USER_MANAGEMENT),
    ).toBe(false);
    expect(
      getAdminV2Route(
        AdminFeatureFlag.ADMIN_V2_USER_MANAGEMENT,
        "/users",
        "/users-v2",
      ),
    ).toBe("/users");
  });

  it("enables route switching when the env flag is true", async () => {
    const { AdminFeatureFlag, isAdminFeatureEnabled, getAdminV2Route } =
      await loadFeatureFlags({
        NEXT_PUBLIC_ADMIN_FF_V2_USER_MANAGEMENT: true,
      });

    expect(
      isAdminFeatureEnabled(AdminFeatureFlag.ADMIN_V2_USER_MANAGEMENT),
    ).toBe(true);
    expect(
      getAdminV2Route(
        AdminFeatureFlag.ADMIN_V2_USER_MANAGEMENT,
        "/users",
        "/users-v2",
      ),
    ).toBe("/users-v2");
  });

  it("does not let SUPER_ADMIN bypass a disabled flag", async () => {
    const { AdminFeatureFlag, isAdminFeatureEnabled } = await loadFeatureFlags(
      {
        NEXT_PUBLIC_ADMIN_FF_V2_AUDIT_LOG_UI: false,
      },
      "development",
    );

    expect(
      isAdminFeatureEnabled(AdminFeatureFlag.ADMIN_V2_AUDIT_LOG_UI, {
        adminRole: AdminRole.SUPER_ADMIN,
      }),
    ).toBe(false);
  });
});
