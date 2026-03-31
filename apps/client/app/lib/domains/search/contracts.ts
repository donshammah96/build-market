import type { DomainError, Result } from "@/app/lib/errors/result";

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
