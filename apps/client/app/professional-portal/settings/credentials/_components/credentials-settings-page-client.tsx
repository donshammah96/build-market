"use client";

import dynamic from "next/dynamic";
import { useState, useEffect } from "react";
import {
  FileText,
  Award,
  ShieldCheck,
  Terminal,
  Trash2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
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
  { ssr: false, loading: () => <div className="min-h-50" /> },
);

const CertificateFormDialog = dynamic(
  () =>
    import("./certificate-form-dialog").then((m) => ({
      default: m.CertificateFormDialog,
    })),
  { ssr: false, loading: () => <div className="min-h-50" /> },
);

const LicenseFormDialog = dynamic(
  () =>
    import("./license-form-dialog").then((m) => ({
      default: m.LicenseFormDialog,
    })),
  { ssr: false, loading: () => <div className="min-h-50" /> },
);

export default function CredentialsSettingsPageClient() {
  const [activeTab, setActiveTab] = useState<
    "documents" | "certificates" | "licenses"
  >("documents");

  const [logs, setLogs] = useState<any[]>([]);
  const [isPolling, setIsPolling] = useState(true);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  // Poll for telemetry logs (runs every 1.5s during active demo)
  useEffect(() => {
    if (!isPolling) return;
    const fetchLogs = async () => {
      try {
        const res = await fetch("/api/demo/logs");
        if (res.ok) {
          const data = await res.json();
          setLogs(data);
        }
      } catch (err) {
        console.error("Failed to fetch telemetry logs", err);
      }
    };
    fetchLogs();
    const interval = setInterval(fetchLogs, 1500);
    return () => clearInterval(interval);
  }, [isPolling]);

  const clearTelemetryLogs = async () => {
    try {
      const res = await fetch("/api/demo/logs", { method: "DELETE" });
      if (res.ok) {
        setLogs([]);
        toast.success("Telemetry logs cleared");
      }
    } catch {
      toast.error("Failed to clear telemetry logs");
    }
  };

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

      {/* UNDER THE HOOD: SYSTEM TELEMETRY PANEL */}
      <div className="mt-12 rounded-xl border border-zinc-800 bg-zinc-950/75 p-6 backdrop-blur-md shadow-2xl text-zinc-300">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-850 pb-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="relative flex h-3 w-3">
              <span
                className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isPolling ? "bg-emerald-400" : "bg-zinc-650"}`}
              ></span>
              <span
                className={`relative inline-flex rounded-full h-3 w-3 ${isPolling ? "bg-emerald-500" : "bg-zinc-550"}`}
              ></span>
            </div>
            <div>
              <h2 className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
                <Terminal className="h-5 w-5 text-emerald-400" />
                Under the Hood: System Telemetry
              </h2>
              <p className="text-xs text-zinc-500 mt-0.5">
                Redaction-filtered live stream of event logs and API transitions
                (ADR-005 compliant)
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsPolling(!isPolling)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                isPolling
                  ? "bg-zinc-900 border-zinc-700 text-zinc-300 hover:bg-zinc-800"
                  : "bg-emerald-950/40 border-emerald-800 text-emerald-400 hover:bg-emerald-950/60"
              }`}
            >
              {isPolling ? "Pause Feed" : "Resume Feed"}
            </button>
            <button
              onClick={clearTelemetryLogs}
              disabled={logs.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-950/30 border border-red-900/50 text-red-400 transition-all hover:bg-red-950/60 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Clear Logs
            </button>
          </div>
        </div>

        {logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center rounded-lg border border-dashed border-zinc-850 bg-zinc-900/10">
            <Terminal className="h-8 w-8 text-zinc-700 mb-2 animate-pulse" />
            <p className="text-sm font-medium text-zinc-500">
              No events logged yet
            </p>
            <p className="text-xs text-zinc-650 mt-1">
              Submit documents or wait for admin verifications to generate
              telemetry
            </p>
          </div>
        ) : (
          <div className="space-y-3 max-h-100 overflow-y-auto pr-2 custom-scrollbar">
            {logs.map((log, index) => {
              const logId = `${log.correlationId}-${index}`;
              const isExpanded = expandedLogId === logId;
              const isSuccess = log.outcome === "success";
              const isWarning =
                log.outcome === "validation_error" ||
                log.outcome === "rate_limited" ||
                log.outcome === "domain_error";

              let outcomeBadgeColor =
                "bg-red-500/10 text-red-400 border-red-500/20";
              if (isSuccess)
                outcomeBadgeColor =
                  "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
              else if (isWarning)
                outcomeBadgeColor =
                  "bg-amber-500/10 text-amber-400 border-amber-500/20";

              return (
                <div
                  key={logId}
                  className="rounded-lg border border-zinc-850 bg-zinc-900/20 hover:bg-zinc-900/40 transition-all overflow-hidden"
                >
                  <div
                    onClick={() => setExpandedLogId(isExpanded ? null : logId)}
                    className="flex flex-wrap items-center justify-between gap-3 p-3.5 cursor-pointer select-none"
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-zinc-600 text-xs">
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </span>
                      <span className="font-mono font-semibold text-sm text-zinc-200">
                        {log.operationName}
                      </span>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full border ${outcomeBadgeColor}`}
                      >
                        {log.outcome}
                      </span>
                    </div>

                    <div className="flex items-center gap-4 text-xs font-mono text-zinc-400">
                      <span>
                        Status:{" "}
                        <strong
                          className={
                            log.httpStatus >= 400
                              ? "text-red-400"
                              : "text-emerald-400"
                          }
                        >
                          {log.httpStatus}
                        </strong>
                      </span>
                      <span>
                        Duration: <strong>{log.durationMs}ms</strong>
                      </span>
                      <span className="capitalize">
                        Actor:{" "}
                        <strong className="text-zinc-300">
                          {log.actorRole}
                        </strong>
                      </span>
                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4 text-zinc-500" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-zinc-500" />
                      )}
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="border-t border-zinc-850 bg-black/60 p-4 font-mono text-xs overflow-x-auto">
                      <div className="flex justify-between items-center text-zinc-500 mb-2 border-b border-zinc-850 pb-1.5">
                        <span>Redacted Trace Payload</span>
                        <span>Correlation ID: {log.correlationId}</span>
                      </div>
                      <pre className="text-emerald-400 custom-scrollbar">
                        {JSON.stringify(log, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
