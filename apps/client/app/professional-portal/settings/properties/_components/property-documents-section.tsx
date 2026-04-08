"use client";

import { Label } from "@/components/ui/label";
import { DocumentUploader } from "@/components/admin/verification/DocumentUploader";
import type { PropertyDocumentDto } from "@/lib/properties-client";

const DOC_TYPES = ["TITLE_DEED", "OFFICIAL_SEARCH", "MANDATE_LETTER"] as const;

export interface PropertyDocumentsSectionProps {
  documents: PropertyDocumentDto[];
  onUpload: (docType: string, assetId: string) => Promise<void>;
  onReplace: (
    documentId: string,
    assetId: string,
    docType: string,
  ) => Promise<void>;
  onDelete: (documentId: string) => Promise<void>;
}

export function PropertyDocumentsSection({
  documents,
  onUpload,
  onReplace,
  onDelete,
}: PropertyDocumentsSectionProps) {
  return (
    <div className="border-t border-zinc-200 pt-4">
      <div className="space-y-6">
        {DOC_TYPES.map((docType) => {
          const typeDocuments = documents.filter((a) => a.type === docType);
          return (
            <div key={docType} className="space-y-2">
              <Label className="text-sm font-semibold text-zinc-900">
                {docType.replace(/_/g, " ")}
              </Label>
              <DocumentUploader
                documents={typeDocuments}
                documentType={docType}
                documentTypeLabel={docType.replace(/_/g, " ")}
                onUpload={async (fileUrl) => {
                  await onUpload(docType, fileUrl);
                }}
                onReplace={async (documentId, fileUrl) => {
                  await onReplace(documentId, fileUrl, docType);
                }}
                onDelete={async (documentId) => {
                  await onDelete(documentId);
                }}
                allowedTypes={["application/pdf", "image/jpeg", "image/png"]}
                maxSizeMB={10}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
