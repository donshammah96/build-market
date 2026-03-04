"use client";

import React, { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  CheckCircle2,
  Briefcase,
  Building2,
  Store,
  FileText,
  ShieldCheck,
  ArrowLeft,
  Edit2,
  Loader2,
  Sparkles,
  Clock,
  Globe,
  IdCard,
  Award,
  Home as HomeIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import {
  PROFESSION_OPTIONS,
  isSupplierProfession,
  isRealEstateProfession,
  getProfessionRegulatoryBody,
  getRegulatoryAuthorityCode,
} from "@/lib/constants/professionOptions";
import { StepComponentProps, WIZARD_STYLES } from "./types";

// ============================================================================
// REVIEW SECTION COMPONENT
// ============================================================================

interface ReviewSectionProps {
  title: string;
  icon: React.ReactNode;
  onEdit?: () => void;
  children: React.ReactNode;
  isComplete?: boolean;
}

const ReviewSection: React.FC<ReviewSectionProps> = ({
  title,
  icon,
  onEdit,
  children,
  isComplete = true,
}) => (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    className={cn(
      "bg-white/5 border rounded-xl p-5",
      isComplete ? "border-emerald-500/30" : "border-amber-500/30",
    )}
  >
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-3">
        <div
          className={cn(
            "p-2 rounded-lg",
            isComplete
              ? "bg-emerald-500/20 text-emerald-400"
              : "bg-amber-500/20 text-amber-400",
          )}
        >
          {icon}
        </div>
        <h3 className="font-medium text-white">{title}</h3>
        {isComplete && <CheckCircle2 className="h-4 w-4 text-emerald-400" />}
      </div>
      {onEdit && (
        <button
          type="button"
          onClick={onEdit}
          className="text-sm text-zinc-400 hover:text-white flex items-center gap-1 transition-colors"
        >
          <Edit2 className="h-3.5 w-3.5" /> Edit
        </button>
      )}
    </div>
    <div className="space-y-2">{children}</div>
  </motion.div>
);

interface ReviewItemProps {
  label: string;
  value: string | undefined;
  icon?: React.ReactNode;
  highlight?: boolean;
}

const ReviewItem: React.FC<ReviewItemProps> = ({
  label,
  value,
  icon,
  highlight,
}) => (
  <div className="flex items-center justify-between py-1.5">
    <span className="text-sm text-zinc-400 flex items-center gap-2">
      {icon}
      {label}
    </span>
    <span
      className={cn(
        "text-sm font-medium",
        highlight ? "text-emerald-400" : "text-white",
        !value && "text-zinc-500 italic",
      )}
    >
      {value || "Not provided"}
    </span>
  </div>
);

// ============================================================================
// LEGAL CHECKBOX COMPONENT
// ============================================================================

interface LegalCheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  children: React.ReactNode;
}

const LegalCheckbox: React.FC<LegalCheckboxProps> = ({
  checked,
  onChange,
  children,
}) => (
  <label className="flex items-start gap-3 cursor-pointer group">
    <div className="relative flex items-center justify-center mt-1">
      <input
        type="checkbox"
        className="peer sr-only"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <div className="w-5 h-5 border-2 border-zinc-600 rounded bg-transparent peer-checked:bg-emerald-500 peer-checked:border-emerald-500 transition-all flex items-center justify-center">
        {checked && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
      </div>
    </div>
    <span className="text-sm text-zinc-400 group-hover:text-zinc-300 transition-colors">
      {children}
    </span>
  </label>
);

export default function ReviewStep({
  data,
  onUpdate: _onUpdate,
  onNext,
  onBack,
  goToStep,
  isSubmitting,
}: StepComponentProps) {
  // STAFF REFINEMENT: Compute all domain logic intelligently
  const {
    professionLabel,
    regulatoryBody,
    authCode,
    isSupplier,
    isRealEstate,
  } = useMemo(() => {
    const prof = data.profession || "";
    return {
      professionLabel:
        PROFESSION_OPTIONS.find((p) => p.value === prof)?.label || prof,
      regulatoryBody: getProfessionRegulatoryBody(prof),
      authCode: getRegulatoryAuthorityCode(prof),
      isSupplier: isSupplierProfession(prof),
      isRealEstate: isRealEstateProfession(prof),
    };
  }, [data.profession]);

  const certificateCount = data.certificates?.length || 0;
  const idDocumentCount = data.idDocuments?.length || 0;
  const totalDocuments = certificateCount + idDocumentCount;

  // Layer 2: Role-specific legal agreements (must be checked before submission)
  const [agreedToTruth, setAgreedToTruth] = useState(false);
  const [agreedToTos, setAgreedToTos] = useState(false);
  const canSubmit = agreedToTruth && agreedToTos;

  const handleSubmit = () => {
    if (!canSubmit) return;
    onNext();
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center"
      >
        <div className="inline-flex items-center justify-center gap-2 mb-4">
          <CheckCircle2 className="h-8 w-8 text-emerald-500" />
          <Sparkles className="h-5 w-5 text-amber-400 animate-pulse" />
        </div>
        <h2 className="text-2xl md:text-3xl font-bold text-white mb-2">
          Review Your Application
        </h2>
        <p className="text-zinc-400 max-w-md mx-auto">
          Please review your information before submitting.
        </p>
      </motion.div>

      <div className="space-y-4">
        {/* Profession Section */}
        <ReviewSection
          title="Profession"
          icon={<Briefcase className="h-5 w-5" />}
          onEdit={() => goToStep("profession")}
        >
          <ReviewItem
            label="Selected Profession"
            value={professionLabel}
            highlight
          />
          {regulatoryBody && (
            <ReviewItem label="Regulatory Body" value={regulatoryBody} />
          )}
        </ReviewSection>

        {/* Business Details Section */}
        <ReviewSection
          title="Business Details"
          icon={<Building2 className="h-5 w-5" />}
          onEdit={() => goToStep("details")}
        >
          <ReviewItem
            label="Company Name"
            value={data.companyName}
            icon={<Building2 className="h-3.5 w-3.5" />}
          />
          <ReviewItem
            label="Years of Experience"
            value={data.yearsExperience?.toString()}
            icon={<Clock className="h-3.5 w-3.5" />}
          />
          <ReviewItem
            label="Website"
            value={data.website}
            icon={<Globe className="h-3.5 w-3.5" />}
          />
          {data.bio && (
            <div className="pt-2 mt-2 border-t border-white/10">
              <p className="text-sm text-zinc-400 mb-1">Bio</p>
              <p className="text-sm text-white line-clamp-3">{data.bio}</p>
            </div>
          )}
        </ReviewSection>

        {/* STAFF REFINEMENT: Dynamic Board Credentials */}
        {authCode && (
          <ReviewSection
            title={`${authCode} Credentials`}
            icon={<Award className="h-5 w-5" />}
            onEdit={() => goToStep("credentials")}
            isComplete={!!data.boardRegistrationNumber}
          >
            <ReviewItem
              label="Registration Number"
              value={data.boardRegistrationNumber}
              icon={<ShieldCheck className="h-3.5 w-3.5" />}
              highlight={!!data.boardRegistrationNumber}
            />
          </ReviewSection>
        )}

        {/* Store Section (Suppliers only) */}
        {isSupplier && (
          <ReviewSection
            title="Store Information"
            icon={<Store className="h-5 w-5" />}
            onEdit={() => goToStep("store")}
            isComplete={data.stores && data.stores.length > 0}
          >
            {/* ... (Kept exactly as your original) ... */}
            {data.stores && data.stores.length > 0 ? (
              <div className="space-y-3">
                <p className="text-sm text-zinc-400 mb-2">
                  {data.stores.length} Store(s) Configured
                </p>
                {data.stores.map((store, index) => (
                  <div
                    key={index}
                    className="p-3 bg-white/5 rounded-lg border border-white/10 flex justify-between items-center"
                  >
                    <span className="text-emerald-400 font-medium text-sm">
                      {store.name}
                    </span>
                    <span className="text-xs text-zinc-500">{store.city}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-amber-400 italic">
                No stores added — you can add them from your dashboard
              </p>
            )}
          </ReviewSection>
        )}

        {/* Property Section (Real Estate only) */}
        {isRealEstate && (
          <ReviewSection
            title="Property Listings"
            icon={<HomeIcon className="h-5 w-5" />}
            onEdit={() => goToStep("property")}
            isComplete={data.properties && data.properties.length > 0}
          >
            {/* ... (Kept exactly as your original) ... */}
            {data.properties && data.properties.length > 0 ? (
              <div className="space-y-3">
                <p className="text-sm text-zinc-400 mb-2">
                  {data.properties.length} Property Listed
                </p>
                {data.properties.map((prop, index) => (
                  <div
                    key={index}
                    className="p-3 bg-white/5 rounded-lg border border-white/10 flex justify-between items-center"
                  >
                    <span className="text-emerald-400 font-medium text-sm">
                      {prop.title}
                    </span>
                    <span className="text-xs text-emerald-500 font-bold">
                      {prop.currency} {prop.price.toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-zinc-500 italic">
                No properties added yet — you can add them later
              </p>
            )}
          </ReviewSection>
        )}

        {/* Documents Section */}
        <ReviewSection
          title="Verification Documents"
          icon={<FileText className="h-5 w-5" />}
          onEdit={() => goToStep("documents")}
          isComplete={totalDocuments > 0}
        >
          <ReviewItem
            label="Certificates"
            value={
              certificateCount > 0
                ? `${certificateCount} file(s) uploaded`
                : undefined
            }
            icon={<FileText className="h-3.5 w-3.5" />}
          />
          <ReviewItem
            label="ID Documents"
            value={
              idDocumentCount > 0
                ? `${idDocumentCount} file(s) uploaded`
                : undefined
            }
            icon={<IdCard className="h-3.5 w-3.5" />}
          />
        </ReviewSection>
      </div>

      {/* Submission Info */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4"
      >
        <div className="flex items-start gap-3">
          <ShieldCheck className="h-5 w-5 text-emerald-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm text-emerald-400 font-medium">
              What happens next?
            </p>
            <p className="text-xs text-zinc-400 mt-1">
              After submitting, our team will review your application and
              documents. You&apos;ll receive an email notification once your
              profile is verified.
            </p>
          </div>
        </div>
      </motion.div>

      {/* Layer 2: Role-Specific Legal Agreements */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.35 }}
        className="space-y-4 pt-4 border-t border-white/10"
      >
        <LegalCheckbox checked={agreedToTruth} onChange={setAgreedToTruth}>
          I declare that the information provided, including my{" "}
          {authCode || "professional"} credentials, is true and accurate. I
          understand that misrepresentation may result in account termination
          and legal action.
        </LegalCheckbox>

        <LegalCheckbox checked={agreedToTos} onChange={setAgreedToTos}>
          I agree to the Build Market{" "}
          <a
            href="/legal/professional-terms"
            target="_blank"
            className="text-emerald-400 hover:underline"
          >
            Professional Services Agreement
          </a>{" "}
          and{" "}
          <a
            href="/legal/privacy"
            target="_blank"
            className="text-emerald-400 hover:underline"
          >
            Privacy Policy
          </a>
          .
        </LegalCheckbox>
      </motion.div>

      {/* Navigation */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="flex items-center justify-between pt-4"
      >
        <button
          type="button"
          onClick={onBack}
          disabled={isSubmitting}
          className={cn(
            WIZARD_STYLES.secondaryButton,
            "flex items-center gap-2",
          )}
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </button>

        <button
          type="button"
          onClick={handleSubmit}
          disabled={isSubmitting || !canSubmit}
          className={cn(
            "font-bold py-3.5 px-8 rounded-lg text-white bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-600",
            "hover:from-amber-400 hover:via-yellow-400 hover:to-amber-500",
            "transition-all duration-200 shadow-lg hover:shadow-amber-500/30 hover:scale-[1.02]",
            "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center justify-center gap-2",
          )}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" /> Submitting...
            </>
          ) : (
            <>
              <ShieldCheck className="h-5 w-5" /> Submit Application
            </>
          )}
        </button>
      </motion.div>
    </div>
  );
}
