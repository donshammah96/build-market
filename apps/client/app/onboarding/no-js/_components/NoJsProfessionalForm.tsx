import { COUNTIES, PROFESSIONS } from "@build/types";
import type { NoJsProfessionalDraft } from "@/app/lib/infrastructure/onboarding-nojs-session";

type NoJsProfessionalFormProps = {
  defaultValues?: NoJsProfessionalDraft;
  errorMessage?: string;
  onSubmit: (formData: FormData) => Promise<void>;
};

export function NoJsProfessionalForm({
  defaultValues,
  errorMessage,
  onSubmit,
}: NoJsProfessionalFormProps) {
  return (
    <form action={onSubmit} className="space-y-4 rounded-lg border p-6">
      <h1 className="text-2xl font-semibold">
        Professional Onboarding (No JavaScript)
      </h1>
      <p className="text-sm text-muted-foreground">
        Complete these required details and continue to review.
      </p>

      {errorMessage ? (
        <p className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
          {errorMessage}
        </p>
      ) : null}

      <div className="space-y-1">
        <label htmlFor="profession" className="text-sm font-medium">
          Profession
        </label>
        <select
          id="profession"
          name="profession"
          defaultValue={defaultValues?.profession ?? ""}
          className="w-full rounded border px-3 py-2"
          required
        >
          <option value="">Select profession</option>
          {PROFESSIONS.map((profession) => (
            <option key={profession} value={profession}>
              {profession.replace(/_/g, " ")}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1">
        <label htmlFor="companyName" className="text-sm font-medium">
          Company Name
        </label>
        <input
          id="companyName"
          name="companyName"
          type="text"
          defaultValue={defaultValues?.companyName ?? ""}
          className="w-full rounded border px-3 py-2"
          required
        />
      </div>

      <div className="space-y-1">
        <label htmlFor="county" className="text-sm font-medium">
          County
        </label>
        <select
          id="county"
          name="county"
          defaultValue={defaultValues?.county ?? ""}
          className="w-full rounded border px-3 py-2"
          required
        >
          <option value="">Select county</option>
          {COUNTIES.map((county) => (
            <option key={county} value={county}>
              {county.replace(/_/g, " ")}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1">
        <label htmlFor="city" className="text-sm font-medium">
          City (optional)
        </label>
        <input
          id="city"
          name="city"
          type="text"
          defaultValue={defaultValues?.city ?? ""}
          className="w-full rounded border px-3 py-2"
        />
      </div>

      <div className="space-y-1">
        <label htmlFor="yearsExperience" className="text-sm font-medium">
          Years Of Experience (optional)
        </label>
        <input
          id="yearsExperience"
          name="yearsExperience"
          type="number"
          min={0}
          defaultValue={
            typeof defaultValues?.yearsExperience === "number"
              ? String(defaultValues.yearsExperience)
              : ""
          }
          className="w-full rounded border px-3 py-2"
        />
      </div>

      <button
        type="submit"
        className="inline-flex rounded bg-black px-4 py-2 text-sm font-medium text-white"
      >
        Continue To Review
      </button>
    </form>
  );
}
