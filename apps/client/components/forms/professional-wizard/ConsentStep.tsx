"use client";

import React, { useMemo } from "react";
import { motion } from "framer-motion";
import {
  ShieldCheck,
  FileCheck,
  Scale,
  UserCheck,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { StepComponentProps, WIZARD_STYLES } from "./types";

// ============================================================================
// CONSENT TYPES
// ============================================================================

export interface ConsentRecord {
  label: string;
  accepted: boolean;
  acceptedAt: string | null; // ISO timestamp or null
}

export interface ConsentData {
  termsAccepted: ConsentRecord;
  privacyAccepted: ConsentRecord;
  verificationAuthAccepted: ConsentRecord;
  attestationAccepted: ConsentRecord;
}

const CONSENT_ITEMS = [
  {
    key: "termsAccepted" as const,
    icon: Scale,
    label: "Professional Terms of Service",
    description:
      "I accept the BuildMarket Professional Terms of Service and agree to abide by marketplace standards, including timely communication, fair pricing, and professional conduct.",
  },
  {
    key: "privacyAccepted" as const,
    icon: ShieldCheck,
    label: "Privacy & Data Processing",
    description:
      "I consent to BuildMarket collecting, processing, and storing my professional data, documents, and business information as described in the Privacy Policy.",
  },
  {
    key: "verificationAuthAccepted" as const,
    icon: FileCheck,
    label: "Document Verification Authorization",
    description:
      "I authorize BuildMarket to verify submitted documents and credentials with the relevant regulatory authorities and professional bodies.",
  },
  {
    key: "attestationAccepted" as const,
    icon: UserCheck,
    label: "Truthful Information Attestation",
    description:
      "I attest that all information provided in this application is truthful, accurate, and complete to the best of my knowledge. I understand that providing false information may result in account suspension.",
  },
] as const;

// ============================================================================
// CONSENT STEP COMPONENT
// ============================================================================

const ConsentStep: React.FC<StepComponentProps> = ({
  data,
  onUpdate,
  onNext,
  onBack,
  isFirstStep,
  isSubmitting,
}) => {
  // Read existing consent from form data, defaulting each to unaccepted
  const consents = useMemo<ConsentData>(() => {
    const existing = (data as Record<string, unknown>).consents as
      Partial<ConsentData> | undefined;
    return {
      termsAccepted: existing?.termsAccepted ?? {
        label: "Professional Terms of Service",
        accepted: false,
        acceptedAt: null,
      },
      privacyAccepted: existing?.privacyAccepted ?? {
        label: "Privacy & Data Processing",
        accepted: false,
        acceptedAt: null,
      },
      verificationAuthAccepted: existing?.verificationAuthAccepted ?? {
        label: "Document Verification Authorization",
        accepted: false,
        acceptedAt: null,
      },
      attestationAccepted: existing?.attestationAccepted ?? {
        label: "Truthful Information Attestation",
        accepted: false,
        acceptedAt: null,
      },
    };
  }, [data]);

  const allAccepted = useMemo(
    () =>
      consents.termsAccepted.accepted &&
      consents.privacyAccepted.accepted &&
      consents.verificationAuthAccepted.accepted &&
      consents.attestationAccepted.accepted,
    [consents],
  );

  const handleToggle = (key: keyof ConsentData) => {
    const current = consents[key];
    const nowAccepted = !current.accepted;
    const updated: ConsentData = {
      ...consents,
      [key]: {
        ...current,
        accepted: nowAccepted,
        acceptedAt: nowAccepted ? new Date().toISOString() : null,
      },
    };
    onUpdate({ consents: updated } as Partial<
      Record<string, unknown>
    > as never);
  };

  return (
    <div className={WIZARD_STYLES.card}>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        {/* Heading */}
        <div className="mb-6">
          <h2
            className="font-['Syne'] text-xl font-bold text-(--color-onboarding-ink) drop-shadow-lg"
            tabIndex={-1}
          >
            Terms & Consent
          </h2>
          <p className="mt-1 text-sm text-onboarding-ink/60">
            Please review and accept the following before submitting your
            application.
          </p>
        </div>

        {/* Consent Checkboxes */}
        <div className="space-y-4" role="group" aria-label="Required consents">
          {CONSENT_ITEMS.map((item, index) => {
            const consent = consents[item.key];
            const Icon = item.icon;

            return (
              <motion.label
                key={item.key}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.08, duration: 0.25 }}
                htmlFor={`consent-${item.key}`}
                className={cn(
                  "group flex cursor-pointer gap-3 rounded-xl border p-4 transition-all duration-200",
                  consent.accepted
                    ? "border-onboarding-primary/45 bg-onboarding-primary/8"
                    : "border-white/14 bg-white/4 hover:border-white/25 hover:bg-white/6",
                )}
              >
                <div className="shrink-0 pt-0.5">
                  <input
                    type="checkbox"
                    id={`consent-${item.key}`}
                    checked={consent.accepted}
                    onChange={() => handleToggle(item.key)}
                    className="sr-only"
                    aria-describedby={`consent-desc-${item.key}`}
                  />
                  <div
                    className={cn(
                      "flex h-5 w-5 items-center justify-center rounded-md border-2 transition-all duration-200",
                      consent.accepted
                        ? "border-onboarding-primary bg-onboarding-primary"
                        : "border-white/30 bg-transparent group-hover:border-white/50",
                    )}
                    aria-hidden="true"
                  >
                    {consent.accepted && (
                      <CheckCircle2 className="h-3.5 w-3.5 text-[oklch(0.08_0.016_222)]" />
                    )}
                  </div>
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Icon
                      className={cn(
                        "h-4 w-4 shrink-0 transition-colors",
                        consent.accepted
                          ? "text-onboarding-primary"
                          : "text-onboarding-ink/50",
                      )}
                      aria-hidden="true"
                    />
                    <span
                      className={cn(
                        "text-sm font-semibold transition-colors",
                        consent.accepted
                          ? "text-onboarding-ink"
                          : "text-onboarding-ink/75",
                      )}
                    >
                      {item.label}
                    </span>
                  </div>
                  <p
                    id={`consent-desc-${item.key}`}
                    className="mt-1 text-xs leading-relaxed text-onboarding-ink/50"
                  >
                    {item.description}
                  </p>
                  {consent.accepted && consent.acceptedAt && (
                    <p className="mt-1.5 text-[10px] text-onboarding-primary/70">
                      Accepted{" "}
                      {new Date(consent.acceptedAt).toLocaleString(undefined, {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </p>
                  )}
                </div>
              </motion.label>
            );
          })}
        </div>

        {/* Validation message */}
        {!allAccepted && (
          <div className="mt-4 flex items-center gap-2 rounded-lg border border-white/10 bg-white/3 px-3 py-2">
            <AlertCircle
              className="h-4 w-4 shrink-0 text-error/80"
              aria-hidden="true"
            />
            <p className="text-xs text-onboarding-ink/60">
              All four consents are required before submitting your application.
            </p>
          </div>
        )}

        {/* Navigation buttons */}
        <div className="mt-8 flex justify-between gap-3">
          {!isFirstStep && (
            <button
              type="button"
              className={WIZARD_STYLES.secondaryButton}
              onClick={onBack}
              disabled={isSubmitting}
            >
              <ArrowLeft className="mr-1 inline-block h-3.5 w-3.5" />
              Back
            </button>
          )}
          <button
            type="button"
            className={cn(
              WIZARD_STYLES.primaryButton,
              !isFirstStep && "ml-auto",
            )}
            onClick={onNext}
            disabled={!allAccepted || isSubmitting}
            aria-label={
              allAccepted
                ? "Continue to review"
                : "Accept all consents to continue"
            }
          >
            Continue
            <ArrowRight className="ml-1 inline-block h-3.5 w-3.5" />
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default ConsentStep;
