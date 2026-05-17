import { redirect } from "next/navigation";
import {
  AdminFeatureFlag,
  isAdminFeatureEnabled,
} from "@/lib/config/feature-flags";

export default function VerificationsV2Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!isAdminFeatureEnabled(AdminFeatureFlag.ADMIN_V2_VERIFICATION_QUEUE)) {
    redirect("/verifications");
  }

  return children;
}

