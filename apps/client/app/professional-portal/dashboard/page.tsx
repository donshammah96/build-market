"use client";

import dynamic from "next/dynamic";
import { useUser } from "@clerk/nextjs";
import {
  DashboardHeader,
  MetricsRow,
  WidgetRenderer,
} from "@/components/dashboard";
import { ProfileCompletionBanner } from "@/components/shared/ProfileCompletionBanner";
import { useProfileStatus } from "@/hooks/useProfileStatus";
import { useDashboardData } from "@/hooks/useDashboardData";
import { DashboardSkeleton } from "./_components/dashboard-skeleton";
import { ErrorAlert } from "./_components/error-alert";

// ============================================================================
// DYNAMIC IMPORTS — only loaded when the user skipped onboarding
// ============================================================================

const VerificationPromptCard = dynamic(
  () =>
    import("./_components/verification-prompt-card").then(
      (m) => m.VerificationPromptCard,
    ),
  { ssr: false },
);

// ============================================================================
// MAIN PAGE COMPONENT
// ============================================================================

export default function ProfessionalDashboardPage() {
  const { isLoaded } = useUser();
  const { completion, user, isLoading: profileLoading } = useProfileStatus();

  // Dashboard data with conditional fetching based on profession
  const dashboardData = useDashboardData();
  const {
    config,
    metrics,
    isLoading: dataLoading,
    error,
    refetch,
  } = dashboardData;

  // Check if user skipped onboarding
  const skippedOnboarding =
    !profileLoading &&
    user &&
    ((completion?.percentage ?? 0) < 30 || !user.isProfileComplete);

  // Overall loading state
  const isLoading = !isLoaded || profileLoading || dataLoading;

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  // Prepare welcome message data
  const welcomeData = {
    leads: Array.isArray(dashboardData.leads) ? dashboardData.leads.length : 0,
    projects: Array.isArray(dashboardData.projects)
      ? dashboardData.projects.length
      : 0,
    orders: Array.isArray(dashboardData.orders)
      ? dashboardData.orders.length
      : 0,
    products: dashboardData.primaryStore?.totalProducts ?? 0,
    inquiries: Array.isArray(dashboardData.propertyInquiries)
      ? dashboardData.propertyInquiries.length
      : 0,
    listings: Array.isArray(dashboardData.properties)
      ? dashboardData.properties.length
      : 0,
  };

  return (
    <div className="space-y-10 max-w-[1600px] mx-auto pb-10">
      {/* Error Alert */}
      {error && <ErrorAlert error={error} onRetry={refetch} />}

      {/* Verification Prompt for Skipped Onboarding */}
      {skippedOnboarding && <VerificationPromptCard />}

      {/* Profile Completion Banner (when profile exists but incomplete) */}
      {!profileLoading &&
        completion &&
        !completion.isComplete &&
        !skippedOnboarding && (
          <ProfileCompletionBanner
            percentage={completion.percentage}
            missingFields={completion.missingRequiredLabels || []}
            profileType="professional"
          />
        )}

      {/* Header with Quick Actions */}
      <DashboardHeader config={config} welcomeData={welcomeData} />

      {/* Metrics Row */}
      <MetricsRow metrics={config.metrics} data={metrics} />

      {/* Main Content Grid - Uses config for widget rendering */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        {/* Primary Content Area (2/3) - Rendered from config.primaryWidgets */}
        <div className="xl:col-span-2 space-y-8">
          {config.primaryWidgets.map((widgetId) => (
            <WidgetRenderer
              key={widgetId}
              widgetId={widgetId}
              data={dashboardData}
            />
          ))}
        </div>

        {/* Sidebar (1/3) - Rendered from config.secondaryWidgets */}
        <div className="space-y-6">
          {config.secondaryWidgets.map((widgetId) => (
            <WidgetRenderer
              key={widgetId}
              widgetId={widgetId}
              data={dashboardData}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
