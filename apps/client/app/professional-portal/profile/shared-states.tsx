import type { ReactNode } from "react";
import { AlertCircle, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type LoadingStateProps = {
  variant?: "simple" | "detail";
  message?: string;
};

type ErrorStateProps = {
  title?: string;
  message: string;
  actionLabel: string;
  onAction: () => void;
  leading?: ReactNode;
};

export function ProfileLoadingState({
  variant = "simple",
  message = "Loading profile...",
}: LoadingStateProps) {
  return (
    <div className="space-y-6 max-w-400 mx-auto">
      {variant === "detail" ? (
        <div className="flex items-center gap-4">
          <div className="h-10 w-10 bg-zinc-200 animate-pulse rounded" />
          <div className="space-y-2">
            <div className="h-8 w-64 bg-zinc-200 animate-pulse rounded" />
            <div className="h-4 w-32 bg-zinc-200 animate-pulse rounded" />
          </div>
        </div>
      ) : null}
      <Card className="p-8">
        <div className="flex items-center justify-center min-h-100">
          <Loader2 className="h-8 w-8 animate-spin text-zinc-400" />
          {variant === "detail" ? (
            <span className="ml-3 text-zinc-500">{message}</span>
          ) : null}
        </div>
      </Card>
    </div>
  );
}

export function ProfileErrorState({
  title = "Profile Not Found",
  message,
  actionLabel,
  onAction,
  leading,
}: ErrorStateProps) {
  return (
    <div className="space-y-6 max-w-400 mx-auto">
      {leading}
      <Card className="p-8">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-zinc-900 mb-2">{title}</h2>
          <p className="text-zinc-500 mb-4">{message}</p>
          <Button onClick={onAction}>{actionLabel}</Button>
        </div>
      </Card>
    </div>
  );
}
