import type { AdminRole } from "@build/enums";

// ============================================================================
// Actor
// ============================================================================

export type SettingsActor = {
  dbUserId: string;
  clerkId: string;
  adminRole: AdminRole;
};

// ============================================================================
// DTOs
// ============================================================================

export type SystemSettings = {
  maintenanceMode: boolean;
  publicSignup: boolean;
  enableAutoVerifyNCA: boolean;
  enableAutoVerifyEPRA: boolean;
  enableAutoVerifyBORAQS: boolean;
  enableAutoVerifyEBK: boolean;
  enableAutoVerifyEARB: boolean;
  enableAutoVerifyVRB: boolean;
  enableAutoVerifyISK: boolean;

  enforceProfessionalLicenses: boolean;
  enforcePropertyDocuments: boolean;
  enableLandRegistryCheck: boolean;
  enforceStorePermits: boolean;
  requireTaxCompliance: boolean;
  platformCommission: number;
  supportEmail: string;
  adminEmailAlerts: boolean;
  securityMFA: boolean;
};

export type UpdateSettingsInput = SystemSettings;

export type UpdateSettingsResult = {
  settings: SystemSettings;
  timestamp: string;
};

export type ClearCacheResult = {
  timestamp: string;
};

// ============================================================================
// Domain Errors
// ============================================================================

export type SettingsDomainError = {
  code:
    | "SETTINGS_POLICY_DENIED"
    | "SETTINGS_FETCH_FAILED"
    | "SETTINGS_UPDATE_FAILED"
    | "CACHE_CLEAR_FAILED";
  message: string;
};
