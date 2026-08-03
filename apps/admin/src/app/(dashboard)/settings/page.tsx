import SettingsClient from "./settings-client";
import { getSystemSettings } from "@/actions/admin";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  // Fetch real settings from the database via the refactored safeAction
  const response = await getSystemSettings();

  const settings = response?.success && response.data ? response.data : null;

  // If settings fetch failed or null, use defaults
  const initialSettings = settings ?? {
    maintenanceMode: false,
    publicSignup: true,
    enableAutoVerifyNCA: false,
    enableAutoVerifyEPRA: false,
    enableAutoVerifyBORAQS: false,
    enableAutoVerifyEBK: false,
    enableAutoVerifyEARB: false,
    enableAutoVerifyVRB: false,
    enableAutoVerifyISK: false,

    enforceProfessionalLicenses: false,
    enforcePropertyDocuments: false,
    enableLandRegistryCheck: false,
    enforceStorePermits: false,
    requireTaxCompliance: false,
    platformCommission: 10,
    supportEmail: "support@buildmarket.co.ke",
    adminEmailAlerts: true,
    securityMFA: true,
  };

  return <SettingsClient initialSettings={initialSettings} />;
}
