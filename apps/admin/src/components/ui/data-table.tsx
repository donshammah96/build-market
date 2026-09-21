"use client";

import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
  PaginationState,
  getFilteredRowModel,
  getSortedRowModel,
  SortingState,
} from "@tanstack/react-table";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DataTablePagination } from "@/components/layout/TablePagination";
import { useState, useCallback, useEffect } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, X } from "lucide-react";

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  pageCount?: number;
  searchPlaceholder?: string;
}

export function DataTable<TData, TValue>({
  columns,
  data,
  pageCount,
  searchPlaceholder,
}: DataTableProps<TData, TValue>) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Search params for server-side pagination
  const page = searchParams?.get("page") ? Number(searchParams.get("page")) : 1;
  const per_page = searchParams?.get("limit")
    ? Number(searchParams.get("limit"))
    : 10;

  const [sorting, setSorting] = useState<SortingState>([]);
  const [searchValue, setSearchValue] = useState(
    searchParams?.get("search") || "",
  );

  // Local pagination state
  const [{ pageIndex, pageSize }, setPagination] = useState<PaginationState>({
    pageIndex: page - 1,
    pageSize: per_page,
  });

  // Sync with URL changes
  useEffect(() => {
    setPagination({ pageIndex: page - 1, pageSize: per_page });
  }, [page, per_page]);

  // Sync search value if URL updates externally
  useEffect(() => {
    setSearchValue(searchParams?.get("search") || "");
  }, [searchParams]);

  const createQueryString = useCallback(
    (params: Record<string, string | number | null>) => {
      const newSearchParams = new URLSearchParams(searchParams?.toString());
      for (const [key, value] of Object.entries(params)) {
        if (value === null || value === "") {
          newSearchParams.delete(key);
        } else {
          newSearchParams.set(key, String(value));
        }
      }
      return newSearchParams.toString();
    },
    [searchParams],
  );

  // Debounced Search Effect
  useEffect(() => {
    if (pageCount === undefined) return;

    const timeoutId = setTimeout(() => {
      const currentSearch = searchParams?.get("search") || "";
      if (searchValue !== currentSearch) {
        router.push(
          `${pathname}?${createQueryString({
            page: 1, // Reset to first page on search
            search: searchValue || null,
          })}`,
          { scroll: false }, // Prevent scroll jump
        );
      }
    }, 400); // 400ms debounce

    return () => clearTimeout(timeoutId);
  }, [
    searchValue,
    pageCount,
    router,
    pathname,
    createQueryString,
    searchParams,
  ]);

  const table = useReactTable({
    data,
    columns,
    pageCount: pageCount ?? -1,
    state: {
      pagination: { pageIndex, pageSize },
      sorting,
    },
    manualPagination: pageCount !== undefined,
    onPaginationChange: (updater) => {
      const nextState =
        typeof updater === "function"
          ? updater({ pageIndex, pageSize })
          : updater;
      setPagination(nextState);
      router.push(
        `${pathname}?${createQueryString({
          page: nextState.pageIndex + 1,
          limit: nextState.pageSize,
        })}`,
      );
    },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  return (
    <div className="w-full">
      {/* Toolbar Area */}
      <div className="flex items-center justify-between p-4 border-b border-zinc-100 bg-zinc-50/50">
        <div className="flex flex-1 items-center space-x-2">
          {searchPlaceholder && (
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-zinc-400" />
              <Input
                placeholder={searchPlaceholder}
                value={searchValue}
                onChange={(event) => setSearchValue(event.target.value)}
                className="h-9 w-full bg-white pl-9 border-zinc-200 focus:border-zinc-400"
              />
              {searchValue && (
                <button
                  onClick={() => setSearchValue("")}
                  className="absolute right-2.5 top-2.5 text-zinc-400 hover:text-zinc-600"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          )}
          {searchValue && (
            <Button
              variant="ghost"
              onClick={() => setSearchValue("")}
              className="h-8 px-2 lg:px-3 text-zinc-500"
            >
              Reset
              <X className="ml-2 h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Table Area */}
      <div className="relative w-full overflow-auto">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow
                key={headerGroup.id}
                className="hover:bg-transparent border-zinc-100"
              >
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    className="h-10 px-4 text-xs font-medium uppercase tracking-wider text-zinc-500 bg-zinc-50/50"
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                  className="border-zinc-50 hover:bg-zinc-50/50 transition-colors"
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="px-4 py-3">
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center text-zinc-500"
                >
                  No projects found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Footer / Pagination */}
      <div className="border-t border-zinc-100 bg-zinc-50/30 p-4">
        <DataTablePagination table={table} />
      </div>
    </div>
  );
}
