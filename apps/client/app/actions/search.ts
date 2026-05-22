"use server";

import { searchService } from "@/app/lib/domains/search";
import { unwrapResultOrThrow } from "@/app/lib/actions/secure-action";

export async function searchProfessionalsAction(query: string) {
  const result = await searchService.searchProfessionals({}, query);
  return unwrapResultOrThrow(result, "Search failed");
}
