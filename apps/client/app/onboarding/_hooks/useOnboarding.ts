import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUser, useClerk } from "@clerk/nextjs";
import { toast } from "react-toastify";
import { OnboardingData } from "@build/types";
import { onboardingClient } from "@/lib/onboarding-client";
import { ROUTES } from "@/lib/links";

/** Clerk public metadata structure for onboarded users */
interface ClerkPublicMetadata {
  isOnboarded?: boolean;
  role?: "client" | "professional";
  profileId?: string;
}

export type UserRole = "client" | "professional";

const MAX_METADATA_RETRIES = 5;
const METADATA_RETRY_DELAY = 300;

export function useOnboarding() {
  const { user, isLoaded: userLoaded } = useUser();
  const { signOut } = useClerk();
  const router = useRouter();

  const [step, setStep] = useState(1);
  const [role, setRole] = useState<UserRole | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);

  // Redirect if user is already onboarded
  useEffect(() => {
    if (!userLoaded || !user) return;
    const metadata = user.publicMetadata as ClerkPublicMetadata;

    if (metadata?.isOnboarded) {
      const dashboardPath =
        user.publicMetadata.role === "PROFESSIONAL" ||
        user.publicMetadata.role === "professional"
          ? ROUTES.professionalDashboard
          : ROUTES.userDashboard;
      router.replace(dashboardPath);
    }
  }, [userLoaded, user, router]);

  const waitForMetadataPropagation = useCallback(async (): Promise<boolean> => {
    if (!user) return false;

    for (let attempt = 0; attempt < MAX_METADATA_RETRIES; attempt++) {
      try {
        await user.reload();
        const metadata = user.publicMetadata as ClerkPublicMetadata;
        if (metadata?.isOnboarded) return true;

        if (attempt < MAX_METADATA_RETRIES - 1) {
          await new Promise((resolve) =>
            setTimeout(resolve, METADATA_RETRY_DELAY * Math.pow(1.5, attempt)),
          );
        }
      } catch (error) {
        console.error("Error reloading user:", error);
      }
    }
    return false;
  }, [user]);

  const navigateToDashboard = useCallback(
    async (targetRole: UserRole) => {
      const dashboardPath =
        targetRole === "professional"
          ? ROUTES.professionalDashboard
          : ROUTES.userDashboard;

      const metadataReady = await waitForMetadataPropagation();

      if (metadataReady) {
        router.push(dashboardPath);
      } else {
        router.refresh();
        router.push(dashboardPath);
      }
    },
    [router, waitForMetadataPropagation],
  );

  const handleRoleSelect = (selectedRole: UserRole) => {
    setRole(selectedRole);
    setStep(2);
  };

  const handleCancelOnboarding = async () => {
    toast.info("Onboarding cancelled. Signing out...");
    await signOut({ redirectUrl: "/" });
  };

  const handleSkip = async (roleToSkip: UserRole) => {
    setSubmitting(true);
    try {
      const result =
        roleToSkip === "client"
          ? await onboardingClient.skipClient()
          : await onboardingClient.skipProfessional();

      if (!result.success) {
        throw new Error(result.error || "Failed to skip onboarding");
      }

      toast.info(
        `Welcome! Redirecting to your ${roleToSkip === "professional" ? "professional " : ""}dashboard...`,
      );
      await navigateToDashboard(roleToSkip);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Something went wrong.",
      );
      setSubmitting(false);
    }
  };

  const handleSubmit = async (data: OnboardingData) => {
    setSubmitting(true);
    try {
      // Store creation is now handled within submit POST route
      const result = await onboardingClient.submit({
        clerkId: user?.id,
        ...data,
      });

      if (!result.success) {
        throw new Error(result.error || "Failed to complete onboarding");
      }

      toast.success("Profile created! Redirecting...");
      await navigateToDashboard(role || "client"); // Fallback to client if role is null (shouldn't be)
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Submission failed.",
      );
      setSubmitting(false);
    }
  };

  return {
    step,
    setStep, // Exposed to allow "Back" functionality
    role,
    setRole,
    submitting,
    showCancelDialog,
    setShowCancelDialog,
    handleRoleSelect,
    handleCancelOnboarding,
    handleSkip,
    handleSubmit,
    userLoaded,
  };
}
