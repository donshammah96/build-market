import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import {
  readOnboardingNoJsSession,
  setOnboardingNoJsRole,
} from "@/app/lib/infrastructure/onboarding-nojs-session";
import { ROUTES } from "@/lib/links";

type NoJsRolePageProps = {
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

function rolePageErrorMessage(
  errorCode: string | undefined,
): string | undefined {
  if (!errorCode) {
    return undefined;
  }

  if (errorCode === "invalid_role") {
    return "Please choose either Client or Professional.";
  }

  return "Could not continue. Please try again.";
}

export default async function OnboardingNoJsRolePage({
  searchParams,
}: NoJsRolePageProps) {
  const { userId } = await auth();
  if (!userId) {
    redirect(noJsSignInUrl());
  }

  const resolvedSearchParams = await searchParams;
  const session = await readOnboardingNoJsSession();
  const selectedRole = session?.role ?? "client";
  const errorMessage = rolePageErrorMessage(
    parseQueryParam(resolvedSearchParams?.error),
  );

  async function selectRole(formData: FormData) {
    "use server";

    const { userId: actionUserId } = await auth();
    if (!actionUserId) {
      redirect(noJsSignInUrl());
    }

    const submittedRole = formData.get("role");
    if (submittedRole !== "client" && submittedRole !== "professional") {
      redirect("/onboarding/no-js?error=invalid_role");
    }

    await setOnboardingNoJsRole(submittedRole);
    redirect(
      submittedRole === "professional"
        ? "/onboarding/no-js/professional"
        : "/onboarding/no-js/client",
    );
  }

  return (
    <main className="mx-auto max-w-2xl p-6">
      <form action={selectRole} className="space-y-4 rounded-lg border p-6">
        <h1 className="text-2xl font-semibold">
          Onboarding Without JavaScript
        </h1>
        <p className="text-sm text-muted-foreground">
          Choose your role to continue with the server-rendered onboarding flow.
        </p>

        {errorMessage ? (
          <p className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
            {errorMessage}
          </p>
        ) : null}

        <div className="space-y-1">
          <label htmlFor="role" className="text-sm font-medium">
            Role
          </label>
          <select
            id="role"
            name="role"
            defaultValue={selectedRole}
            className="w-full rounded border px-3 py-2"
            required
          >
            <option value="client">Client</option>
            <option value="professional">Professional</option>
          </select>
        </div>

        <button
          type="submit"
          className="inline-flex rounded bg-black px-4 py-2 text-sm font-medium text-white"
        >
          Continue
        </button>
      </form>
    </main>
  );
}
