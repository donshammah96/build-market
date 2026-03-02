import SettingsClient from "./settings-client";
import { getSystemSettings } from "@/actions/admin";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  // Fetch real settings from the database
  const settings = await getSystemSettings();

  // If settings fetch failed or null, use defaults
  const initialSettings = settings ?? {
    maintenanceMode: false,
    publicSignup: true,
    enableAutoVerifyNCA: false,
    platformCommission: 10,
    supportEmail: "support@buildmarket.co.ke",
    adminEmailAlerts: true,
    securityMFA: true
  };

  return <SettingsClient initialSettings={initialSettings} />;
}
