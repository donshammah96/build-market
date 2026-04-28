import type {
  NoJsClientDraft,
  NoJsOnboardingRole,
  NoJsProfessionalDraft,
} from "@/app/lib/infrastructure/onboarding-nojs-session";

type NoJsReviewProps = {
  role: NoJsOnboardingRole;
  clientDraft?: NoJsClientDraft;
  professionalDraft?: NoJsProfessionalDraft;
  errorMessage?: string;
  onSubmit: (formData: FormData) => Promise<void>;
  onSkip: (formData: FormData) => Promise<void>;
};

function roleLabel(role: NoJsOnboardingRole): string {
  return role === "professional" ? "Professional" : "Client";
}

export function NoJsReview({
  role,
  clientDraft,
  professionalDraft,
  errorMessage,
  onSubmit,
  onSkip,
}: NoJsReviewProps) {
  return (
    <section className="space-y-4 rounded-lg border p-6">
      <h1 className="text-2xl font-semibold">
        Review Onboarding (No JavaScript)
      </h1>
      <p className="text-sm text-muted-foreground">
        Confirm your details before submitting.
      </p>

      {errorMessage ? (
        <p className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
          {errorMessage}
        </p>
      ) : null}

      <dl className="space-y-2 rounded border bg-muted/40 p-4 text-sm">
        <div>
          <dt className="font-medium">Selected role</dt>
          <dd>{roleLabel(role)}</dd>
        </div>

        {role === "client" ? (
          <>
            <div>
              <dt className="font-medium">Client type</dt>
              <dd>{clientDraft?.type ?? "-"}</dd>
            </div>
            <div>
              <dt className="font-medium">County</dt>
              <dd>{clientDraft?.county ?? "-"}</dd>
            </div>
            <div>
              <dt className="font-medium">City</dt>
              <dd>{clientDraft?.city ?? "-"}</dd>
            </div>
            <div>
              <dt className="font-medium">Project type</dt>
              <dd>{clientDraft?.projectType ?? "-"}</dd>
            </div>
          </>
        ) : (
          <>
            <div>
              <dt className="font-medium">Profession</dt>
              <dd>{professionalDraft?.profession ?? "-"}</dd>
            </div>
            <div>
              <dt className="font-medium">Company name</dt>
              <dd>{professionalDraft?.companyName ?? "-"}</dd>
            </div>
            <div>
              <dt className="font-medium">County</dt>
              <dd>{professionalDraft?.county ?? "-"}</dd>
            </div>
            <div>
              <dt className="font-medium">Years of experience</dt>
              <dd>
                {typeof professionalDraft?.yearsExperience === "number"
                  ? professionalDraft.yearsExperience
                  : "-"}
              </dd>
            </div>
          </>
        )}
      </dl>

      <div className="flex flex-wrap gap-2">
        <form action={onSubmit}>
          <button
            type="submit"
            className="inline-flex rounded bg-black px-4 py-2 text-sm font-medium text-white"
          >
            Submit Onboarding
          </button>
        </form>

        <form action={onSkip}>
          <button
            type="submit"
            className="inline-flex rounded border px-4 py-2 text-sm font-medium"
          >
            Skip For Now
          </button>
        </form>

        <a
          href={
            role === "professional"
              ? "/onboarding/no-js/professional"
              : "/onboarding/no-js/client"
          }
          className="inline-flex rounded border px-4 py-2 text-sm font-medium"
        >
          Back
        </a>
      </div>
    </section>
  );
}
