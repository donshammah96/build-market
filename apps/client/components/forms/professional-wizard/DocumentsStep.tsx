"use client";

import React, { useState, useCallback, useMemo, memo } from "react";
import { motion } from "framer-motion";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  FileText,
  Upload,
  X,
  ArrowRight,
  ArrowLeft,
  AlertCircle,
  ShieldCheck,
  IdCard,
  CheckCircle2,
  SkipForward,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { getRegulatoryAuthorityCode } from "@/lib/constants/professionOptions";
import { StepComponentProps, WIZARD_STYLES } from "./types";

// ============================================================================
// CONSTANTS
// ============================================================================

const FILE_CONFIG = {
  maxFiles: 5,
  maxSizeBytes: 10 * 1024 * 1024, // 10MB
  maxSizeMB: 10,
  allowedTypes: ["application/pdf", "image/jpeg", "image/jpg", "image/png"],
  allowedExtensions: [".pdf", ".jpg", ".jpeg", ".png"],
} as const;

// ============================================================================
// VALIDATION SCHEMA
// ============================================================================

const fileEntrySchema = z.object({
  file: z.instanceof(File),
});

const documentsSchema = z.object({
  certificates: z.array(fileEntrySchema).max(FILE_CONFIG.maxFiles).optional(),
  idDocuments: z.array(fileEntrySchema).max(FILE_CONFIG.maxFiles).optional(),
});

type FormData = z.infer<typeof documentsSchema>;

// ============================================================================
// FILE VALIDATION
// ============================================================================

const validateFile = (file: File): string | null => {
  if (file.size > FILE_CONFIG.maxSizeBytes) {
    const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
    return `"${file.name}" is ${sizeMB}MB — max ${FILE_CONFIG.maxSizeMB}MB allowed.`;
  }

  const isValidType = (FILE_CONFIG.allowedTypes as readonly string[]).includes(
    file.type,
  );
  const extension = "." + file.name.split(".").pop()?.toLowerCase();
  const isValidExtension = (
    FILE_CONFIG.allowedExtensions as readonly string[]
  ).includes(extension);

  if (!isValidType && !isValidExtension) {
    return `"${file.name}" is not a valid file type. Only PDF, JPG, and PNG are allowed.`;
  }

  return null;
};

// ============================================================================
// FILE LIST ITEM COMPONENT
// ============================================================================

interface FileListItemProps {
  file: File;
  onRemove: () => void;
}

const FileListItem = memo<FileListItemProps>(function FileListItem({
  file,
  onRemove,
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 10 }}
      className="flex items-center justify-between bg-white/5 px-4 py-3 rounded-lg border border-white/10"
    >
      <div className="flex items-center gap-3">
        <div className="p-2 bg-emerald-500/20 rounded-lg">
          <FileText className="h-4 w-4 text-emerald-400" />
        </div>
        <div>
          <p className="text-sm text-white truncate max-w-[200px]">
            {file.name}
          </p>
          <p className="text-xs text-zinc-500">
            {(file.size / 1024).toFixed(0)} KB
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={onRemove}
        className="p-1.5 text-zinc-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
        aria-label={`Remove ${file.name}`}
      >
        <X className="h-4 w-4" />
      </button>
    </motion.div>
  );
});

// ============================================================================
// FILE UPLOAD SECTION COMPONENT
// ============================================================================

interface FileUploadSectionProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  files: Array<{ file: File }>;
  onFilesAdd: (files: File[]) => void;
  onFileRemove: (index: number) => void;
  error?: string;
  maxFiles?: number;
}

const FileUploadSection: React.FC<FileUploadSectionProps> = ({
  title,
  description,
  icon,
  files,
  onFilesAdd,
  onFileRemove,
  error,
  maxFiles = FILE_CONFIG.maxFiles,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFiles = Array.from(e.dataTransfer.files);
    processFiles(droppedFiles);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files ? Array.from(e.target.files) : [];
    processFiles(selectedFiles);
    e.target.value = ""; // Reset input
  };

  const processFiles = (newFiles: File[]) => {
    setValidationError(null);
    const canAdd = maxFiles - files.length;

    if (canAdd <= 0) {
      setValidationError(`Maximum ${maxFiles} files allowed.`);
      return;
    }

    const filesToAdd: File[] = [];
    for (const file of newFiles.slice(0, canAdd)) {
      const error = validateFile(file);
      if (error) {
        setValidationError(error);
      } else {
        filesToAdd.push(file);
      }
    }

    if (filesToAdd.length > 0) {
      onFilesAdd(filesToAdd);
    }
  };

  const displayError = error || validationError;

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-400">
          {icon}
        </div>
        <div>
          <h3 className="font-medium text-white">{title}</h3>
          <p className="text-sm text-zinc-400">{description}</p>
        </div>
      </div>

      {/* Drop Zone */}
      <div
        className={cn(
          "border-2 border-dashed rounded-xl p-6 transition-all cursor-pointer",
          isDragging
            ? "border-emerald-500 bg-emerald-500/10"
            : "border-zinc-700 hover:border-zinc-600 bg-white/5",
          files.length >= maxFiles && "opacity-50 cursor-not-allowed",
        )}
        onDragOver={files.length < maxFiles ? handleDragOver : undefined}
        onDragLeave={handleDragLeave}
        onDrop={files.length < maxFiles ? handleDrop : undefined}
      >
        <label className="flex flex-col items-center cursor-pointer">
          <input
            type="file"
            accept={FILE_CONFIG.allowedExtensions.join(",")}
            multiple
            onChange={handleFileSelect}
            disabled={files.length >= maxFiles}
            className="hidden"
          />
          <Upload
            className={cn(
              "h-8 w-8 mb-3 transition-colors",
              isDragging ? "text-emerald-400" : "text-zinc-500",
            )}
          />
          <p className="text-sm text-zinc-400 text-center">
            {isDragging
              ? "Drop files here..."
              : "Drag & drop files or click to browse"}
          </p>
          <p className="text-xs text-zinc-600 mt-1">
            PDF, JPG, PNG • Max {FILE_CONFIG.maxSizeMB}MB per file
          </p>
        </label>
      </div>

      {/* Error */}
      {displayError && (
        <p className={WIZARD_STYLES.error}>
          <AlertCircle className="h-3 w-3" />
          {displayError}
        </p>
      )}

      {/* File List */}
      {files.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-zinc-500">
            {files.length} of {maxFiles} files
          </p>
          {files.map((entry, index) => (
            <FileListItem
              key={`${entry.file.name}-${index}`}
              file={entry.file}
              onRemove={() => onFileRemove(index)}
            />
          ))}
        </div>
      )}

      {files.length === 0 && (
        <p className="text-xs text-zinc-500 italic">
          No files uploaded — you can submit and upload later.
        </p>
      )}
    </div>
  );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function DocumentsStep({
  data,
  onUpdate,
  onNext,
  onBack,
}: StepComponentProps) {
  // STAFF REFINEMENT: Accurately determine the required document names
  const documentContext = useMemo(() => {
    const authCode = getRegulatoryAuthorityCode(data.profession || "");

    // Edge cases for Real Estate
    if (data.profession === "REAL_ESTATE_VALUER")
      return {
        title: "VRB Certificate",
        desc: "Upload your valid VRB practicing certificate.",
      };
    if (data.profession === "LAND_SURVEYOR")
      return {
        title: "ISK Certificate",
        desc: "Upload your ISK membership certificate.",
      };
    if (data.profession === "REAL_ESTATE_AGENT")
      return {
        title: "EARB Certificate",
        desc: "Upload your EARB registration certificate.",
      };

    // Regulated Boards
    if (authCode) {
      return {
        title: `${authCode} Certificate`,
        desc: `Upload your active ${authCode} registration or practicing license.`,
      };
    }

    // Fallback for unregulated (e.g., Suppliers, unlisted trades)
    return {
      title: "Business / Trade Licenses",
      desc: "Upload your Single Business Permit or relevant trade licenses.",
    };
  }, [data.profession]);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(documentsSchema),
    defaultValues: {
      certificates: data.certificates || [],
      idDocuments: data.idDocuments || [],
    },
  });

  const {
    fields: certificateFields,
    append: appendCertificate,
    remove: removeCertificate,
  } = useFieldArray({ control, name: "certificates" });
  const {
    fields: idFields,
    append: appendId,
    remove: removeId,
  } = useFieldArray({ control, name: "idDocuments" });

  const handleAddCertificates = useCallback(
    (files: File[]) => {
      files.forEach((file) => appendCertificate({ file }));
    },
    [appendCertificate],
  );

  const handleAddIdDocuments = useCallback(
    (files: File[]) => {
      files.forEach((file) => appendId({ file }));
    },
    [appendId],
  );

  const onSubmit = (formData: FormData) => {
    onUpdate({
      certificates: formData.certificates || [],
      idDocuments: formData.idDocuments || [],
    });
    onNext();
  };

  const handleSkip = () => {
    onUpdate({ certificates: [], idDocuments: [] });
    onNext();
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center"
      >
        <div className="inline-flex items-center justify-center gap-2 mb-4">
          <FileText className="h-8 w-8 text-emerald-500" />
        </div>
        <h2 className="text-2xl md:text-3xl font-bold text-white mb-2">
          Verification Documents
        </h2>
        <p className="text-zinc-400 max-w-md mx-auto">
          Upload your professional certificates and ID for verification
        </p>
      </motion.div>

      {/* Info Banner */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4"
      >
        <div className="flex items-start gap-3">
          <ShieldCheck className="h-5 w-5 text-emerald-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm text-emerald-400 font-medium">
              Documents help verify your credentials
            </p>
            <p className="text-xs text-zinc-400 mt-1">
              Your documents are securely stored and only reviewed by our
              verification team.
            </p>
          </div>
        </div>
      </motion.div>

      {/* File Upload Sections */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="space-y-8"
      >
        <FileUploadSection
          title={documentContext.title}
          description={documentContext.desc}
          icon={<CheckCircle2 className="h-5 w-5" />}
          files={certificateFields as Array<{ file: File }>}
          onFilesAdd={handleAddCertificates}
          onFileRemove={removeCertificate}
          error={errors.certificates?.message}
        />

        <div className="border-t border-white/10" />

        <FileUploadSection
          title="ID / KRA PIN Documents"
          description="Upload your National ID or Passport, and KRA PIN Certificate."
          icon={<IdCard className="h-5 w-5" />}
          files={idFields as Array<{ file: File }>}
          onFilesAdd={handleAddIdDocuments}
          onFileRemove={removeId}
          error={errors.idDocuments?.message}
        />
      </motion.div>

      {/* Navigation */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4"
      >
        <button
          type="button"
          onClick={onBack}
          className={cn(
            WIZARD_STYLES.secondaryButton,
            "flex items-center gap-2",
          )}
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </button>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleSkip}
            className={cn(
              WIZARD_STYLES.secondaryButton,
              "flex items-center gap-2",
            )}
          >
            <SkipForward className="h-4 w-4" /> Skip for now
          </button>
          <button
            type="submit"
            className={cn(
              WIZARD_STYLES.primaryButton,
              "flex items-center justify-center gap-2",
            )}
          >
            Continue to Review <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </motion.div>
    </form>
  );
}
