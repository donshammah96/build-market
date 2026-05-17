import { redirect } from "next/navigation";
import {
  AdminFeatureFlag,
  isAdminFeatureEnabled,
} from "@/lib/config/feature-flags";

export default function AuditV2Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!isAdminFeatureEnabled(AdminFeatureFlag.ADMIN_V2_AUDIT_LOG_UI)) {
    redirect("/audit");
  }

  return children;
}

