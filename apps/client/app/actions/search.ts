"use server";

import { searchService } from "@/app/lib/domains/search";

export async function searchProfessionalsAction(query: string) {
  const result = await searchService.searchProfessionals({}, query);
  if (!result.ok) {
    throw new Error(
      (result as { message?: string }).message ?? "Search failed",
    );
  }
  return result.data;
}
