import { CLIENT_TYPES, COUNTIES } from "@build/types";
import type { NoJsClientDraft } from "@/app/lib/infrastructure/onboarding-nojs-session";

type NoJsClientFormProps = {
  defaultValues?: NoJsClientDraft;
  errorMessage?: string;
  onSubmit: (formData: FormData) => Promise<void>;
};

export function NoJsClientForm({
  defaultValues,
  errorMessage,
  onSubmit,
}: NoJsClientFormProps) {
  return (
    <form action={onSubmit} className="space-y-4 rounded-lg border p-6">
      <h1 className="text-2xl font-semibold">
        Client Onboarding (No JavaScript)
      </h1>
      <p className="text-sm text-muted-foreground">
        Complete the essential details below and continue to review.
      </p>

      {errorMessage ? (
        <p className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
          {errorMessage}
        </p>
      ) : null}

      <div className="space-y-1">
        <label htmlFor="type" className="text-sm font-medium">
          Client Type
        </label>
        <select
          id="type"
          name="type"
          defaultValue={defaultValues?.type ?? "HOMEOWNER"}
          className="w-full rounded border px-3 py-2"
          required
        >
          {CLIENT_TYPES.map((type) => (
            <option key={type} value={type}>
              {type.replace(/_/g, " ")}
            </option>
          ))}
        </select>
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
        <label htmlFor="companyName" className="text-sm font-medium">
          Company Name (optional)
        </label>
        <input
          id="companyName"
          name="companyName"
          type="text"
          defaultValue={defaultValues?.companyName ?? ""}
          className="w-full rounded border px-3 py-2"
        />
      </div>

      <div className="space-y-1">
        <label htmlFor="projectType" className="text-sm font-medium">
          Project Type (optional)
        </label>
        <input
          id="projectType"
          name="projectType"
          type="text"
          defaultValue={defaultValues?.projectType ?? ""}
          className="w-full rounded border px-3 py-2"
        />
      </div>

      <div className="space-y-1">
        <label htmlFor="projectLocation" className="text-sm font-medium">
          Project Location (optional)
        </label>
        <input
          id="projectLocation"
          name="projectLocation"
          type="text"
          defaultValue={defaultValues?.projectLocation ?? ""}
          className="w-full rounded border px-3 py-2"
        />
      </div>

      <div className="space-y-1">
        <label htmlFor="estimatedBudget" className="text-sm font-medium">
          Estimated Budget (optional)
        </label>
        <input
          id="estimatedBudget"
          name="estimatedBudget"
          type="text"
          defaultValue={defaultValues?.estimatedBudget ?? ""}
          className="w-full rounded border px-3 py-2"
          placeholder="e.g. 1000000-5000000"
        />
      </div>

      <div className="space-y-1">
        <label htmlFor="description" className="text-sm font-medium">
          Description (optional)
        </label>
        <textarea
          id="description"
          name="description"
          defaultValue={defaultValues?.description ?? ""}
          className="min-h-24 w-full rounded border px-3 py-2"
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
