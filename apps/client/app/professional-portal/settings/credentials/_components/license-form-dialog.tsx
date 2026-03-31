"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { LicenseAuthority } from "@prisma/client";
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
  CreateLicenseInput,
  UpdateLicenseInput,
} from "@/app/lib/validation/documents-validation";
import type { LicenseListItem } from "@/app/lib/domains/licenses/contracts";

const LICENSE_AUTHORITIES: LicenseAuthority[] = [
  "NCA",
  "EBK",
  "BORAQS",
  "EARB",
  "ERC",
  "EPRA",
  "VRB",
  "ISK",
  "NEMA",
  "KEBS",
  "OTHER",
];

const formSchema = z.object({
  authority: z.nativeEnum(LicenseAuthority),
  licenseNumber: z.string().min(1, "License number is required").max(100),
  category: z.string().max(50).optional(),
  validFrom: z.string().min(1, "Valid from date is required"),
  validUntil: z.string().optional(),
  isAnnualRenewal: z.boolean(),
  assetId: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface LicenseFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  initialData?: LicenseListItem | null;
  onSubmit: (
    data: CreateLicenseInput | (UpdateLicenseInput & { id?: string }),
  ) => Promise<void>;
  isSubmitting?: boolean;
}

export function LicenseFormDialog({
  open,
  onOpenChange,
  mode,
  initialData,
  onSubmit,
  isSubmitting = false,
}: LicenseFormDialogProps) {
  const [assetId, setAssetId] = useState<string | null>(
    initialData?.asset?.id ?? null,
  );
  const [previewUrl, setPreviewUrl] = useState<string | null>(
    initialData?.asset?.cdnUrl ?? null,
  );

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      authority: (initialData?.authority as LicenseAuthority) ?? "NCA",
      licenseNumber: initialData?.licenseNumber ?? "",
      category: initialData?.category ?? "",
      validFrom: initialData?.validFrom
        ? new Date(initialData.validFrom).toISOString().slice(0, 16)
        : "",
      validUntil: initialData?.validUntil
        ? new Date(initialData.validUntil).toISOString().slice(0, 16)
        : "",
      isAnnualRenewal: initialData?.isAnnualRenewal ?? true,
      assetId: initialData?.asset?.id ?? "",
    },
    values: open
      ? {
          authority: (initialData?.authority as LicenseAuthority) ?? "NCA",
          licenseNumber: initialData?.licenseNumber ?? "",
          category: initialData?.category ?? "",
          validFrom: initialData?.validFrom
            ? new Date(initialData.validFrom).toISOString().slice(0, 16)
            : "",
          validUntil: initialData?.validUntil
            ? new Date(initialData.validUntil).toISOString().slice(0, 16)
            : "",
          isAnnualRenewal: initialData?.isAnnualRenewal ?? true,
          assetId: assetId ?? "",
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
    const validFrom = values.validFrom
      ? new Date(values.validFrom).toISOString()
      : "";
    const validUntil = values.validUntil
      ? new Date(values.validUntil).toISOString()
      : undefined;

    if (mode === "create") {
      await onSubmit({
        authority: values.authority,
        licenseNumber: values.licenseNumber,
        category: values.category || undefined,
        validFrom,
        validUntil,
        isAnnualRenewal: values.isAnnualRenewal,
        assetId: values.assetId || undefined,
      });
    } else if (mode === "edit" && initialData?.id) {
      await onSubmit({
        id: initialData.id,
        licenseNumber: values.licenseNumber,
        category: values.category || undefined,
        validFrom,
        validUntil,
        isAnnualRenewal: values.isAnnualRenewal,
        assetId: values.assetId || undefined,
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
          <DialogTitle>{isCreate ? "Add License" : "Edit License"}</DialogTitle>
          <DialogDescription>
            {isCreate
              ? "Add a professional license (NCA, EBK, BORAQS, etc.)."
              : "Update license details."}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <FormField
              control={form.control}
              name="authority"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Authority</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value}
                    disabled={mode === "edit"}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select authority" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {LICENSE_AUTHORITIES.map((auth) => (
                        <SelectItem key={auth} value={auth}>
                          {auth}
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
              name="licenseNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>License number</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. NCA-12345" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <CredentialUploadStep
              onUploaded={handleUploaded}
              onClear={handleClearUpload}
              currentAssetId={assetId}
              currentPreviewUrl={previewUrl}
              label="License document (optional)"
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="validFrom"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Valid from</FormLabel>
                    <FormControl>
                      <Input type="datetime-local" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="validUntil"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Valid until (optional)</FormLabel>
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
                {isCreate ? "Add License" : "Save"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
