"use client";

import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  ShieldAlert,
  AlertTriangle,
  FileText,
  History,
  Loader2,
  Lock,
} from "lucide-react";
import {
  getRegulatorVerificationCaseDetail,
  recordRegulatorManualDecision,
} from "@/actions/admin";
import type {
  RegulatorVerificationCaseDetail,
  RegulatorVerificationDecisionOutcome,
} from "@/lib/domains/regulator-verification";

interface RegulatorVerificationDetailDialogProps {
  caseId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDecisionSubmitted?: (() => void) | undefined;
}

const REASON_CODES = [
  {
    value: "NAME_MISMATCH_CONFIRMED_SAME_PERSON",
    label: "Name mismatch verified — same identity",
  },
  {
    value: "DOCUMENTS_VERIFIED_MANUALLY",
    label: "Physical / PDF certificates verified manually",
  },
  {
    value: "OVERRIDE_REGULATOR_REJECTION",
    label: "Override regulator rejection (Requires 2nd Approver)",
  },
  {
    value: "LICENSE_SUSPENDED_CONFIRMED",
    label: "Confirmed regulator license suspension",
  },
  {
    value: "EXPIRED_LICENSE_RECORD",
    label: "License expired on regulator registry",
  },
  {
    value: "INCOMPLETE_DOCUMENTATION",
    label: "Incomplete documentation submitted",
  },
  { value: "OTHER", label: "Other reason (specify below)" },
] as const;

export function RegulatorVerificationDetailDialog({
  caseId,
  open,
  onOpenChange,
  onDecisionSubmitted,
}: RegulatorVerificationDetailDialogProps) {
  const [detail, setDetail] = useState<RegulatorVerificationCaseDetail | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [outcome, setOutcome] =
    useState<RegulatorVerificationDecisionOutcome>("APPROVE");
  const [reasonCode, setReasonCode] = useState<string>(REASON_CODES[0].value);
  const [customReasonCode, setCustomReasonCode] = useState("");
  const [reasonNotes, setReasonNotes] = useState("");
  const [highRiskReview, setHighRiskReview] = useState(false);

  useEffect(() => {
    if (open && caseId) {
      setLoading(true);
      setError(null);
      getRegulatorVerificationCaseDetail(caseId)
        .then((res) => {
          if (res.success && res.data) {
            setDetail(res.data);
            // Auto-flag high risk if confidence score is low (< 0.7) or status is DEAD_LETTER
            const isLowConfidence =
              res.data.confidence !== null && res.data.confidence < 0.7;
            const isDeadLetter = res.data.status === "DEAD_LETTER";
            if (isLowConfidence || isDeadLetter) {
              setHighRiskReview(true);
            }
          } else {
            setError(res.error || "Failed to load case details");
          }
        })
        .catch((err) => setError(err.message))
        .finally(() => setLoading(false));
    } else {
      setDetail(null);
    }
  }, [open, caseId]);

  const effectiveReasonCode =
    reasonCode === "OTHER" ? customReasonCode.trim() : reasonCode;

  const handleSubmitDecision = async () => {
    if (!caseId) return;
    if (!effectiveReasonCode) {
      setError("Please select or enter a reason code");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await recordRegulatorManualDecision({
        caseId,
        outcome,
        reasonCode: effectiveReasonCode,
        reasonNotes: reasonNotes.trim() || undefined,
        highRiskReview,
      });

      if (res.success) {
        onDecisionSubmitted?.();
        onOpenChange(false);
      } else {
        setError(res.error || "Failed to record manual decision");
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Error submitting decision",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span>Regulator Verification Case</span>
            {detail && (
              <Badge variant="outline" className="font-mono">
                {detail.authority} — {detail.licenseNumber}
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription>
            Review automated verification telemetry, evidence snapshots,
            duplicate license history, and record an operator decision.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center p-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : detail ? (
          <div className="space-y-6">
            {/* Case Header & Status Info */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-lg bg-muted/40 border">
              <div>
                <span className="text-xs text-muted-foreground">Status</span>
                <p className="font-semibold text-sm">{detail.status}</p>
              </div>
              <div>
                <span className="text-xs text-muted-foreground">
                  Confidence
                </span>
                <p className="font-semibold text-sm">
                  {detail.confidence !== null
                    ? `${(detail.confidence * 100).toFixed(0)}%`
                    : "N/A"}
                </p>
              </div>
              <div>
                <span className="text-xs text-muted-foreground">Attempts</span>
                <p className="font-semibold text-sm">
                  {detail.attempts} / {detail.maxAttempts}
                </p>
              </div>
              <div>
                <span className="text-xs text-muted-foreground">
                  Professional ID
                </span>
                <p
                  className="font-semibold text-sm truncate"
                  title={detail.professionalId}
                >
                  {detail.professionalId}
                </p>
              </div>
            </div>

            {/* Manual Fallback Reason if present */}
            {detail.manualFallbackReason && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Fallback Reason</AlertTitle>
                <AlertDescription>
                  {detail.manualFallbackReason}
                </AlertDescription>
              </Alert>
            )}

            {/* Duplicates Warning */}
            {detail.duplicates.length > 0 && (
              <Alert variant="destructive">
                <ShieldAlert className="h-4 w-4" />
                <AlertTitle>Duplicate License Detected</AlertTitle>
                <AlertDescription>
                  {detail.duplicates.length} other case(s) exist for{" "}
                  {detail.authority} license{" "}
                  <strong>{detail.licenseNumber}</strong> across professionals.
                  Verify identity carefully to prevent license impersonation.
                </AlertDescription>
              </Alert>
            )}

            {/* Evidence Inspection */}
            <div className="space-y-2">
              <h4 className="font-medium text-sm flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" />
                Evidence & Verification Reasoning
              </h4>
              <div className="p-3 rounded-md bg-muted font-mono text-xs overflow-x-auto max-h-48">
                <pre>
                  {JSON.stringify(
                    detail.evidence ?? { message: "No evidence payload" },
                    null,
                    2,
                  )}
                </pre>
              </div>
            </div>

            {/* Prior Decisions */}
            {detail.decisions.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-medium text-sm flex items-center gap-2">
                  <History className="h-4 w-4 text-primary" />
                  Prior Operator Decision Trail ({detail.decisions.length})
                </h4>
                <div className="space-y-2 max-h-36 overflow-y-auto">
                  {detail.decisions.map((d) => (
                    <div
                      key={d.id}
                      className="p-2.5 rounded border text-xs flex flex-col gap-1 bg-background"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold">
                          {d.adminName} ({d.adminEmail})
                        </span>
                        <Badge
                          variant={
                            d.outcome === "APPROVE" ? "default" : "destructive"
                          }
                        >
                          {d.outcome}
                        </Badge>
                      </div>
                      <p className="text-muted-foreground">
                        Reason: {d.reasonCode}{" "}
                        {d.reasonNotes ? `— ${d.reasonNotes}` : ""}
                      </p>
                      {d.highRiskReview && (
                        <p className="text-amber-600 dark:text-amber-400 font-medium">
                          High Risk Review{" "}
                          {d.isSecondApprover
                            ? "(2nd Approver Confirmed)"
                            : "(1st Approver Recorded)"}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Decision Submission Form */}
            <div className="p-4 rounded-lg border bg-muted/20 space-y-4">
              <h4 className="font-semibold text-sm flex items-center gap-2">
                <Lock className="h-4 w-4 text-primary" />
                Record Operator Decision
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label>Outcome</Label>
                  <Select
                    value={outcome}
                    onValueChange={(val) =>
                      setOutcome(val as RegulatorVerificationDecisionOutcome)
                    }
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select outcome" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="APPROVE">
                        Approve (Manually Verified)
                      </SelectItem>
                      <SelectItem value="REJECT">
                        Reject (Manually Rejected)
                      </SelectItem>
                      <SelectItem value="REQUEST_MORE_INFO">
                        Request More Info
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Reason Code (Required)</Label>
                  <Select value={reasonCode} onValueChange={setReasonCode}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select reason code" />
                    </SelectTrigger>
                    <SelectContent>
                      {REASON_CODES.map((r) => (
                        <SelectItem key={r.value} value={r.value}>
                          {r.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {reasonCode === "OTHER" && (
                <div>
                  <Label>Custom Reason Code</Label>
                  <Input
                    className="mt-1"
                    placeholder="Enter custom reason code (e.g. REGULATOR_API_SYNTACTIC_MISMATCH)"
                    value={customReasonCode}
                    onChange={(e) => setCustomReasonCode(e.target.value)}
                  />
                </div>
              )}

              <div>
                <Label>Decision Notes / Audit Justification</Label>
                <Textarea
                  className="mt-1"
                  rows={2}
                  placeholder="Provide supporting operational context for this decision..."
                  value={reasonNotes}
                  onChange={(e) => setReasonNotes(e.target.value)}
                />
              </div>

              <div className="flex items-center space-x-2 pt-2">
                <Checkbox
                  id="highRisk"
                  checked={highRiskReview}
                  onCheckedChange={(checked) =>
                    setHighRiskReview(Boolean(checked))
                  }
                />
                <Label
                  htmlFor="highRisk"
                  className="text-xs font-normal cursor-pointer"
                >
                  Require <strong>Two-Approver Review</strong> (High Risk
                  Decision — requires 2 different admins before case status
                  flips)
                </Label>
              </div>

              {highRiskReview && (
                <Alert className="bg-amber-500/10 border-amber-500/30 text-amber-900 dark:text-amber-200">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  <AlertTitle className="text-xs font-semibold">
                    Two-Approver Policy Enabled
                  </AlertTitle>
                  <AlertDescription className="text-xs">
                    Submitting this decision will record your recommendation.
                    Case status will remain unchanged until a second, different
                    admin submits the same outcome.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          </div>
        ) : null}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          {detail && (
            <Button onClick={handleSubmitDecision} disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Submit Decision
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
