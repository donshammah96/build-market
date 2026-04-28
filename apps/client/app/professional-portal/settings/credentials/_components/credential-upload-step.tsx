"use client";

import { useState, useRef } from "react";
import { Upload, Loader2, FileCheck, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { uploadForCredential } from "@/lib/upload-client";

interface CredentialUploadStepProps {
  onUploaded: (assetId: string, url: string) => void;
  onClear?: () => void;
  currentAssetId?: string | null;
  currentPreviewUrl?: string | null;
  label?: string;
  accept?: string;
}

export function CredentialUploadStep({
  onUploaded,
  onClear,
  currentAssetId,
  currentPreviewUrl,
  label = "Upload document",
  accept = "application/pdf,image/jpeg,image/png,image/webp",
}: CredentialUploadStepProps) {
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const { assetId, url } = await uploadForCredential(file, "documents");
      onUploaded(assetId, url);
      toast.success("File uploaded successfully");
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to upload file");
    } finally {
      setUploading(false);
    }
  };

  const hasFile = !!currentAssetId || !!currentPreviewUrl;

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-zinc-900">{label}</label>
      {!hasFile ? (
        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept={accept}
            onChange={handleFileSelect}
            disabled={uploading}
            className="hidden"
            id="credential-upload"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Upload className="mr-2 h-4 w-4" />
            )}
            {uploading ? "Uploading..." : "Choose file"}
          </Button>
          <span className="text-xs text-zinc-500">
            PDF, JPG, PNG (max 25MB)
          </span>
        </div>
      ) : (
        <div className="flex items-center justify-between rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2">
          <div className="flex items-center gap-2">
            <FileCheck className="h-4 w-4 text-emerald-600" />
            <span className="text-sm text-zinc-700">File uploaded</span>
            {currentPreviewUrl && (
              <a
                href={currentPreviewUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-blue-600 hover:underline"
              >
                Preview
              </a>
            )}
          </div>
          {onClear && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onClear}
              className="h-8 w-8 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
