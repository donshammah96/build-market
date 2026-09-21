import React from "react";
import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { prisma, TrustTier } from "@build/db";
import { TrustSealBadge } from "@build/ui/trust-seal-badge";
import { InsuredIndicator } from "@build/ui/insured-indicator";

export const metadata = {
  title: "Trust & Verification Status | Build Market Pro",
  description:
    "View your current trust tier, compliance credentials, and requirements to level up.",
};

async function getTrustProfile(userId: string) {
  const user = await prisma.user.findUnique({
    where: { clerkId: userId },
    include: {
      professionalProfile: {
        include: {
          licenses: true,
          documents: true,
          portfolios: true,
          reviews: { where: { isVerified: true } },
          cpdRecords: true,
        },
      },
    },
  });
  return user?.professionalProfile;
}

export default async function TrustVerificationPage() {
  const session = await auth();
  if (!session?.userId) {
    return (
      <div className="p-8 text-center text-sm text-neutral-600">
        Please sign in to view your verification status.
      </div>
    );
  }

  const profile = await getTrustProfile(session.userId);
  if (!profile) {
    return (
      <div className="p-8 text-center text-sm text-neutral-600">
        Professional profile not found.
      </div>
    );
  }

  const currentTier = profile.trustTier || TrustTier.UNVERIFIED;
  const activeLicense = profile.licenses?.[0];
  const now = new Date();

  // License expiry countdown
  let daysUntilLicenseExpiry: number | null = null;
  if (activeLicense?.validUntil) {
    const expiryDate = new Date(activeLicense.validUntil);
    daysUntilLicenseExpiry = Math.ceil(
      (expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
    );
  }

  const isNcaExpiringSoon =
    daysUntilLicenseExpiry !== null &&
    daysUntilLicenseExpiry <= 60 &&
    daysUntilLicenseExpiry > 0;
  const isLicenseExpired =
    daysUntilLicenseExpiry !== null && daysUntilLicenseExpiry <= 0;

  // Next Tier Requirements Checklist
  const missingRequirements: { label: string; done: boolean; hint: string }[] =
    [];

  if (currentTier === TrustTier.UNVERIFIED) {
    const hasId = profile.documents.some(
      (d) => d.category === "ID_OR_PASSPORT",
    );
    missingRequirements.push({
      label: "Government ID / Passport Verification",
      done: hasId,
      hint: "Upload a valid National ID or Passport to reach T1 (ID Verified).",
    });
  }

  if (
    currentTier === TrustTier.UNVERIFIED ||
    currentTier === TrustTier.ID_VERIFIED
  ) {
    const portfolioCount = profile.portfolios?.length || 0;
    const verifiedReviewCount = profile.reviews?.length || 0;

    missingRequirements.push({
      label: "Portfolio Projects (≥3 with photos)",
      done: portfolioCount >= 3,
      hint: `Currently ${portfolioCount}/3 uploaded projects.`,
    });
    missingRequirements.push({
      label: "Verified Client Reviews (≥2)",
      done: verifiedReviewCount >= 2,
      hint: `Currently ${verifiedReviewCount}/2 verified reviews.`,
    });
  }

  if (
    currentTier === TrustTier.UNVERIFIED ||
    currentTier === TrustTier.ID_VERIFIED ||
    currentTier === TrustTier.SKILLS_VERIFIED
  ) {
    const hasVerifiedLicense = profile.licenses.some(
      (l) =>
        l.status === "VERIFIED" &&
        (!l.validUntil || new Date(l.validUntil) > now),
    );
    missingRequirements.push({
      label: "Regulator License (NCA / BORAQS / EBK / EPRA)",
      done: hasVerifiedLicense,
      hint: "Required for licensed trades to reach T3 (License Verified) and unlock high-value leads.",
    });
  }

  // Elite pro requirements
  const isRatingHigh = Number(profile.rating || 0) >= 4.7;
  const hasEnoughReviews = (profile.reviewCount || 0) >= 15;
  const hasCompletedProjects = (profile.completedProjects || 0) >= 10;
  const isInsured = profile.isInsured;

  const eliteChecklist = [
    {
      label: "Star Rating ≥ 4.7★",
      done: isRatingHigh,
      value: `${profile.rating || 0}★`,
    },
    {
      label: "Review Count ≥ 15",
      done: hasEnoughReviews,
      value: `${profile.reviewCount || 0}/15`,
    },
    {
      label: "Completed Projects ≥ 10",
      done: hasCompletedProjects,
      value: `${profile.completedProjects || 0}/10`,
    },
    {
      label: "Professional Indemnity / Liability Insurance",
      done: isInsured,
      value: isInsured ? "Active" : "Not set",
    },
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-8 font-sans pb-12">
      {/* Top Header */}
      <div className="p-6 bg-[#FAF9F5] border border-[#DFDACB] rounded-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-mono uppercase tracking-wider text-neutral-500">
            Credibility & Governance
          </span>
          <h1 className="text-2xl font-extrabold text-[#16233B] tracking-tight">
            Trust & Verification Status
          </h1>
          <p className="text-sm text-neutral-600 mt-1">
            Trust tiers are earned and non-purchasable. They determine candidate
            eligibility and marketplace ranking.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <TrustSealBadge
            tier={currentTier}
            authority={activeLicense?.authority || undefined}
            licenseNumber={activeLicense?.licenseNumber || undefined}
            size="lg"
          />
          {profile.isInsured && <InsuredIndicator isInsured={true} size="md" />}
        </div>
      </div>

      {/* License Expiry Warning Alert (NCA 60-day rule) */}
      {isNcaExpiringSoon && (
        <div className="p-4 bg-[#FFF8E6] border border-[#F2D18B] rounded-lg text-sm text-[#8C4600] flex items-start gap-3">
          <span className="text-xl">⚠️</span>
          <div>
            <strong className="block font-bold">
              {activeLicense?.authority || "Regulator"} License Expiring Soon (
              {daysUntilLicenseExpiry} days remaining)
            </strong>
            <span>
              Your annual license renewal and CPD points must be logged before
              expiry to prevent automated demotion to Skills Verified.
            </span>
          </div>
        </div>
      )}

      {isLicenseExpired && (
        <div className="p-4 bg-[#FDF2F0] border border-[#F5C2BC] rounded-lg text-sm text-[#A8452B] flex items-start gap-3">
          <span className="text-xl">🚨</span>
          <div>
            <strong className="block font-bold">License Expired</strong>
            <span>
              Your regulator license expired. Please upload your renewed annual
              certificate to restore your License Verified seal.
            </span>
          </div>
        </div>
      )}

      {/* Trust Ladder Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Card 1: Current Status & Next Steps */}
        <div className="p-6 bg-[#FAF9F5] border border-[#DFDACB] rounded-xl flex flex-col justify-between">
          <div>
            <h2 className="text-base font-bold text-[#16233B] border-b border-[#DFDACB] pb-3">
              Requirements for Next Tier
            </h2>
            <div className="space-y-4 mt-4">
              {missingRequirements.map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-start gap-3 text-sm p-3 bg-white border border-[#EAE6DC] rounded-lg"
                >
                  <span
                    className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                      item.done
                        ? "bg-[#3F6B4E] text-white"
                        : "bg-neutral-200 text-neutral-600"
                    }`}
                  >
                    {item.done ? "✓" : "○"}
                  </span>
                  <div>
                    <span
                      className={`font-semibold block ${
                        item.done
                          ? "text-[#3F6B4E] line-through"
                          : "text-[#16233B]"
                      }`}
                    >
                      {item.label}
                    </span>
                    <span className="text-xs text-neutral-500">
                      {item.hint}
                    </span>
                  </div>
                </div>
              ))}

              {missingRequirements.length === 0 && (
                <p className="text-sm text-[#3F6B4E] font-semibold">
                  ✓ You have fulfilled all core requirements for your tier!
                </p>
              )}
            </div>
          </div>

          <div className="pt-6 mt-6 border-t border-[#DFDACB] flex justify-between items-center">
            <Link
              href="/professional-portal/settings/credentials"
              className="px-4 py-2 bg-[#16233B] hover:bg-[#233557] text-[#FAF9F5] text-xs font-bold uppercase tracking-wider rounded transition-colors"
            >
              Upload Documents & Licenses
            </Link>
          </div>
        </div>

        {/* Card 2: Path to Elite Pro */}
        <div className="p-6 bg-[#FAF9F5] border border-[#DFDACB] rounded-xl">
          <div className="flex items-center justify-between border-b border-[#DFDACB] pb-3">
            <h2 className="text-base font-bold text-[#16233B]">
              T4 · Elite Pro Qualification
            </h2>
            <span className="text-xs font-mono font-bold text-[#A8452B] bg-[#FFF8E6] px-2 py-0.5 rounded border border-[#F5D89D]">
              Highest Trust Tier
            </span>
          </div>

          <p className="text-xs text-neutral-600 mt-2 mb-4">
            Elite Pros get priority marketplace lead distribution, custom
            enterprise routing, and the official Brick Engraved Seal.
          </p>

          <div className="space-y-3">
            {eliteChecklist.map((item, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between text-xs p-2.5 bg-white border border-[#EAE6DC] rounded"
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold ${
                      item.done
                        ? "bg-[#3F6B4E] text-white"
                        : "bg-neutral-200 text-neutral-500"
                    }`}
                  >
                    {item.done ? "✓" : "•"}
                  </span>
                  <span className="font-medium text-[#16233B]">
                    {item.label}
                  </span>
                </div>
                <span className="font-mono font-bold text-neutral-700">
                  {item.value}
                </span>
              </div>
            ))}
          </div>

          <div className="mt-4 p-3 bg-[#F0EFEB] rounded border border-[#DFDACB] text-[11px] text-neutral-600">
            ℹ️ Elite Pro status is evaluated automatically every 30 days via
            background BullMQ sweeps.
          </div>
        </div>
      </div>
    </div>
  );
}
