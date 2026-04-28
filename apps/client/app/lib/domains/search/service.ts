import { ok } from "@/app/lib/errors/result";
import { searchRepository } from "./repository";
import type {
  SearchActor,
  SearchProfessionalResultDto,
  SearchResult,
} from "./contracts";

export const searchService = {
  async searchProfessionals(
    _actor: SearchActor,
    query: string,
  ): Promise<SearchResult<SearchProfessionalResultDto[]>> {
    const data = await searchRepository.searchProfessionals(query);
    return ok(data);
  },
};
