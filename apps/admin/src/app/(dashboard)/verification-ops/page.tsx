import { redirect } from "next/navigation";

/**
 * Legacy admin route placeholder.
 * Verification operations have migrated to the standalone `apps/verification-ops` workspace application.
 */
export default function VerificationOpsRedirect() {
  redirect("/verifications/regulator");
}
