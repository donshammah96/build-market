"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { FileText, Award, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ConfirmDeleteDialog } from "@/components/ui/ConfirmDeleteDialog";
import {
  useDocuments,
  useCreateDocument,
  useUpdateDocument,
  useDeleteDocument,
} from "@/hooks/useDocuments";
import {
  useCertificates,
  useCreateCertificate,
  useUpdateCertificate,
  useDeleteCertificate,
} from "@/hooks/useCertificates";
import {
  useLicenses,
  useCreateLicense,
  useUpdateLicense,
  useDeleteLicense,
} from "@/hooks/useLicenses";
import { DocumentsTab } from "./documents-tab";
import { CertificatesTab } from "./certificates-tab";
import { LicensesTab } from "./licenses-tab";
import type { DocumentListItem } from "@/app/lib/domains/documents/contracts";
import type { CertificateListItem } from "@/app/lib/domains/certificates/contracts";
import type { LicenseListItem } from "@/app/lib/domains/licenses/contracts";

const DocumentFormDialog = dynamic(
  () =>
    import("./document-form-dialog").then((m) => ({
      default: m.DocumentFormDialog,
    })),
  { ssr: false, loading: () => <div className="min-h-[200px]" /> },
);

const CertificateFormDialog = dynamic(
  () =>
    import("./certificate-form-dialog").then((m) => ({
      default: m.CertificateFormDialog,
    })),
  { ssr: false, loading: () => <div className="min-h-[200px]" /> },
);

const LicenseFormDialog = dynamic(
  () =>
    import("./license-form-dialog").then((m) => ({
      default: m.LicenseFormDialog,
    })),
  { ssr: false, loading: () => <div className="min-h-[200px]" /> },
);

export default function CredentialsSettingsPageClient() {
  const [activeTab, setActiveTab] = useState<
    "documents" | "certificates" | "licenses"
  >("documents");

  const [docCreateOpen, setDocCreateOpen] = useState(false);
  const [docEditOpen, setDocEditOpen] = useState(false);
  const [docDeleteOpen, setDocDeleteOpen] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<DocumentListItem | null>(null);

  const [certCreateOpen, setCertCreateOpen] = useState(false);
  const [certEditOpen, setCertEditOpen] = useState(false);
  const [certDeleteOpen, setCertDeleteOpen] = useState(false);
  const [selectedCert, setSelectedCert] = useState<CertificateListItem | null>(
    null,
  );

  const [licCreateOpen, setLicCreateOpen] = useState(false);
  const [licEditOpen, setLicEditOpen] = useState(false);
  const [licDeleteOpen, setLicDeleteOpen] = useState(false);
  const [selectedLic, setSelectedLic] = useState<LicenseListItem | null>(null);

  const {
    data: documents = [],
    isLoading: documentsLoading,
    error: documentsError,
    refetch: refetchDocuments,
  } = useDocuments();

  const {
    data: certificates = [],
    isLoading: certificatesLoading,
    error: certificatesError,
    refetch: refetchCertificates,
  } = useCertificates();

  const {
    data: licenses = [],
    isLoading: licensesLoading,
    error: licensesError,
    refetch: refetchLicenses,
  } = useLicenses();

  const createDocMutation = useCreateDocument({
    onSuccess: () => {
      setDocCreateOpen(false);
      toast.success("Document added");
    },
    onError: (e) => toast.error(e.message),
  });

  const updateDocMutation = useUpdateDocument({
    onSuccess: () => {
      setDocEditOpen(false);
      setSelectedDoc(null);
      toast.success("Document updated");
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteDocMutation = useDeleteDocument({
    onSuccess: () => {
      setDocDeleteOpen(false);
      setSelectedDoc(null);
      toast.success("Document deleted");
    },
    onError: (e) => toast.error(e.message),
  });

  const createCertMutation = useCreateCertificate({
    onSuccess: () => {
      setCertCreateOpen(false);
      toast.success("Certificate added");
    },
    onError: (e) => toast.error(e.message),
  });

  const updateCertMutation = useUpdateCertificate({
    onSuccess: () => {
      setCertEditOpen(false);
      setSelectedCert(null);
      toast.success("Certificate updated");
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteCertMutation = useDeleteCertificate({
    onSuccess: () => {
      setCertDeleteOpen(false);
      setSelectedCert(null);
      toast.success("Certificate deleted");
    },
    onError: (e) => toast.error(e.message),
  });

  const createLicMutation = useCreateLicense({
    onSuccess: () => {
      setLicCreateOpen(false);
      toast.success("License added");
    },
    onError: (e) => toast.error(e.message),
  });

  const updateLicMutation = useUpdateLicense({
    onSuccess: () => {
      setLicEditOpen(false);
      setSelectedLic(null);
      toast.success("License updated");
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteLicMutation = useDeleteLicense({
    onSuccess: () => {
      setLicDeleteOpen(false);
      setSelectedLic(null);
      toast.success("License deleted");
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="mx-auto max-w-[1600px] space-y-6 pb-10">
      <div className="flex flex-col gap-4 border-b border-zinc-100 pb-6 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-zinc-900 tracking-tight">
            Credentials & Verification
          </h1>
          <p className="mt-1 text-zinc-500">
            Manage your documents, certificates, and professional licenses
          </p>
        </div>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(v) =>
          setActiveTab(v as "documents" | "certificates" | "licenses")
        }
      >
        <TabsList className="bg-zinc-100">
          <TabsTrigger value="documents" className="gap-2">
            <FileText className="h-4 w-4" />
            Documents ({documents.length})
          </TabsTrigger>
          <TabsTrigger value="certificates" className="gap-2">
            <Award className="h-4 w-4" />
            Certificates ({certificates.length})
          </TabsTrigger>
          <TabsTrigger value="licenses" className="gap-2">
            <ShieldCheck className="h-4 w-4" />
            Licenses ({licenses.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="documents" className="mt-6 space-y-6">
          <DocumentsTab
            documents={documents}
            isLoading={documentsLoading}
            error={documentsError}
            onAdd={() => setDocCreateOpen(true)}
            onEdit={(doc) => {
              setSelectedDoc(doc);
              setDocEditOpen(true);
            }}
            onDelete={(doc) => {
              setSelectedDoc(doc);
              setDocDeleteOpen(true);
            }}
            onRetry={() => refetchDocuments()}
          />
        </TabsContent>

        <TabsContent value="certificates" className="mt-6 space-y-6">
          <CertificatesTab
            certificates={certificates}
            isLoading={certificatesLoading}
            error={certificatesError}
            onAdd={() => setCertCreateOpen(true)}
            onEdit={(cert) => {
              setSelectedCert(cert);
              setCertEditOpen(true);
            }}
            onDelete={(cert) => {
              setSelectedCert(cert);
              setCertDeleteOpen(true);
            }}
            onRetry={() => refetchCertificates()}
          />
        </TabsContent>

        <TabsContent value="licenses" className="mt-6 space-y-6">
          <LicensesTab
            licenses={licenses}
            isLoading={licensesLoading}
            error={licensesError}
            onAdd={() => setLicCreateOpen(true)}
            onEdit={(lic) => {
              setSelectedLic(lic);
              setLicEditOpen(true);
            }}
            onDelete={(lic) => {
              setSelectedLic(lic);
              setLicDeleteOpen(true);
            }}
            onRetry={() => refetchLicenses()}
          />
        </TabsContent>
      </Tabs>

      <DocumentFormDialog
        key={docEditOpen ? `edit-${selectedDoc?.id}` : "create"}
        open={docCreateOpen || docEditOpen}
        onOpenChange={(open) => {
          if (!open) {
            setDocCreateOpen(false);
            setDocEditOpen(false);
            setSelectedDoc(null);
          }
        }}
        mode={docEditOpen ? "edit" : "create"}
        initialData={selectedDoc}
        onSubmit={async (data) => {
          if ("id" in data && data.id) {
            await updateDocMutation.mutateAsync({
              id: data.id,
              data: {
                title: data.title,
                category: data.category,
                assetId: data.assetId,
                issuer: data.issuer,
                issueDate: data.issueDate,
                expiryDate: data.expiryDate,
              },
            });
          } else {
            await createDocMutation.mutateAsync(
              data as Parameters<typeof createDocMutation.mutateAsync>[0],
            );
          }
        }}
        isSubmitting={
          createDocMutation.isPending || updateDocMutation.isPending
        }
      />

      <CertificateFormDialog
        key={certEditOpen ? `edit-${selectedCert?.id}` : "create"}
        open={certCreateOpen || certEditOpen}
        onOpenChange={(open) => {
          if (!open) {
            setCertCreateOpen(false);
            setCertEditOpen(false);
            setSelectedCert(null);
          }
        }}
        mode={certEditOpen ? "edit" : "create"}
        initialData={selectedCert}
        onSubmit={async (data) => {
          if ("id" in data && data.id) {
            await updateCertMutation.mutateAsync({
              id: data.id,
              data: {
                title: data.title,
                category: data.category,
                assetId: data.assetId,
                issuer: data.issuer,
                issueDate: data.issueDate,
                expiryDate: data.expiryDate,
              },
            });
          } else {
            await createCertMutation.mutateAsync(
              data as Parameters<typeof createCertMutation.mutateAsync>[0],
            );
          }
        }}
        isSubmitting={
          createCertMutation.isPending || updateCertMutation.isPending
        }
      />

      <LicenseFormDialog
        key={licEditOpen ? `edit-${selectedLic?.id}` : "create"}
        open={licCreateOpen || licEditOpen}
        onOpenChange={(open) => {
          if (!open) {
            setLicCreateOpen(false);
            setLicEditOpen(false);
            setSelectedLic(null);
          }
        }}
        mode={licEditOpen ? "edit" : "create"}
        initialData={selectedLic}
        onSubmit={async (data) => {
          if ("id" in data && data.id) {
            await updateLicMutation.mutateAsync({
              id: data.id,
              data: {
                licenseNumber: data.licenseNumber,
                category: data.category,
                validFrom: data.validFrom,
                validUntil: data.validUntil,
                isAnnualRenewal: data.isAnnualRenewal,
                assetId: data.assetId,
              },
            });
          } else {
            await createLicMutation.mutateAsync(
              data as Parameters<typeof createLicMutation.mutateAsync>[0],
            );
          }
        }}
        isSubmitting={
          createLicMutation.isPending || updateLicMutation.isPending
        }
      />

      <ConfirmDeleteDialog
        open={docDeleteOpen}
        onOpenChange={setDocDeleteOpen}
        title="Delete Document"
        entityName={selectedDoc?.title ?? ""}
        description="This document will be permanently removed. This action cannot be undone."
        onConfirm={() =>
          selectedDoc && deleteDocMutation.mutate(selectedDoc.id)
        }
        isPending={deleteDocMutation.isPending}
      />

      <ConfirmDeleteDialog
        open={certDeleteOpen}
        onOpenChange={setCertDeleteOpen}
        title="Delete Certificate"
        entityName={selectedCert?.title ?? ""}
        description="This certificate will be permanently removed. This action cannot be undone."
        onConfirm={() =>
          selectedCert && deleteCertMutation.mutate(selectedCert.id)
        }
        isPending={deleteCertMutation.isPending}
      />

      <ConfirmDeleteDialog
        open={licDeleteOpen}
        onOpenChange={setLicDeleteOpen}
        title="Delete License"
        entityName={
          selectedLic
            ? `${selectedLic.authority} ${selectedLic.licenseNumber}`
            : ""
        }
        description="This license will be permanently removed. This action cannot be undone."
        onConfirm={() =>
          selectedLic && deleteLicMutation.mutate(selectedLic.id)
        }
        isPending={deleteLicMutation.isPending}
      />
    </div>
  );
}
