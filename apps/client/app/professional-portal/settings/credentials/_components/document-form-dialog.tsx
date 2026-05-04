"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { DocumentCategory } from "@prisma/client";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CredentialUploadStep } from "./credential-upload-step";
import type {
  CreateDocumentInput,
  UpdateDocumentInput,
} from "@/app/lib/validation/documents-validation";
import type { DocumentListItem } from "@/app/lib/domains/documents/contracts";

const DOCUMENT_CATEGORIES: DocumentCategory[] = [
  "ID_OR_PASSPORT",
  "EDUCATION_CERT",
  "AWARD_OR_RECOGNITION",
  "TAX_COMPLIANCE",
  "KRA_TAX_COMPLIANCE",
  "INSURANCE_POLICY",
  "CV_OR_RESUME",
  "PORTFOLIO_DOC",
  "NCA_ACCREDITATION",
  "BUSINESS_REGISTRATION",
  "PROFESSIONAL_CERT",
  "OTHER",
];

const formSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  category: z.nativeEnum(DocumentCategory),
  assetId: z.string().optional(),
  issuer: z.string().max(200).optional(),
  issueDate: z.string().optional(),
  expiryDate: z.string().optional(),
});

type CreateFormValues = z.infer<typeof formSchema>;

interface DocumentFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  initialData?: DocumentListItem | null;
  onSubmit: (
    data: CreateDocumentInput | (UpdateDocumentInput & { id?: string }),
  ) => Promise<void>;
  isSubmitting?: boolean;
}

export function DocumentFormDialog({
  open,
  onOpenChange,
  mode,
  initialData,
  onSubmit,
  isSubmitting = false,
}: DocumentFormDialogProps) {
  const [assetId, setAssetId] = useState<string | null>(
    initialData?.asset?.id ?? null,
  );
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const form = useForm<CreateFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: initialData?.title ?? "",
      category: (initialData?.category as DocumentCategory) ?? "OTHER",
      assetId: initialData?.asset?.id ?? "",
      issuer: initialData?.issuer ?? "",
      issueDate: initialData?.issueDate
        ? new Date(initialData.issueDate).toISOString().slice(0, 16)
        : "",
      expiryDate: initialData?.expiryDate
        ? new Date(initialData.expiryDate).toISOString().slice(0, 16)
        : "",
    },
    values: open
      ? {
          title: initialData?.title ?? "",
          category: (initialData?.category as DocumentCategory) ?? "OTHER",
          assetId: assetId ?? "",
          issuer: initialData?.issuer ?? "",
          issueDate: initialData?.issueDate
            ? new Date(initialData.issueDate).toISOString().slice(0, 16)
            : "",
          expiryDate: initialData?.expiryDate
            ? new Date(initialData.expiryDate).toISOString().slice(0, 16)
            : "",
        }
      : undefined,
  });

  const handleUploaded = (id: string, url: string) => {
    setAssetId(id);
    setPreviewUrl(url);
    form.setValue("assetId", id);
  };

  const handleClearUpload = () => {
    setAssetId(null);
    setPreviewUrl(null);
    form.setValue("assetId", "");
  };

  const handleSubmit = form.handleSubmit(async (values) => {
    if (mode === "create" && !values.assetId) {
      form.setError("assetId", { message: "Upload a file first" });
      return;
    }

    const issueDate = values.issueDate
      ? new Date(values.issueDate).toISOString()
      : undefined;
    const expiryDate = values.expiryDate
      ? new Date(values.expiryDate).toISOString()
      : undefined;

    if (mode === "create" && values.assetId) {
      await onSubmit({
        title: values.title,
        category: values.category,
        assetId: values.assetId,
        issuer: values.issuer || undefined,
        issueDate,
        expiryDate,
      });
    } else if (mode === "edit" && initialData?.id) {
      await onSubmit({
        id: initialData.id,
        title: values.title,
        category: values.category,
        assetId: values.assetId || undefined,
        issuer: values.issuer || undefined,
        issueDate,
        expiryDate,
      });
    }
    onOpenChange(false);
    form.reset();
    handleClearUpload();
  });

  const isCreate = mode === "create";
  const requiresAsset = isCreate; // For create, assetId is required

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isCreate ? "Add Document" : "Edit Document"}
          </DialogTitle>
          <DialogDescription>
            {isCreate
              ? "Upload a verification document (ID, tax compliance, insurance, etc.)."
              : "Update document details."}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <CredentialUploadStep
              onUploaded={handleUploaded}
              onClear={requiresAsset ? undefined : handleClearUpload}
              currentAssetId={assetId}
              currentPreviewUrl={previewUrl}
              label="Document file"
            />

            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. National ID" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="category"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Category</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {DOCUMENT_CATEGORIES.map((cat) => (
                        <SelectItem key={cat} value={cat}>
                          {cat.replace(/_/g, " ")}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="issuer"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Issuer (optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. KRA" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="issueDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Issue date (optional)</FormLabel>
                    <FormControl>
                      <Input type="datetime-local" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="expiryDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Expiry date (optional)</FormLabel>
                    <FormControl>
                      <Input type="datetime-local" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {isCreate ? "Add Document" : "Save"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
