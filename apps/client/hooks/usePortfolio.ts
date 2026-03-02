/**
 * usePortfolio — Custom React Query hooks for the Portfolio module.
 *
 * Wraps `portfolioClient` with TanStack Query for cache management,
 * optimistic updates, and type-safe data access.
 */
import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryOptions,
  type UseMutationOptions,
} from "@tanstack/react-query";
import {
  portfolioClient,
  unwrapApiResponse,
  type PortfolioItem,
  type PortfolioQueryInput,
  type CreatePortfolioClientInput,
  type UpdatePortfolioClientInput,
  type DeletePortfolioClientInput,
} from "@/lib/portfolio-client";

// ─── Query Keys ────────────────────────────────────────────────────────────

export const portfolioKeys = {
  all: ["portfolio"] as const,
  lists: () => [...portfolioKeys.all, "list"] as const,
  list: (filters?: Partial<PortfolioQueryInput>) =>
    [...portfolioKeys.lists(), filters] as const,
  details: () => [...portfolioKeys.all, "detail"] as const,
  detail: (id: string) => [...portfolioKeys.details(), id] as const,
} as const;

// ─── usePortfolios ─────────────────────────────────────────────────────────

export function usePortfolios(
  filters?: Partial<PortfolioQueryInput>,
  options?: Omit<UseQueryOptions<PortfolioItem[]>, "queryKey" | "queryFn">,
) {
  return useQuery<PortfolioItem[]>({
    queryKey: portfolioKeys.list(filters),
    queryFn: () =>
      portfolioClient.getPortfolios(filters).then(unwrapApiResponse),
    staleTime: 30_000,
    retry: 2,
    ...options,
  });
}

// ─── usePortfolio (single item) ────────────────────────────────────────────

export function usePortfolio(
  portfolioId: string,
  options?: Omit<UseQueryOptions<PortfolioItem>, "queryKey" | "queryFn">,
) {
  return useQuery<PortfolioItem>({
    queryKey: portfolioKeys.detail(portfolioId),
    queryFn: () =>
      portfolioClient.getPortfolio(portfolioId).then(unwrapApiResponse),
    enabled: !!portfolioId,
    staleTime: 30_000,
    ...options,
  });
}

// ─── useCreatePortfolio ────────────────────────────────────────────────────

export function useCreatePortfolio(
  options?: UseMutationOptions<
    PortfolioItem,
    Error,
    CreatePortfolioClientInput
  >,
) {
  const queryClient = useQueryClient();
  return useMutation<PortfolioItem, Error, CreatePortfolioClientInput>({
    mutationFn: (input) =>
      portfolioClient.createPortfolio(input).then(unwrapApiResponse),
    ...options,
    onSuccess: (...args) => {
      queryClient.invalidateQueries({ queryKey: portfolioKeys.lists() });
      options?.onSuccess?.(...args);
    },
  });
}

// ─── useUpdatePortfolio ────────────────────────────────────────────────────

export function useUpdatePortfolio(
  options?: UseMutationOptions<
    PortfolioItem,
    Error,
    UpdatePortfolioClientInput
  >,
) {
  const queryClient = useQueryClient();
  return useMutation<PortfolioItem, Error, UpdatePortfolioClientInput>({
    mutationFn: (input) =>
      portfolioClient.updatePortfolio(input).then(unwrapApiResponse),
    ...options,
    onSuccess: (...args) => {
      const [, variables] = args;
      queryClient.invalidateQueries({ queryKey: portfolioKeys.lists() });
      queryClient.invalidateQueries({
        queryKey: portfolioKeys.detail(variables.portfolioId),
      });
      options?.onSuccess?.(...args);
    },
  });
}

// ─── useDeletePortfolio ────────────────────────────────────────────────────

export function useDeletePortfolio(
  options?: UseMutationOptions<void, Error, DeletePortfolioClientInput>,
) {
  const queryClient = useQueryClient();
  return useMutation<void, Error, DeletePortfolioClientInput>({
    mutationFn: (input) =>
      portfolioClient.deletePortfolio(input).then(unwrapApiResponse),
    ...options,
    onSuccess: (...args) => {
      const [, variables] = args;
      queryClient.invalidateQueries({ queryKey: portfolioKeys.lists() });
      queryClient.removeQueries({
        queryKey: portfolioKeys.detail(variables.portfolioId),
      });
      options?.onSuccess?.(...args);
    },
  });
}
