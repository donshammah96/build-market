"use client";

import { Award, Loader2, Plus, Edit, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { VerificationBadge } from "@/components/ui/VerificationBadge";
import type { CertificateListItem } from "@/app/lib/domains/certificates/contracts";

export function CertificatesTab({
  certificates,
  isLoading,
  error,
  onAdd,
  onEdit,
  onDelete,
  onRetry,
}: {
  certificates: CertificateListItem[];
  isLoading: boolean;
  error: Error | null;
  onAdd: () => void;
  onEdit: (cert: CertificateListItem) => void;
  onDelete: (cert: CertificateListItem) => void;
  /** Route-aware refetch for error state. Prefer over full-page reload. */
  onRetry?: () => void;
}) {
  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Error loading certificates</AlertTitle>
        <AlertDescription className="flex flex-col gap-3">
          <span>
            {error instanceof Error
              ? error.message
              : "Failed to load certificates"}
          </span>
          {onRetry && (
            <Button
              variant="outline"
              size="sm"
              className="w-fit border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800"
              onClick={onRetry}
            >
              Try again
            </Button>
          )}
        </AlertDescription>
      </Alert>
    );
  }

  if (isLoading) {
    return (
      <div className="flex min-h-[200px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-zinc-500" />
      </div>
    );
  }

  return (
    <Card className="border border-zinc-200 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Certifications</CardTitle>
        <Button size="sm" onClick={onAdd}>
          <Plus className="mr-2 h-4 w-4" />
          Add Certificate
        </Button>
      </CardHeader>
      <CardContent>
        {certificates.length === 0 ? (
          <div className="py-12 text-center">
            <Award className="mx-auto mb-4 h-12 w-12 text-zinc-400" />
            <h3 className="mb-2 text-lg font-semibold text-zinc-900">
              No certificates yet
            </h3>
            <p className="mb-4 text-zinc-500">
              Add education certificates or awards and recognitions.
            </p>
            <Button size="sm" variant="outline" onClick={onAdd}>
              Add Certificate
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {certificates.map((cert) => (
              <div
                key={cert.id}
                className="flex items-center justify-between rounded-lg border border-zinc-200 p-4"
              >
                <div>
                  <p className="font-medium text-zinc-900">{cert.title}</p>
                  <p className="text-sm text-zinc-500">
                    {cert.category.replace(/_/g, " ")}
                    {cert.issuer ? ` · ${cert.issuer}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <VerificationBadge
                    status={
                      (cert.status as
                        | "VERIFIED"
                        | "PENDING"
                        | "REJECTED"
                        | "NEEDS_CORRECTION") ?? undefined
                    }
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => onEdit(cert)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-red-600 hover:text-red-700"
                    onClick={() => onDelete(cert)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
