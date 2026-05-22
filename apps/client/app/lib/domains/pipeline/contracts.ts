import type { AppRole } from "@/app/lib/security/roles";
import type { DomainError, Result } from "@/app/lib/errors/result";

export type PipelineActor = {
  userId: string;
  role?: AppRole | string | null;
};

export type PipelineDomainErrorCode = "forbidden" | "internal";
export type PipelineDomainError = DomainError<PipelineDomainErrorCode>;
export type PipelineResult<T> = Result<T, PipelineDomainError>;

export type PipelineStage = {
  id: string;
  label: string;
  count: number;
  value: number;
};

export type PipelineSummary = {
  stages: PipelineStage[];
  totalValue: number;
};
