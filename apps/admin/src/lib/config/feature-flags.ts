import { AdminRole } from "@build/db";
import { adminEnvConfig } from "@/lib/infrastructure/env";

export const AdminFeatureFlag = {
  ADMIN_V2_USER_MANAGEMENT: "admin_v2_user_management",
  ADMIN_V2_VERIFICATION_QUEUE: "admin_v2_verification_queue",
  ADMIN_V2_FINANCE_DASHBOARD: "admin_v2_finance_dashboard",
  ADMIN_V2_AUDIT_LOG_UI: "admin_v2_audit_log_ui",
  ADMIN_V2_STRUCTURED_LOGGING: "admin_v2_structured_logging",
} as const;

export type AdminFeatureFlag =
  (typeof AdminFeatureFlag)[keyof typeof AdminFeatureFlag];

const FLAG_ENV_KEYS = {
  [AdminFeatureFlag.ADMIN_V2_USER_MANAGEMENT]:
    "NEXT_PUBLIC_ADMIN_FF_V2_USER_MANAGEMENT",
  [AdminFeatureFlag.ADMIN_V2_VERIFICATION_QUEUE]:
    "NEXT_PUBLIC_ADMIN_FF_V2_VERIFICATION_QUEUE",
  [AdminFeatureFlag.ADMIN_V2_FINANCE_DASHBOARD]:
    "NEXT_PUBLIC_ADMIN_FF_V2_FINANCE_DASHBOARD",
  [AdminFeatureFlag.ADMIN_V2_AUDIT_LOG_UI]:
    "NEXT_PUBLIC_ADMIN_FF_V2_AUDIT_LOG_UI",
  [AdminFeatureFlag.ADMIN_V2_STRUCTURED_LOGGING]:
    "NEXT_PUBLIC_ADMIN_FF_V2_STRUCTURED_LOGGING",
} as const satisfies Record<AdminFeatureFlag, keyof typeof adminEnvConfig>;

export function isAdminFeatureEnabled(
  flag: AdminFeatureFlag,
  actor?: { adminRole: AdminRole },
): boolean {
  const envKey = FLAG_ENV_KEYS[flag];
  const enabled = adminEnvConfig[envKey] === true;

  if (!enabled) {
    return false;
  }

  if (
    adminEnvConfig.NODE_ENV !== "production" &&
    actor?.adminRole === AdminRole.SUPER_ADMIN
  ) {
    return true;
  }

  return enabled;
}

export function getAdminV2Route(
  flag: AdminFeatureFlag,
  currentRoute: string,
  v2Route: string,
): string {
  return isAdminFeatureEnabled(flag) ? v2Route : currentRoute;
}

