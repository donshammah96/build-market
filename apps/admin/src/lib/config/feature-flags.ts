import { AdminRole } from "@build/enums";
import { adminEnvConfig } from "@/lib/infrastructure/env";

export const AdminFeatureFlag = {
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
