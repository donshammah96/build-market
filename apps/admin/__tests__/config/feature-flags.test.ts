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
      NEXT_PUBLIC_ADMIN_FF_V2_STRUCTURED_LOGGING:
        flags.NEXT_PUBLIC_ADMIN_FF_V2_STRUCTURED_LOGGING,
      NEXT_PUBLIC_ADMIN_FF_LICENSE_VERIFICATION_QUEUE:
        flags.NEXT_PUBLIC_ADMIN_FF_LICENSE_VERIFICATION_QUEUE,
    },
  }));

  return import("@/lib/config/feature-flags");
}

describe("admin feature flags", () => {
  it("keeps feature flags disabled by default", async () => {
    const { AdminFeatureFlag, isAdminFeatureEnabled } = await loadFeatureFlags(
      {},
    );

    expect(
      isAdminFeatureEnabled(AdminFeatureFlag.ADMIN_V2_STRUCTURED_LOGGING),
    ).toBe(false);
  });

  it("enables feature flag when the env flag is true", async () => {
    const { AdminFeatureFlag, isAdminFeatureEnabled } = await loadFeatureFlags({
      NEXT_PUBLIC_ADMIN_FF_V2_STRUCTURED_LOGGING: true,
    });

    expect(
      isAdminFeatureEnabled(AdminFeatureFlag.ADMIN_V2_STRUCTURED_LOGGING),
    ).toBe(true);
  });

  it("does not let SUPER_ADMIN bypass a disabled flag", async () => {
    const { AdminFeatureFlag, isAdminFeatureEnabled } = await loadFeatureFlags(
      {
        NEXT_PUBLIC_ADMIN_FF_V2_STRUCTURED_LOGGING: false,
      },
      "development",
    );

    expect(
      isAdminFeatureEnabled(AdminFeatureFlag.ADMIN_V2_STRUCTURED_LOGGING, {
        adminRole: AdminRole.SUPER_ADMIN,
      }),
    ).toBe(false);
  });
});
