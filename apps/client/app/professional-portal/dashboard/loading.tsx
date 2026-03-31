// App Router segment-level loading for /professional-portal/dashboard.
// Renders the same skeleton used by the client-side isLoading gate so the
// visual transition is seamless during navigation.

import { DashboardSkeleton } from "./_components/dashboard-skeleton";

export default function DashboardLoading() {
  return <DashboardSkeleton />;
}
