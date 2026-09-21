/**
 * usePipeline — Custom React Query hook for the Pipeline summary.
 */
import { useQuery, type UseQueryOptions } from "@tanstack/react-query";
import {
  pipelineClient,
  unwrapApiResponse,
  type PipelineSummary,
} from "./pipeline-client";

export const pipelineKeys = {
  all: ["pipeline"] as const,
  summary: () => [...pipelineKeys.all, "summary"] as const,
} as const;

export function usePipelineSummary(
  options?: Omit<UseQueryOptions<PipelineSummary>, "queryKey" | "queryFn">,
) {
  return useQuery<PipelineSummary>({
    queryKey: pipelineKeys.summary(),
    queryFn: () => pipelineClient.getPipelineSummary().then(unwrapApiResponse),
    staleTime: 30_000,
    retry: 2,
    ...options,
  });
}
