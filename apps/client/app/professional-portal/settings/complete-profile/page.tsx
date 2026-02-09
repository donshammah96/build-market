"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft, Shield, BadgeCheck, Users, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import ProfessionalForm from "@/components/forms/ProfessionalForm";
import {
  useProfileStatus,
  ProfessionalProfileData,
} from "@/hooks/useProfileStatus";
import { ProfessionalWizardData } from "@/components/forms/professional-wizard";
import { ProfessionalOnboardingData } from "@build/types";
import { API_ROUTES } from "@/lib/links";

// ============================================================================
// BENEFITS SECTION
// ============================================================================

const VERIFICATION_BENEFITS = [
  {
    icon: BadgeCheck,
    title: "Verified Badge",
    description: "Stand out with a trust badge on your profile",
  },
  {
    icon: Users,
    title: "Priority Leads",
    description: "Get matched with high-quality project opportunities",
  },
  {
    icon: Shield,
    title: "Build Trust",
    description: "Clients prefer verified professionals",
  },
];

function BenefitsHeader() {
  return (
    <div className="mb-8 p-6 bg-gradient-to-r from-emerald-50 to-teal-50 rounded-xl border border-emerald-100">
      <h2 className="text-lg font-semibold text-zinc-900 mb-2">
        Complete your profile to unlock these benefits
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
        {VERIFICATION_BENEFITS.map((benefit, index) => (
          <motion.div
            key={benefit.title}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="flex items-start gap-3 p-3 bg-white/60 rounded-lg"
          >
            <div className="p-2 bg-emerald-100 rounded-lg shrink-0">
              <benefit.icon className="h-4 w-4 text-emerald-600" />
            </div>
            <div>
              <p className="font-medium text-sm text-zinc-900">
                {benefit.title}
              </p>
              <p className="text-xs text-zinc-500">{benefit.description}</p>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// LOADING SKELETON
// ============================================================================

function PageSkeleton() {
  return (
    <div className="min-h-screen bg-zinc-50/50">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <Skeleton className="h-10 w-48 mb-6" />
        <Skeleton className="h-8 w-96 mb-2" />
        <Skeleton className="h-4 w-64 mb-8" />
        <Skeleton className="h-32 w-full rounded-xl mb-8" />
        <Skeleton className="h-16 w-full rounded-xl mb-4" />
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    </div>
  );
}

// ============================================================================
// MAIN PAGE COMPONENT
// ============================================================================

export default function CompleteProfessionalProfilePage() {
  const router = useRouter();
  const { user, profile, completion, isLoading, refetch } = useProfileStatus();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Redirect if profile is already complete
  useEffect(() => {
    if (!isLoading && completion?.isComplete) {
      toast.success("Your profile is already complete!");
      router.push("/professional-portal/dashboard");
    }
  }, [completion, isLoading, router]);

  // Convert existing profile data to wizard format
  const getInitialData = (): Partial<ProfessionalWizardData> | undefined => {
    if (!profile) return undefined;

    const proProfile = profile as ProfessionalProfileData;

    return {
      profession: proProfile.companyName ? "other" : "", // Will be updated by user
      companyName: proProfile.companyName || "",
      licenseNumber: proProfile.licenseNumber || "",
      yearsExperience: proProfile.yearsExperience || undefined,
      website: proProfile.website || "",
      bio: proProfile.bio || "",
      certificates: [],
      idDocuments: [],
    };
  };

  // Handle wizard submission
  // The wizard passes extended data including storeData and earbNumber
  const handleSubmit = async (data: ProfessionalOnboardingData & { storeData?: unknown; earbNumber?: string }) => {
    setIsSubmitting(true);

    try {
      const response = await fetch(API_ROUTES.profileComplete, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          profession: data.profession,
          companyName: data.companyName,
          licenseNumber: data.licenseNumber,
          yearsExperience: data.yearsExperience,
          website: data.website,
          bio: data.bio,
          earbNumber: data.earbNumber,
          storeData: data.storeData,
          certificatesUrls: data.certificatesUrls,
          idDocumentsUrls: data.idDocumentsUrls,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to complete profile");
      }

      // Refetch profile status to update UI
      await refetch();

      return;
    } catch (error) {
      console.error("Profile completion error:", error);
      throw error;
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle successful completion
  const handleSuccess = () => {
    toast.success("Profile completed successfully!");
    router.push("/professional-portal/dashboard");
  };

  // Loading state
  if (isLoading) {
    return <PageSkeleton />;
  }

  // Ensure user exists
  if (!user) {
    return (
      <div className="min-h-screen bg-zinc-50/50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-500 mx-auto mb-4" />
          <p className="text-zinc-500">Loading your profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50/50">
      <main className="container mx-auto px-4 md:px-8 py-8 max-w-4xl">
        {/* Back button */}
        <Button
          variant="ghost"
          className="mb-6 -ml-2 text-zinc-600 hover:text-zinc-900"
          onClick={() => router.push("/professional-portal/dashboard")}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Dashboard
        </Button>

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <h1 className="text-3xl font-bold text-zinc-900 tracking-tight">
            Complete Your Professional Profile
          </h1>
          <p className="text-zinc-500 mt-2">
            Fill in the details below to verify your profile and start receiving
            leads.
          </p>
        </motion.div>

        {/* Benefits */}
        <BenefitsHeader />

        {/* Progress indicator (if partially complete) */}
        {completion && completion.percentage > 0 && !completion.isComplete && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg"
          >
            <div className="flex items-center justify-between">
              <p className="text-sm text-amber-800">
                <span className="font-medium">
                  {completion.percentage}% complete
                </span>
                {" — "}
                {completion.missingRequiredLabels?.slice(0, 3).join(", ")}
                {completion.missingRequiredLabels &&
                  completion.missingRequiredLabels.length > 3 &&
                  ` and ${completion.missingRequiredLabels.length - 3} more`}
              </p>
            </div>
          </motion.div>
        )}

        {/* Wizard Form */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-6 md:p-8"
        >
          <ProfessionalForm
            mode="completion"
            variant="light"
            initialData={getInitialData()}
            onSubmit={handleSubmit}
            onSuccess={handleSuccess}
          />
        </motion.div>

        {/* Loading overlay */}
        {isSubmitting && (
          <div className="fixed inset-0 bg-white/80 backdrop-blur-sm z-50 flex items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
              <span className="text-emerald-600 font-medium">
                Updating your profile...
              </span>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
