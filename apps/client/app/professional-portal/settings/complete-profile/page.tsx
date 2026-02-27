"use client";

import { useProfileStatus } from "@/hooks/useProfileStatus";
import ProfessionalForm from "@/components/forms/ProfessionalForm";
import { ProfessionalOnboardingData } from "@build/types";
import { Loader2 } from "lucide-react";
import { profileClient } from "@/lib/profile-client";
import { useRouter } from "next/navigation";
import { ProfessionalProfileData } from "@/hooks/useProfileStatus";

export default function CompleteProfilePage() {
  const { profile, isLoading } = useProfileStatus();
  const router = useRouter();

  const handleSubmit = async (data: ProfessionalOnboardingData) => {
    try {
      // Map ProfessionalOnboardingData to the shape expected by completeProfessionalProfileAction
      // We need to cast or transform because existing types might mismatch slightly
      const payload = {
        profession: data.profession,
        companyName: data.companyName || "",
        licenseNumber: data.license?.licenseNumber,
        yearsExperience: data.yearsExperience ?? undefined,
        website: data.website,
        bio: data.bio,
        certificatesUrls: data.certificatesUrls,
        idDocumentsUrls: data.idDocumentsUrls,
        storeData: data.stores,
        propertyData: data.properties,
        boardRegistrationNumber: data.boardRegistrationNumber,
        license: data.license,
      };

      const res = await profileClient.completeProfile(payload);
      if (!res.success) {
        throw new Error(res.error || "Failed to update profile");
      }

      // Success is handled by the form component via onSuccess/return,
      // but here we just need to resolve promise.
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

  // Transform existing profile data to form initial data
  // Note: ProfessionalForm expects `ProfessionalWizardData`
  // mapping profile data to it.
  const initialData = profile
    ? {
        profession: (profile as ProfessionalProfileData).profession || "",
        companyName: (profile as ProfessionalProfileData).companyName || "",
        licenseNumber: (profile as ProfessionalProfileData).licenseNumber || "",
        yearsExperience:
          (profile as ProfessionalProfileData).yearsExperience || 0,
        website: (profile as ProfessionalProfileData).website || "",
        bio: (profile as ProfessionalProfileData).bio || "",
        // We can't pre-fill files, but we should pre-fill other fields if possible
        // existing docs aren't easily mapped back to 'File[]' but logic in form handles completion mode.
      }
    : {};

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
