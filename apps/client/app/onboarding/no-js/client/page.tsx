import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { NoJsClientForm } from "@/app/onboarding/no-js/_components/NoJsClientForm";
import {
  readOnboardingNoJsSession,
  setOnboardingNoJsClientDraft,
} from "@/app/lib/infrastructure/onboarding-nojs-session";
import { ROUTES } from "@/lib/links";

type NoJsClientPageProps = {
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

function clientPageErrorMessage(
  errorCode: string | undefined,
): string | undefined {
  if (!errorCode) {
    return undefined;
  }

  if (errorCode === "missing_required") {
    return "Client type and county are required.";
  }

  return "Could not save your details. Please try again.";
}

function getOptionalString(
  formData: FormData,
  key: string,
  maxLength = 255,
): string | undefined {
  const value = formData.get(key);
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  return trimmed.slice(0, maxLength);
}

export default async function OnboardingNoJsClientPage({
  searchParams,
}: NoJsClientPageProps) {
  const { userId } = await auth();
  if (!userId) {
    redirect(noJsSignInUrl());
  }

  const resolvedSearchParams = await searchParams;
  const session = await readOnboardingNoJsSession();
  if (!session?.role) {
    redirect("/onboarding/no-js");
  }

  if (session.role === "professional") {
    redirect("/onboarding/no-js/professional");
  }

  const errorMessage = clientPageErrorMessage(
    parseQueryParam(resolvedSearchParams?.error),
  );

  async function saveClientDraft(formData: FormData) {
    "use server";

    const { userId: actionUserId } = await auth();
    if (!actionUserId) {
      redirect(noJsSignInUrl());
    }

    const type = getOptionalString(formData, "type", 60);
    const county = getOptionalString(formData, "county", 60);

    if (!type || !county) {
      redirect("/onboarding/no-js/client?error=missing_required");
    }

    await setOnboardingNoJsClientDraft({
      type,
      county,
      city: getOptionalString(formData, "city", 120),
      companyName: getOptionalString(formData, "companyName", 150),
      projectType: getOptionalString(formData, "projectType", 120),
      projectLocation: getOptionalString(formData, "projectLocation", 150),
      estimatedBudget: getOptionalString(formData, "estimatedBudget", 80),
      description: getOptionalString(formData, "description", 500),
    });

    redirect("/onboarding/no-js/review");
  }

  return (
    <main className="mx-auto max-w-2xl p-6">
      <NoJsClientForm
        defaultValues={session.client}
        errorMessage={errorMessage}
        onSubmit={saveClientDraft}
      />
    </main>
  );
}
