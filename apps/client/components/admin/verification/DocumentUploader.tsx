"use client";

import { useState, useRef } from "react";
import {
  Upload,
  X,
  File,
  Loader2,
  CheckCircle,
  XCircle,
  Clock,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { uploadFiles } from "@/lib/services/upload";

interface Document {
  id: string;
  fileUrl: string;
  fileKey?: string | null;
  type: string;
  isVerified?: boolean;
  verificationStatus?: "pending" | "verified" | "rejected";
  verifiedAt?: Date | string | null;
  notes?: string | null;
  createdAt: Date | string;
}

interface DocumentUploaderProps {
  documents: Document[];
  documentType: string;
  documentTypeLabel: string;
  onUpload: (fileUrl: string, fileKey?: string) => Promise<void>;
  onReplace: (
    documentId: string,
    fileUrl: string,
    fileKey?: string
  ) => Promise<void>;
  onDelete: (documentId: string) => Promise<void>;
  allowedTypes?: string[];
  maxSizeMB?: number;
}

export function DocumentUploader({
  documents,
  documentTypeLabel,
  onUpload,
  onReplace,
  onDelete,
  allowedTypes = ["application/pdf", "image/jpeg", "image/png"],
  maxSizeMB = 10,
}: DocumentUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [replacingId, setReplacingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const file = files[0];
    if (!file) return;

    // Validate file type
    if (!allowedTypes.includes(file.type)) {
      toast.error(
        `Invalid file type. Allowed types: ${allowedTypes.join(", ")}`
      );
      return;
    }

    // Validate file size
    const maxSizeBytes = maxSizeMB * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      toast.error(`File size must be less than ${maxSizeMB}MB`);
      return;
    }

    setUploading(true);
    try {
      const result = await uploadFiles([file], "documents");
      const fileUrl = result.urls[0];

      if (!fileUrl) {
        throw new Error("No URL returned from upload");
      }

      await onUpload(fileUrl);
      toast.success(`${documentTypeLabel} uploaded successfully`);

      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to upload document"
      );
    } finally {
      setUploading(false);
    }
  };

  const handleReplace = async (documentId: string, files: FileList | null) => {
    if (!files || files.length === 0) return;

    const file = files[0];
    if (!file) return;

    // Validate file type
    if (!allowedTypes.includes(file.type)) {
      toast.error(
        `Invalid file type. Allowed types: ${allowedTypes.join(", ")}`
      );
      return;
    }

    // Validate file size
    const maxSizeBytes = maxSizeMB * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      toast.error(`File size must be less than ${maxSizeMB}MB`);
      return;
    }

    setReplacingId(documentId);
    try {
      const result = await uploadFiles([file], "documents");
      const fileUrl = result.urls[0];

      if (!fileUrl) {
        throw new Error("No URL returned from upload");
      }

      await onReplace(documentId, fileUrl);
      toast.success(`${documentTypeLabel} replaced successfully`);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to replace document"
      );
    } finally {
      setReplacingId(null);
    }
  };

  const handleDelete = async (documentId: string) => {
    if (
      !confirm(
        `Are you sure you want to delete this ${documentTypeLabel.toLowerCase()}?`
      )
    ) {
      return;
    }

    try {
      await onDelete(documentId);
      toast.success(`${documentTypeLabel} deleted successfully`);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to delete document"
      );
    }
  };

  const getStatusBadge = (doc: Document) => {
    if (doc.verificationStatus === "verified" || doc.isVerified) {
      return (
        <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">
          <CheckCircle className="mr-1 h-3 w-3" />
          Verified
        </Badge>
      );
    }
    if (doc.verificationStatus === "rejected") {
      return (
        <Badge className="bg-red-100 text-red-700 border-red-200">
          <XCircle className="mr-1 h-3 w-3" />
          Rejected
        </Badge>
      );
    }
    return (
      <Badge className="bg-amber-100 text-amber-700 border-amber-200">
        <Clock className="mr-1 h-3 w-3" />
        Pending
      </Badge>
    );
  };

  return (
    <div className="space-y-4">
      {/* Upload Button */}
      <div>
        <input
          ref={fileInputRef}
          type="file"
          accept={allowedTypes.join(",")}
          onChange={(e) => handleFileSelect(e.target.files)}
          className="hidden"
        />
        <Button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          variant="outline"
        >
          {uploading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Uploading...
            </>
          ) : (
            <>
              <Upload className="mr-2 h-4 w-4" />
              Upload {documentTypeLabel}
            </>
          )}
        </Button>
      </div>

      {/* Documents List */}
      {documents.length > 0 && (
        <div className="space-y-2">
          {documents.map((doc) => (
            <Card key={doc.id} className="border border-zinc-200">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 flex-1">
                    <File className="h-5 w-5 text-zinc-400" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-sm font-medium text-zinc-900 truncate">
                          {documentTypeLabel} - {doc.type.replace(/_/g, " ")}
                        </p>
                        {getStatusBadge(doc)}
                      </div>
                      {doc.notes && (
                        <p className="text-xs text-red-600 mt-1">{doc.notes}</p>
                      )}
                      <p className="text-xs text-zinc-500">
                        Uploaded {new Date(doc.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        const input = document.createElement("input");
                        input.type = "file";
                        input.accept = allowedTypes.join(",");
                        input.onchange = (e) => {
                          const files = (e.target as HTMLInputElement).files;
                          if (files) handleReplace(doc.id, files);
                        };
                        input.click();
                      }}
                      disabled={replacingId === doc.id}
                    >
                      {replacingId === doc.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Upload className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(doc.id)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" asChild>
                      <a
                        href={doc.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <File className="h-4 w-4" />
                      </a>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {documents.length === 0 && (
        <div className="text-center py-8 border-2 border-dashed border-zinc-200 rounded-lg">
          <File className="h-12 w-12 text-zinc-400 mx-auto mb-2" />
          <p className="text-sm text-zinc-500">
            No {documentTypeLabel.toLowerCase()}s uploaded yet
          </p>
        </div>
      )}
    </div>
  );
}
