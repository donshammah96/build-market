"use client";

import { useEffect } from "react";
import { EmptyState } from "@/components/ui/empty-state";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Optionally log the error to an error reporting service
    console.error(error);
  }, [error]);

  return (
    <div className="flex h-full items-center justify-center p-6">
      <EmptyState
        title="Something went wrong"
        description={
          error.message ||
          "An unexpected error occurred while loading this page."
        }
        isError={true}
        action={{
          label: "Try again",
          onClick: reset,
        }}
      />
    </div>
  );
}
