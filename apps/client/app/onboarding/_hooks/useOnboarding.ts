import { useState, useCallback, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth, useUser, useClerk } from "@clerk/nextjs";
import { toast } from "react-toastify";
import { OnboardingData } from "@build/types";
import { onboardingClient } from "@/lib/facades/onboarding-client";
import { ROUTES, dashboardForRole } from "@/lib/links";
import { useOnboardingAnalytics } from "@/lib/analytics/OnboardingAnalyticsContext";
import { normalizeRole } from "@/app/lib/security/roles";
import {
  CLERK_CLAIM_REFRESH_FAILURE_MESSAGE,
  hasExpectedOnboardingClaims,
  type ClerkPublicMetadataLike,
  waitForClerkClaimRefresh,
} from "@/app/lib/auth/clerk-claim-refresh";

export const SECURITY_PERSISTENCE_ALLOWLIST = [
  "onboarding_* draft keys",
  "professional_*draft* keys",
];

/** Clear all onboarding draft keys from sessionStorage (call on logout) */
export function clearOnboardingDrafts(): void {
  if (typeof window === "undefined") return;
  const keysToRemove: string[] = [];
  // SECURITY_PERSISTENCE_ALLOWLIST: Enumerates non-sensitive onboarding draft keys in sessionStorage.
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
  // SECURITY_PERSISTENCE_ALLOWLIST: Removes non-sensitive onboarding draft keys from sessionStorage.
  keysToRemove.forEach((k) => sessionStorage.removeItem(k));
}

export type UserRole = "client" | "professional";
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
  const { getToken } = useAuth();
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
    const metadata = user.publicMetadata as ClerkPublicMetadataLike;
    const normalizedRole = normalizeRole(metadata?.role);

    if (metadata?.isOnboarded) {
      router.replace(dashboardForRole(normalizedRole));
    }
  }, [userLoaded, user, router]);

  const waitForMetadataPropagation = useCallback(
    async (targetRole: UserRole): Promise<boolean> => {
      const result = await waitForClerkClaimRefresh({
        user,
        getToken,
        isReady: (metadata) =>
          hasExpectedOnboardingClaims(metadata, targetRole),
        onTransientFailure: () => {
          analytics.trackAsyncValidationFailure("metadata_reload");
        },
      });

      return result.ok;
    },
    [analytics, getToken, user],
  );

  const navigateToDashboard = useCallback(
    async (targetRole: UserRole) => {
      const dashboardPath = dashboardForRole(targetRole);

      const metadataReady = await waitForMetadataPropagation(targetRole);

      if (metadataReady) {
        router.push(dashboardPath);
      } else {
        toast.error(CLERK_CLAIM_REFRESH_FAILURE_MESSAGE);
        router.replace(
          `${ROUTES.authCallback}?transition=onboarding&expectedRole=${targetRole}`,
        );
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
      // Store and property creation is handled by shared onboarding orchestration.
      // Non-fatal side-effect failures are surfaced as response warnings.
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
