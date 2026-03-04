"use server";

import { searchProfessionals } from "@/lib/services/search";

export async function searchProfessionalsAction(query: string) {
  return await searchProfessionals(query);
}
