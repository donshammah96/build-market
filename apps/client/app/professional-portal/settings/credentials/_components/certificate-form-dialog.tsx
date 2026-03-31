"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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
  CreateCertificateInput,
  UpdateCertificateInput,
} from "@/app/lib/validation/certificate-validation";
import type { CertificateListItem } from "@/app/lib/domains/certificates/contracts";

const CERTIFICATE_CATEGORIES = [
  "EDUCATION_CERT",
  "AWARD_OR_RECOGNITION",
] as const;

const formSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  category: z.enum(CERTIFICATE_CATEGORIES),
  assetId: z.string().optional(),
  issuer: z.string().max(200).optional(),
  issueDate: z.string().optional(),
  expiryDate: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface CertificateFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  initialData?: CertificateListItem | null;
  onSubmit: (
    data: CreateCertificateInput | (UpdateCertificateInput & { id?: string }),
  ) => Promise<void>;
  isSubmitting?: boolean;
}

export function CertificateFormDialog({
  open,
  onOpenChange,
  mode,
  initialData,
  onSubmit,
  isSubmitting = false,
}: CertificateFormDialogProps) {
  const [assetId, setAssetId] = useState<string | null>(
    initialData?.asset?.id ?? null,
  );
  const [previewUrl, setPreviewUrl] = useState<string | null>(
    initialData?.asset?.cdnUrl ?? null,
  );

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: initialData?.title ?? "",
      category:
        (initialData?.category as (typeof CERTIFICATE_CATEGORIES)[number]) ??
        "EDUCATION_CERT",
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
          category:
            (initialData?.category as (typeof CERTIFICATE_CATEGORIES)[number]) ??
            "EDUCATION_CERT",
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isCreate ? "Add Certificate" : "Edit Certificate"}
          </DialogTitle>
          <DialogDescription>
            {isCreate
              ? "Upload an education certificate or award."
              : "Update certificate details."}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <CredentialUploadStep
              onUploaded={handleUploaded}
              onClear={isCreate ? undefined : handleClearUpload}
              currentAssetId={assetId}
              currentPreviewUrl={previewUrl}
              label="Certificate file"
            />

            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. BArch Degree" {...field} />
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
                      <SelectItem value="EDUCATION_CERT">
                        Education Certificate
                      </SelectItem>
                      <SelectItem value="AWARD_OR_RECOGNITION">
                        Award or Recognition
                      </SelectItem>
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
                    <Input
                      placeholder="e.g. University of Nairobi"
                      {...field}
                    />
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
                {isCreate ? "Add Certificate" : "Save"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
