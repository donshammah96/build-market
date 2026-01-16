import { notFound } from "next/navigation";
import { getVerificationDetails } from "@/actions/admin";
import { VerificationDetailView } from "@/components/admin/verification/VerificationDetailView";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
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
      <div className="space-y-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {response.error || "Failed to load verification details"}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <VerificationDetailView
      entityType={entityType as EntityType}
      entityId={id}
      details={response.data}
    />
  );
}
