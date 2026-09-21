import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@build/db";
import {
  Clock3,
  ShieldCheck,
  CheckCircle2,
  FileText,
  User,
  Loader2,
  Lock,
  Unlock,
  AlertCircle,
  ExternalLink,
  Mail,
  Settings,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

// ============================================================================
// DATA FETCHING
// ============================================================================

type VerificationData = {
  companyName: string;
  profession: string | null;
  verificationStatus: string;
  verificationNotes: string | null;
  createdAt: Date;
  hasDocuments: boolean;
  hasLicense: boolean;
  isProfileComplete: boolean;
};

async function getVerificationData(): Promise<VerificationData | null> {
  const { userId } = await auth();
  if (!userId) return null;

  const user = await prisma.user.findUnique({
    where: { clerkId: userId },
    select: {
      id: true,
      isProfileComplete: true,
      professionalProfile: {
        select: {
          companyName: true,
          profession: true,
          verificationStatus: true,
          verificationNotes: true,
          createdAt: true,
          documents: { select: { id: true }, take: 1 },
          licenses: { select: { id: true }, take: 1 },
        },
      },
    },
  });

  if (!user?.professionalProfile) return null;

  const profile = user.professionalProfile;
  return {
    companyName: profile.companyName,
    profession: profile.profession,
    verificationStatus: profile.verificationStatus,
    verificationNotes: profile.verificationNotes,
    createdAt: profile.createdAt,
    hasDocuments: profile.documents.length > 0,
    hasLicense: profile.licenses.length > 0,
    isProfileComplete: user.isProfileComplete,
  };
}

// ============================================================================
// CAPABILITY DISPLAY
// ============================================================================

type CapabilityItem = {
  label: string;
  locked: boolean;
  icon: typeof Lock;
};

function getCapabilityList(verificationStatus: string): CapabilityItem[] {
  const isVerified = verificationStatus === "VERIFIED";

  return [
    {
      label: "Edit your profile",
      locked: false,
      icon: Unlock,
    },
    {
      label: "Access settings",
      locked: false,
      icon: Unlock,
    },
    {
      label: "Appear in search results",
      locked: !isVerified,
      icon: isVerified ? Unlock : Lock,
    },
    {
      label: "Receive client leads",
      locked: !isVerified,
      icon: isVerified ? Unlock : Lock,
    },
    {
      label: "Create and send quotes",
      locked: !isVerified,
      icon: isVerified ? Unlock : Lock,
    },
    {
      label: "List store items",
      locked: !isVerified,
      icon: isVerified ? Unlock : Lock,
    },
    {
      label: "Manage finances",
      locked: !isVerified,
      icon: isVerified ? Unlock : Lock,
    },
  ];
}

// ============================================================================
// CHECKLIST
// ============================================================================

type ChecklistItem = {
  label: string;
  done: boolean;
  icon: typeof CheckCircle2;
};

function getChecklist(data: VerificationData): ChecklistItem[] {
  return [
    {
      label: "Professional profile submitted",
      done: true,
      icon: CheckCircle2,
    },
    {
      label: "Verification documents uploaded",
      done: data.hasDocuments,
      icon: data.hasDocuments ? CheckCircle2 : AlertCircle,
    },
    {
      label: "Professional license registered",
      done: data.hasLicense,
      icon: data.hasLicense ? CheckCircle2 : AlertCircle,
    },
    {
      label: "Verification review complete",
      done: data.verificationStatus === "VERIFIED",
      icon: data.verificationStatus === "VERIFIED" ? CheckCircle2 : Loader2,
    },
  ];
}

// ============================================================================
// PAGE COMPONENT
// ============================================================================

export default async function ProfessionalPendingVerificationPage() {
  const data = await getVerificationData();

  if (!data) {
    return (
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-10 sm:px-6 lg:px-8">
        <Card>
          <CardContent className="py-8 text-center text-zinc-500">
            <p>Unable to load verification status. Please try refreshing.</p>
          </CardContent>
        </Card>
      </main>
    );
  }

  const checklist = getChecklist(data);
  const capabilities = getCapabilityList(data.verificationStatus);
  const submittedDate = data.createdAt.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const isNeedsChanges = data.verificationStatus === "NEEDS_CHANGES";
  const isRejected = data.verificationStatus === "REJECTED";

  return (
    <main
      className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-10 sm:px-6 lg:px-8"
      aria-label="Verification status"
    >
      {/* Header Card */}
      <Card className="border-amber-200 bg-amber-50/60">
        <CardHeader className="space-y-3">
          <div className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-amber-100 text-amber-700">
            <Clock3 className="h-6 w-6" aria-hidden="true" />
          </div>
          <CardTitle className="text-2xl font-semibold text-zinc-900">
            {isRejected
              ? "Verification not approved"
              : isNeedsChanges
                ? "Changes requested"
                : "Verification in progress"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-zinc-700">
          <p>
            {isRejected
              ? "Your professional application was not approved. Please review the notes below and contact support if you have questions."
              : isNeedsChanges
                ? "Our verification team has requested some changes to your application. Please review the notes below and update your profile."
                : "Your professional onboarding details were submitted successfully. Your account is now waiting for verification before full portal access is enabled."}
          </p>

          {/* Submission timestamp */}
          <div className="flex items-center gap-2 text-sm text-zinc-500">
            <FileText className="h-4 w-4" aria-hidden="true" />
            <span>Application submitted on {submittedDate}</span>
          </div>

          {/* SLA notice */}
          {!isRejected && (
            <div className="rounded-lg border border-amber-200 bg-white p-4">
              <p className="flex items-start gap-2 text-sm">
                <ShieldCheck
                  className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600"
                  aria-hidden="true"
                />
                <span>
                  Verification typically takes{" "}
                  <strong>1–3 business days</strong>. We review qualifications
                  and submitted documents to protect clients and maintain
                  marketplace trust. You&apos;ll receive an email notification
                  when your status changes.
                </span>
              </p>
            </div>
          )}

          {/* Verification notes from admin */}
          {data.verificationNotes && (
            <div
              className={`rounded-lg border p-4 ${
                isRejected
                  ? "border-red-200 bg-red-50"
                  : "border-amber-300 bg-amber-50"
              }`}
            >
              <h3 className="mb-1 text-sm font-semibold text-zinc-800">
                Reviewer notes:
              </h3>
              <p className="text-sm text-zinc-700">{data.verificationNotes}</p>
              {isNeedsChanges && (
                <div className="mt-3">
                  <Button
                    asChild
                    size="sm"
                    className="bg-amber-600 text-white hover:bg-amber-700"
                  >
                    <Link href="/professional-portal/settings/complete-profile">
                      Update Profile & Documents
                      <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
                    </Link>
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Checklist Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg font-semibold text-zinc-900">
            <CheckCircle2
              className="h-5 w-5 text-emerald-600"
              aria-hidden="true"
            />
            Submission Checklist
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-3" aria-label="Verification checklist">
            {checklist.map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.label} className="flex items-center gap-3">
                  <Icon
                    className={`h-5 w-5 shrink-0 ${
                      item.done
                        ? "text-emerald-600"
                        : item.icon === Loader2
                          ? "animate-spin text-amber-500"
                          : "text-zinc-400"
                    }`}
                    aria-hidden="true"
                  />
                  <span
                    className={`text-sm ${
                      item.done ? "font-medium text-zinc-800" : "text-zinc-500"
                    }`}
                  >
                    {item.label}
                  </span>
                  {item.done && <span className="sr-only"> — completed</span>}
                </li>
              );
            })}
          </ul>

          {/* Missing items CTA */}
          {(!data.hasDocuments || !data.hasLicense) && (
            <div className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50 p-3">
              <p className="text-sm text-zinc-600">
                Missing items? You can update your profile to add documents or
                credentials.
              </p>
              <Button asChild size="sm" variant="outline" className="mt-2">
                <Link href="/professional-portal/settings/complete-profile">
                  Complete Profile
                  <ExternalLink className="ml-1 h-3 w-3" />
                </Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Capabilities Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg font-semibold text-zinc-900">
            <ShieldCheck className="h-5 w-5 text-zinc-600" aria-hidden="true" />
            Feature Access
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-4 text-sm text-zinc-500">
            Some features are restricted until your account is verified.
          </p>
          <ul className="space-y-2" aria-label="Feature access list">
            {capabilities.map((cap) => {
              const Icon = cap.icon;
              return (
                <li key={cap.label} className="flex items-center gap-3">
                  <Icon
                    className={`h-4 w-4 shrink-0 ${
                      cap.locked ? "text-zinc-400" : "text-emerald-600"
                    }`}
                    aria-hidden="true"
                  />
                  <span
                    className={`text-sm ${
                      cap.locked ? "text-zinc-400" : "font-medium text-zinc-700"
                    }`}
                  >
                    {cap.label}
                  </span>
                  {cap.locked && (
                    <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-500">
                      After verification
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>

      {/* Actions Card */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-3">
            <Button asChild>
              <Link href="/professional-portal/profile">
                <User className="mr-2 h-4 w-4" />
                Review Profile
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/professional-portal/settings">
                <Settings className="mr-2 h-4 w-4" />
                Open Settings
              </Link>
            </Button>
          </div>

          {/* Support contact */}
          <div className="mt-6 rounded-lg border border-zinc-100 bg-zinc-50/50 p-4">
            <h3 className="mb-1 text-sm font-semibold text-zinc-700">
              Need help?
            </h3>
            <p className="text-sm text-zinc-500">
              If you have questions about the verification process or need to
              update your submitted documents, contact our support team.
            </p>
            <a
              href="mailto:support@buildmarket.app"
              className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-700"
            >
              <Mail className="h-4 w-4" />
              support@buildmarket.app
            </a>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
