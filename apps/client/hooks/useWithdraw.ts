/**
 * TanStack Query hook for professional-portal withdrawal.
 *
 * Uses financeClient (Server Actions) under the hood.
 */
import {
  useMutation,
  useQueryClient,
  type UseMutationOptions,
} from "@tanstack/react-query";
import { financeClient } from "@/lib/finance-client";
import type { RequestWithdrawalClientInput } from "@/lib/finance-client";
import { unwrapApiResponse } from "@/lib/api-client-utils";

export const financeKeys = {
  all: ["finance"] as const,
  stats: () => [...financeKeys.all, "stats"] as const,
  transactions: () => [...financeKeys.all, "transactions"] as const,
};

export function useWithdraw(
  options?: UseMutationOptions<
    Awaited<ReturnType<typeof financeClient.requestWithdrawal>>["data"],
    Error,
    RequestWithdrawalClientInput
  >,
) {
  const queryClient = useQueryClient();

  return useMutation({
    ...options,
    mutationFn: async (input) =>
      unwrapApiResponse(await financeClient.requestWithdrawal(input)),
    onSuccess: (data, variables, context, mutation) => {
      queryClient.invalidateQueries({ queryKey: financeKeys.stats() });
      queryClient.invalidateQueries({ queryKey: financeKeys.transactions() });
      options?.onSuccess?.(data, variables, context, mutation);
    },
  });
}
