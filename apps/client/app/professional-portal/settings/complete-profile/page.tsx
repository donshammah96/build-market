"use client";

import { useProfileStatus } from "@/hooks/useProfileStatus";
import ProfessionalForm from "@/components/forms/ProfessionalForm";
import { ProfessionalOnboardingData } from "@build/types";
import { Loader2 } from "lucide-react";
import { profileClient } from "@/lib/facades/profile-client";
import { useRouter } from "next/navigation";
import { ProfessionalProfileData } from "@/hooks/useProfileStatus";
import type { ProfessionalWizardData } from "@/components/forms/professional-wizard";

function isProfessionalProfileData(
  profile: unknown,
): profile is ProfessionalProfileData {
  return (
    typeof profile === "object" &&
    profile !== null &&
    "companyName" in profile &&
    "profession" in profile
  );
}

function buildInitialData(profile: unknown): Partial<ProfessionalWizardData> {
  if (!isProfessionalProfileData(profile)) {
    return {};
  }

  return {
    profession: profile.profession || "",
    companyName: profile.companyName || "",
    licenseNumber: profile.licenseNumber || "",
    yearsExperience: profile.yearsExperience || 0,
    website: profile.website || "",
    bio: profile.bio || "",
  };
}

export default function CompleteProfilePage() {
  const { profile, isLoading } = useProfileStatus();
  const router = useRouter();

  const handleSubmit = async (data: ProfessionalOnboardingData) => {
    try {
      const res = await profileClient.completeProfile(data);
      if (!res.success) {
        throw new Error(res.error || "Failed to update profile");
      }
    } catch (error) {
      console.error("Failed to complete profile", error);
      throw error; // Re-throw so ProfessionalForm handles the error UI
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-zinc-500" />
      </div>
    );
  }

  const initialData = buildInitialData(profile);

  return (
    <div className="py-10 px-4">
      <div className="max-w-2xl mx-auto mb-8 text-center">
        <h1 className="text-3xl font-bold text-zinc-900 mb-2">
          Complete Your Profile
        </h1>
        <p className="text-zinc-600">
          Please provide the missing details to verify your professional
          account.
        </p>
      </div>

      <ProfessionalForm
        mode="completion"
        variant="light"
        initialData={initialData}
        onSubmit={handleSubmit}
        onSuccess={() => {
          router.refresh();
          // Form handles navigation/success UI
        }}
      />
    </div>
  );
}
