import { AdminRole } from "@build/enums";
import { adminEnvConfig } from "@/lib/infrastructure/env";

export const AdminFeatureFlag = {
  ADMIN_V2_USER_MANAGEMENT: "admin_v2_user_management",
  ADMIN_V2_VERIFICATION_QUEUE: "admin_v2_verification_queue",
  ADMIN_V2_FINANCE_DASHBOARD: "admin_v2_finance_dashboard",
  ADMIN_V2_AUDIT_LOG_UI: "admin_v2_audit_log_ui",
  ADMIN_V2_STRUCTURED_LOGGING: "admin_v2_structured_logging",
  ADMIN_FF_LICENSE_VERIFICATION_QUEUE: "admin_ff_license_verification_queue",
} as const;

export type AdminFeatureFlag =
  (typeof AdminFeatureFlag)[keyof typeof AdminFeatureFlag];

export interface FeatureFlagMetadata {
  owner: string;
  createdAt: string; // ISO date string (YYYY-MM-DD)
  targetRetirementDate: string; // ISO date string (YYYY-MM-DD)
  maxLifetimeDays: number;
  description: string;
}

export const FEATURE_FLAG_LIFECYCLE_METADATA: Record<
  AdminFeatureFlag,
  FeatureFlagMetadata
> = {
  [AdminFeatureFlag.ADMIN_V2_USER_MANAGEMENT]: {
    owner: "admin-platform-team",
    createdAt: "2026-05-18",
    targetRetirementDate: "2026-09-01",
    maxLifetimeDays: 120,
    description: "v2 user management shadow route",
  },
  [AdminFeatureFlag.ADMIN_V2_VERIFICATION_QUEUE]: {
    owner: "admin-platform-team",
    createdAt: "2026-05-18",
    targetRetirementDate: "2026-09-01",
    maxLifetimeDays: 120,
    description: "v2 verification queue shadow route",
  },
  [AdminFeatureFlag.ADMIN_V2_FINANCE_DASHBOARD]: {
    owner: "admin-platform-team",
    createdAt: "2026-05-18",
    targetRetirementDate: "2026-09-01",
    maxLifetimeDays: 120,
    description: "v2 finance dashboard shadow route",
  },
  [AdminFeatureFlag.ADMIN_V2_AUDIT_LOG_UI]: {
    owner: "admin-platform-team",
    createdAt: "2026-05-18",
    targetRetirementDate: "2026-09-01",
    maxLifetimeDays: 120,
    description: "v2 audit log UI shadow route",
  },
  [AdminFeatureFlag.ADMIN_V2_STRUCTURED_LOGGING]: {
    owner: "admin-platform-team",
    createdAt: "2026-05-18",
    targetRetirementDate: "2026-10-01",
    maxLifetimeDays: 150,
    description: "Structured telemetry and log formatting v2",
  },
  [AdminFeatureFlag.ADMIN_FF_LICENSE_VERIFICATION_QUEUE]: {
    owner: "admin-compliance-team",
    createdAt: "2026-07-21",
    targetRetirementDate: "2026-11-01",
    maxLifetimeDays: 120,
    description: "License verification workflow integration",
  },
};

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
  [AdminFeatureFlag.ADMIN_FF_LICENSE_VERIFICATION_QUEUE]:
    "NEXT_PUBLIC_ADMIN_FF_LICENSE_VERIFICATION_QUEUE",
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
