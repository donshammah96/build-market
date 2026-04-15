import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { NoJsProfessionalForm } from "@/app/onboarding/no-js/_components/NoJsProfessionalForm";
import {
  readOnboardingNoJsSession,
  setOnboardingNoJsProfessionalDraft,
} from "@/app/lib/infrastructure/onboarding-nojs-session";
import { ROUTES } from "@/lib/links";

type NoJsProfessionalPageProps = {
  searchParams?: {
    error?: string | string[];
  };
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

function professionalPageErrorMessage(
  errorCode: string | undefined,
): string | undefined {
  if (!errorCode) {
    return undefined;
  }

  if (errorCode === "missing_required") {
    return "Profession, company name, and county are required.";
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

function getOptionalNonNegativeInt(
  formData: FormData,
  key: string,
): number | undefined {
  const raw = getOptionalString(formData, key, 6);
  if (!raw) {
    return undefined;
  }

  const parsed = Number.parseInt(raw, 10);
  if (!Number.isInteger(parsed) || parsed < 0) {
    return undefined;
  }

  return parsed;
}

export default async function OnboardingNoJsProfessionalPage({
  searchParams,
}: NoJsProfessionalPageProps) {
  const { userId } = await auth();
  if (!userId) {
    redirect(noJsSignInUrl());
  }

  const session = await readOnboardingNoJsSession();
  if (!session?.role) {
    redirect("/onboarding/no-js");
  }

  if (session.role === "client") {
    redirect("/onboarding/no-js/client");
  }

  const errorMessage = professionalPageErrorMessage(
    parseQueryParam(searchParams?.error),
  );

  async function saveProfessionalDraft(formData: FormData) {
    "use server";

    const { userId: actionUserId } = await auth();
    if (!actionUserId) {
      redirect(noJsSignInUrl());
    }

    const profession = getOptionalString(formData, "profession", 80);
    const companyName = getOptionalString(formData, "companyName", 150);
    const county = getOptionalString(formData, "county", 60);

    if (!profession || !companyName || !county) {
      redirect("/onboarding/no-js/professional?error=missing_required");
    }

    await setOnboardingNoJsProfessionalDraft({
      profession,
      companyName,
      county,
      city: getOptionalString(formData, "city", 120),
      yearsExperience: getOptionalNonNegativeInt(formData, "yearsExperience"),
    });

    redirect("/onboarding/no-js/review");
  }

  return (
    <main className="mx-auto max-w-2xl p-6">
      <NoJsProfessionalForm
        defaultValues={session.professional}
        errorMessage={errorMessage}
        onSubmit={saveProfessionalDraft}
      />
    </main>
  );
}
