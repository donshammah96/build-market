import { redirect } from "next/navigation";
import {
  AdminFeatureFlag,
  isAdminFeatureEnabled,
} from "@/lib/config/feature-flags";

export default function UsersV2Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!isAdminFeatureEnabled(AdminFeatureFlag.ADMIN_V2_USER_MANAGEMENT)) {
    redirect("/users");
  }

  return children;
}
