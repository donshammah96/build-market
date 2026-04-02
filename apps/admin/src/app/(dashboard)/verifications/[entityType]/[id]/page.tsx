import { notFound } from "next/navigation";
import { getVerificationDetails } from "@/actions/admin";
import { getAdminPermissions } from "@/actions/admin/shared";
import { VerificationDetailView } from "@/components/admin/verification/VerificationDetailView";
import { ActionErrorState } from "@/components/ui/action-error-state";
import type { EntityType } from "@/actions/admin";

export const dynamic = "force-dynamic";

interface VerificationDetailPageProps {
  params: Promise<{
    entityType: string;
    id: string;
  }>;
}

export default async function VerificationDetailPage({
  params,
}: VerificationDetailPageProps) {
  const { entityType, id } = await params;

  // Validate entity type
  const validEntityTypes: EntityType[] = ["professional", "store", "property"];
  if (!validEntityTypes.includes(entityType as EntityType)) {
    notFound();
  }

  // Fetch verification details
  const response = await getVerificationDetails(entityType as EntityType, id);

  if (!response.success || !response.data) {
    return (
      <ActionErrorState
        title="Unable to load verification details"
        description={response.error || "Failed to load verification details"}
      />
    );
  }

  const { granularRole } = await getAdminPermissions();
  const canVerify = [
    "SUPER_ADMIN",
    "VERIFICATION_SPECIALIST",
  ].includes(granularRole || "");

  return (
    <VerificationDetailView
      entityType={entityType as EntityType}
      entityId={id}
      details={response.data}
      canVerify={canVerify}
    />
  );
}
