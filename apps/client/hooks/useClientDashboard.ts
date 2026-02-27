/**
 * TanStack Query hook for client dashboard data.
 */
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { clientDashboardClient } from "@/lib/client-dashboard-client";
import type { DashboardData } from "@/lib/client-dashboard-client";

import type { ApiResponse } from "@build/types";

function unwrap<T>(res: ApiResponse<T>): T {
  if (!res.success) throw new Error(res.error);
  if (res.data === undefined) throw new Error("No data returned");
  return res.data;
}

export const clientDashboardKeys = {
  all: ["client-dashboard"] as const,
};

export function useClientDashboard() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: clientDashboardKeys.all,
    queryFn: async () => unwrap(await clientDashboardClient.getDashboard()),
    staleTime: 60_000, // 1 minute
  });

  const refetch = () =>
    queryClient.invalidateQueries({ queryKey: clientDashboardKeys.all });

  return {
    ...query,
    data: query.data as DashboardData | undefined,
    refetch,
  };
}
