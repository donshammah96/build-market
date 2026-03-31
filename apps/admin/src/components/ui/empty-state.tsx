import * as React from "react";
import { AlertCircle, FileBox } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EmptyStateProps {
  title: string;
  description: string;
  icon?: React.ReactNode;
  action?: {
    label: string;
    onClick: () => void;
  };
  isError?: boolean;
}

export function EmptyState({
  title,
  description,
  icon,
  action,
  isError = false,
}: EmptyStateProps) {
  return (
    <div className="flex h-[50vh] flex-col items-center justify-center gap-2 rounded-lg border border-dashed p-8 text-center animate-in fade-in-50">
      <div
        className={`flex h-20 w-20 items-center justify-center rounded-full ${
          isError ? "bg-red-100 text-red-500" : "bg-zinc-100 text-zinc-500"
        }`}
      >
        {icon ||
          (isError ? (
            <AlertCircle className="h-10 w-10" />
          ) : (
            <FileBox className="h-10 w-10" />
          ))}
      </div>
      <h3 className="text-lg font-semibold text-zinc-900">{title}</h3>
      <p className="text-sm text-zinc-500 max-w-sm mx-auto">{description}</p>
      {action && (
        <Button
          variant={isError ? "outline" : "default"}
          className={`mt-4 ${!isError ? "bg-zinc-900 text-white hover:bg-zinc-800" : ""}`}
          onClick={action.onClick}
        >
          {action.label}
        </Button>
      )}
    </div>
  );
}
