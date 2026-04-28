import type { DomainError, Result } from "@/app/lib/errors/result";

/**
 * ADR-005 observable operationName inventory:
 * - search_professionals (GET /api/search/professionals)
 */

/** Public read actor — no auth required; empty for unauthenticated access */
export type SearchActor = Record<string, never>;

export type SearchDomainErrorCode = "forbidden";

export type SearchDomainError = DomainError<SearchDomainErrorCode>;

export type SearchResult<T> = Result<T, SearchDomainError>;

export type SearchProfessionalResultDto = {
  userId: string;
  companyName: string | null;
  bio: string | null;
  verified: boolean;
  user: {
    firstName: string | null;
    lastName: string | null;
    email: string | null;
  };
};
