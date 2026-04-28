import { getProfessionals } from "@/actions/admin";
import { columns, ProfessionalData } from "./columns";
import { DataTable } from "@/components/ui/data-table";

import { ProfessionalsFilter } from "./professionals-filter";

export default async function ProfessionalsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const resolvedSearchParams = await searchParams;
  const page = Number(resolvedSearchParams.page) || 1;
  const search =
    typeof resolvedSearchParams.search === "string"
      ? resolvedSearchParams.search
      : "";
  const verified =
    resolvedSearchParams.verified === "true"
      ? true
      : resolvedSearchParams.verified === "false"
        ? false
        : undefined;
  const sortBy =
    (resolvedSearchParams.sortBy as "createdAt" | "companyName") || "createdAt";
  const sortOrder =
    (resolvedSearchParams.sortOrder as "asc" | "desc") || "desc";

  const response = await getProfessionals(
    page,
    10,
    search,
    verified,
    sortBy,
    sortOrder,
  );

  if (!response.success || !response.data) {
    throw new Error(response.error || "Failed to load professionals");
  }

  const { professionals, meta } = response.data;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Professionals</h1>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-semibold px-4 py-2 bg-secondary rounded-md">
              Total Count: {meta.total}
            </span>
          </div>
        </div>
        <div className="flex items-center justify-between border-b pb-4">
          <ProfessionalsFilter />
        </div>
      </div>
      <DataTable
        columns={columns}
        data={professionals as unknown as ProfessionalData[]}
        pageCount={meta.totalPages}
      />
    </div>
  );
}
