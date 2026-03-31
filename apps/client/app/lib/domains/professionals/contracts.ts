import type { DomainError, Result } from "@/app/lib/errors/result";
import {
  ProfessionalQuerySchema as ProfessionalQuerySchemaValue,
  type ProfessionalQueryInput as ProfessionalQueryInputValue,
} from "@/app/lib/validation/professionals-validation";
import type {
  ProfessionalCardDTO,
  ProfessionalDetailDTO,
  ProfessionalFilters,
} from "@/app/lib/domains/professionals/repository";

export { ProfessionalQuerySchemaValue as ProfessionalQuerySchema };

export type ProfessionalQueryInput = ProfessionalQueryInputValue;
export type { ProfessionalCardDTO, ProfessionalDetailDTO, ProfessionalFilters };

export type ProfessionalDomainErrorCode = "not_found" | "internal";
export type ProfessionalDomainError = DomainError<ProfessionalDomainErrorCode>;
export type ProfessionalResult<T> = Result<T, ProfessionalDomainError>;

export type ProfessionalListItem = ProfessionalCardDTO & {
  professionLabel: string;
  profileUrl: string;
  portfolioImage?: string;
};

export type ProfessionalListResult = {
  professionals: ProfessionalListItem[];
  total: number;
  hasMore: boolean;
};

export type ProfessionalDetailResult = ProfessionalDetailDTO & {
  professionLabel: string;
  location?: string;
  profileImage?: string;
  profileUrl: string;
};
