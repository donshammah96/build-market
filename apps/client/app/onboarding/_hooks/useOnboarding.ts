import { useState, useCallback, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useUser, useClerk } from "@clerk/nextjs";
import { toast } from "react-toastify";
import { OnboardingData } from "@build/types";
import { onboardingClient } from "@/lib/onboarding-client";
import { ROUTES } from "@/lib/links";
import { useOnboardingAnalytics } from "@/lib/analytics/OnboardingAnalyticsContext";
import { normalizeRole } from "@/app/lib/security/roles";

export const SECURITY_PERSISTENCE_ALLOWLIST = [
  "onboarding_* draft keys",
  "professional_*draft* keys",
];

/** Clear all onboarding draft keys from sessionStorage (call on logout) */
export function clearOnboardingDrafts(): void {
  if (typeof window === "undefined") return;
  const keysToRemove: string[] = [];
  for (let i = 0; i < sessionStorage.length; i++) {
    const key = sessionStorage.key(i);
    if (
      key &&
      (key.startsWith("onboarding_") ||
        (key.startsWith("professional_") && key.includes("draft")))
    ) {
      keysToRemove.push(key);
    }
  }
  keysToRemove.forEach((k) => sessionStorage.removeItem(k));
}

/** Clerk public metadata structure for onboarded users */
interface ClerkPublicMetadata {
  isOnboarded?: boolean;
  role?: unknown;
  profileId?: string;
}

export type UserRole = "client" | "professional";

const MAX_METADATA_RETRIES = 5;
const METADATA_RETRY_DELAY = 300;
const MIN_ONBOARDING_STEP = 1;
const MAX_ONBOARDING_STEP = 2;

const ONBOARDING_STEP_PARAM = "step";
const ONBOARDING_ROLE_PARAM = "role";

function isStepWithinBounds(step: number): boolean {
  return (
    Number.isInteger(step) &&
    step >= MIN_ONBOARDING_STEP &&
    step <= MAX_ONBOARDING_STEP
  );
}

export function useOnboarding() {
  const { user, isLoaded: userLoaded } = useUser();
  const { signOut } = useClerk();
  const router = useRouter();
  const searchParams = useSearchParams();
  const analytics = useOnboardingAnalytics();

  const [step, setStep] = useState(1);
  const [role, setRole] = useState<UserRole | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);

  // Sync step/role with URL params (read on mount only, no SSR access)
  useEffect(() => {
    const stepParam = searchParams.get(ONBOARDING_STEP_PARAM);
    const roleParam = searchParams.get(ONBOARDING_ROLE_PARAM);
    if (stepParam) {
      const s = parseInt(stepParam, 10);
      if (isStepWithinBounds(s)) setStep(s);
    }
    if (roleParam === "client" || roleParam === "professional") {
      setRole(roleParam);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- only on mount

  // Write step/role to URL when they change (skip initial mount to avoid overwriting URL-restored state)
  const isInitialMount = useRef(true);
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    const params = new URLSearchParams();
    params.set(ONBOARDING_STEP_PARAM, String(step));
    if (role) params.set(ONBOARDING_ROLE_PARAM, role);
    router.replace(`/onboarding?${params.toString()}`, { scroll: false });
  }, [step, role, router]);

  // Redirect unauthenticated users to sign-in (covers BYPASS_AUTH dev scenario)
  useEffect(() => {
    if (!userLoaded) return;
    if (!user) {
      const signInUrl = `${ROUTES.signIn}?redirect_url=${encodeURIComponent("/onboarding")}`;
      router.replace(signInUrl);
      return;
    }
  }, [userLoaded, user, router]);

  // Redirect if user is already onboarded
  useEffect(() => {
    if (!userLoaded || !user) return;
    const metadata = user.publicMetadata as ClerkPublicMetadata;
    const normalizedRole = normalizeRole(metadata?.role);

    if (metadata?.isOnboarded) {
      const dashboardPath =
        normalizedRole === "PROFESSIONAL"
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
        void error;
        analytics.trackAsyncValidationFailure("metadata_reload");

        if (attempt < MAX_METADATA_RETRIES - 1) {
          await new Promise((resolve) =>
            setTimeout(resolve, METADATA_RETRY_DELAY * Math.pow(1.5, attempt)),
          );
        }
      }
    }
    return false;
  }, [analytics, user]);

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
    analytics.trackStepCompleted("role_selection", selectedRole);
    setRole(selectedRole);
    setStep(2);
  };

  const handleCancelOnboarding = async () => {
    clearOnboardingDrafts();
    toast.info("Onboarding cancelled. Signing out...");
    await signOut({ redirectUrl: "/" });
    // Fallback: if signOut didn't redirect (e.g. no session with BYPASS_AUTH), navigate manually
    router.replace("/");
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

      analytics.trackStepCompleted("skip", roleToSkip);
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
      const result = await onboardingClient.submit(data);

      if (!result.success) {
        throw new Error(result.error || "Failed to complete onboarding");
      }

      analytics.trackStepCompleted("form_submit", role || "client");
      toast.success("Profile created! Redirecting...");
      await navigateToDashboard(role || "client"); // Fallback to client if role is null (shouldn't be)
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Submission failed.",
      );
      setSubmitting(false);
    }
  };

  const jumpToStep = useCallback((index: number) => {
    if (isStepWithinBounds(index)) setStep(index);
  }, []);

  return {
    step,
    setStep,
    jumpToStep,
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
