"use client";

import { useRouter } from "next/navigation";
import { EmptyState } from "@/components/ui/empty-state";

interface ActionErrorStateProps {
  title?: string;
  description: string;
}

export function ActionErrorState({
  title = "Unable to load data",
  description,
}: ActionErrorStateProps) {
  const router = useRouter();

  return (
    <div className="flex h-full items-center justify-center p-2">
      <EmptyState
        title={title}
        description={description}
        isError={true}
        action={{
          label: "Retry",
          onClick: () => router.refresh(),
        }}
      />
    </div>
  );
}
