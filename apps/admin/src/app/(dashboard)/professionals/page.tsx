import { getProfessionals } from "@/actions/admin";
import { columns, ProfessionalData } from "./columns";
import { DataTable } from "@/components/ui/data-table";

export default async function ProfessionalsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const resolvedSearchParams = await searchParams;
  const page = Number(resolvedSearchParams.page) || 1;
  const search = typeof resolvedSearchParams.search === "string" ? resolvedSearchParams.search : "";

  const response = await getProfessionals(page, 10, search);
  
  if (!response.success || !response.data) {
    return <div>Failed to load professionals</div>;
  }

  const { professionals, meta } = response.data;

  return (
    <div className="">
      <div className="mb-8 px-4 py-2 bg-secondary rounded-md flex justify-between items-center">
        <h1 className="font-semibold">All Professionals ({meta.total})</h1>
      </div>
      <DataTable columns={columns} data={professionals as unknown as ProfessionalData[]} pageCount={meta.totalPages} />
    </div>
  );
}
