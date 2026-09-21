/**
 * Professional Portal Module Hook (ADR-002 / ADR-005)
 *
 * TanStack Query hook pattern for professional portal modules providing
 * capability checking, optimistic UI updates, and server state reconciliation.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { professionalPortalClient } from "@/lib/facades/portal-client";
import type { ProfessionalCapabilityContext } from "@/app/lib/domains/professionals/capability.service";
import type {
  PaginatedResult,
  QueryFilterParams,
} from "@/app/lib/domains/shared/contracts";
import { unwrapApiResponse } from "@/lib/api-client-utils";

export const portalKeys = {
  all: ["professional-portal"] as const,
  capabilities: () => [...portalKeys.all, "capabilities"] as const,
  module: (moduleName: string) => [...portalKeys.all, moduleName] as const,
  moduleList: (moduleName: string, params?: QueryFilterParams) =>
    [...portalKeys.module(moduleName), "list", params] as const,
};

/**
 * Hook to fetch capabilities for current logged-in professional.
 */
export function usePortalCapabilities() {
  return useQuery({
    queryKey: portalKeys.capabilities(),
    queryFn: async (): Promise<ProfessionalCapabilityContext> => {
      const res = await professionalPortalClient.getCapabilityContext();
      return unwrapApiResponse(res);
    },
    staleTime: 1000 * 60 * 5, // 5 minutes cache
  });
}

/**
 * Hook to query paginated portal module data.
 */
export function usePortalModuleData<T>(
  moduleName: string,
  params?: QueryFilterParams,
  enabled = true,
) {
  return useQuery({
    queryKey: portalKeys.moduleList(moduleName, params),
    queryFn: async (): Promise<PaginatedResult<T>> => {
      const res = await professionalPortalClient.getModuleData<T>(
        moduleName,
        params,
      );
      return unwrapApiResponse(res);
    },
    enabled,
  });
}

/**
 * Hook to perform optimistic portal module mutations.
 */
export function usePortalModuleMutation<TData, TResult = TData>(
  moduleName: string,
  action: string,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: TData): Promise<TResult> => {
      const res = await professionalPortalClient.mutateModuleData<
        TData,
        TResult
      >(moduleName, action, payload);
      return unwrapApiResponse(res);
    },
    onSuccess: () => {
      // Invalidate relevant module cache on successful reconciliation
      queryClient.invalidateQueries({
        queryKey: portalKeys.module(moduleName),
      });
    },
  });
}
