import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import {
  skipOnboarding,
  skipProfessionalOnboarding,
  submitOnboarding,
} from "@/app/actions/onboarding";
import { NoJsReview } from "@/app/onboarding/no-js/_components/NoJsReview";
import {
  clearOnboardingNoJsSession,
  readOnboardingNoJsSession,
} from "@/app/lib/infrastructure/onboarding-nojs-session";
import { ROUTES } from "@/lib/links";

type NoJsReviewPageProps = {
  searchParams?: Promise<{
    error?: string | string[];
  }>;
};

function noJsSignInUrl(): string {
  return `${ROUTES.signIn}?redirect_url=${encodeURIComponent("/onboarding/no-js")}`;
}

function parseQueryParam(
  value: string | string[] | undefined,
): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

function reviewErrorMessage(errorCode: string | undefined): string | undefined {
  if (!errorCode) {
    return undefined;
  }

  switch (errorCode) {
    case "unauthorized":
      return "Please sign in again and retry.";
    case "conflict":
      return "An onboarding transition is already in progress.";
    case "invalid_input":
      return "Your onboarding data is invalid. Please review details.";
    case "invalid_state":
      return "Onboarding state is no longer valid. Restart the no-JS flow.";
    case "forbidden":
      return "You are not allowed to perform this onboarding transition.";
    case "not_found":
      return "User account was not found for onboarding.";
    case "internal":
      return "Unable to complete onboarding. Please retry.";
    default:
      return "Could not complete onboarding. Please retry.";
  }
}

export default async function OnboardingNoJsReviewPage({
  searchParams,
}: NoJsReviewPageProps) {
  const { userId } = await auth();
  if (!userId) {
    redirect(noJsSignInUrl());
  }

  const resolvedSearchParams = await searchParams;
  const session = await readOnboardingNoJsSession();
  if (!session?.role) {
    redirect("/onboarding/no-js");
  }

  if (session.role === "client" && !session.client) {
    redirect("/onboarding/no-js/client");
  }

  if (session.role === "professional" && !session.professional) {
    redirect("/onboarding/no-js/professional");
  }

  const errorMessage = reviewErrorMessage(
    parseQueryParam(resolvedSearchParams?.error),
  );

  async function submitFromNoJs(_formData: FormData) {
    "use server";

    const { userId: actionUserId } = await auth();
    if (!actionUserId) {
      redirect(noJsSignInUrl());
    }

    const currentSession = await readOnboardingNoJsSession();
    if (!currentSession || !currentSession.role) {
      redirect("/onboarding/no-js");
    }

    const payload =
      currentSession.role === "client"
        ? currentSession.client
          ? {
              role: "client" as const,
              type: currentSession.client.type,
              county: currentSession.client.county,
              ...(currentSession.client.city
                ? { city: currentSession.client.city }
                : {}),
              ...(currentSession.client.companyName
                ? { companyName: currentSession.client.companyName }
                : {}),
              ...(currentSession.client.projectType
                ? { projectType: currentSession.client.projectType }
                : {}),
              ...(currentSession.client.projectLocation
                ? { projectLocation: currentSession.client.projectLocation }
                : {}),
              ...(currentSession.client.estimatedBudget
                ? { estimatedBudget: currentSession.client.estimatedBudget }
                : {}),
              ...(currentSession.client.description
                ? { description: currentSession.client.description }
                : {}),
            }
          : null
        : currentSession.professional
          ? {
              role: "professional" as const,
              profession: currentSession.professional.profession,
              companyName: currentSession.professional.companyName,
              county: currentSession.professional.county,
              ...(currentSession.professional.city
                ? { city: currentSession.professional.city }
                : {}),
              ...(typeof currentSession.professional.yearsExperience ===
              "number"
                ? {
                    yearsExperience:
                      currentSession.professional.yearsExperience,
                  }
                : {}),
            }
          : null;

    if (!payload) {
      redirect(
        currentSession.role === "professional"
          ? "/onboarding/no-js/professional"
          : "/onboarding/no-js/client",
      );
    }

    const result = await submitOnboarding(payload);
    if (!result.success) {
      redirect(`/onboarding/no-js/review?error=${result.error.code}`);
    }

    await clearOnboardingNoJsSession();
    redirect(result.data.redirectTo);
  }

  async function skipFromNoJs(_formData: FormData) {
    "use server";

    const { userId: actionUserId } = await auth();
    if (!actionUserId) {
      redirect(noJsSignInUrl());
    }

    const currentSession = await readOnboardingNoJsSession();
    if (!currentSession || !currentSession.role) {
      redirect("/onboarding/no-js");
    }

    const result =
      currentSession.role === "professional"
        ? await skipProfessionalOnboarding()
        : await skipOnboarding();

    if (!result.success) {
      redirect(`/onboarding/no-js/review?error=${result.error.code}`);
    }

    await clearOnboardingNoJsSession();
    redirect(result.data.redirectTo);
  }

  return (
    <main className="mx-auto max-w-2xl p-6">
      <NoJsReview
        role={session.role}
        clientDraft={session.client}
        professionalDraft={session.professional}
        errorMessage={errorMessage}
        onSubmit={submitFromNoJs}
        onSkip={skipFromNoJs}
      />
    </main>
  );
}
