import { redirect } from "next/navigation";
import {
  AdminFeatureFlag,
  isAdminFeatureEnabled,
} from "@/lib/config/feature-flags";

export default function AnalyticsV2Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!isAdminFeatureEnabled(AdminFeatureFlag.ADMIN_V2_FINANCE_DASHBOARD)) {
    redirect("/analytics");
  }

  return children;
}
