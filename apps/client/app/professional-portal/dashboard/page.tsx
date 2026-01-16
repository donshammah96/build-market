"use client";

import Link from "next/link";
import { useUser } from "@clerk/nextjs";
import {
  ChevronRight,
  Shield,
  User,
  Building2,
  Store,
  ArrowUpRight,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
} from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ProfileCompletionBanner } from "@/components/shared/ProfileCompletionBanner";
import { useProfileStatus } from "@/hooks/useProfileStatus";
import { useDashboardData } from "@/hooks/useDashboardData";
import { WidgetId } from "@/lib/dashboard";

// Dashboard components
import { DashboardHeader, MetricsRow } from "@/components/dashboard";
import {
  // Shared widgets
  ProfileStrengthWidget,
  AgendaWidget,
  // Service Provider widgets
  LeadsWidget,
  ProjectsWidget,
  PortfolioWidget,
  // Store widgets
  StoreOverviewWidget,
  OrdersWidget,
  ProductsWidget,
  InventoryAlertsWidget,
  // Property widgets
  ListingsWidget,
  InquiriesWidget,
  PipelineWidget,
} from "@/components/dashboard/widgets";

// ============================================================================
// WIDGET RENDERER - Maps widget IDs to actual components
// ============================================================================

interface WidgetRendererProps {
  widgetId: WidgetId;
  data: ReturnType<typeof useDashboardData>;
}

function WidgetRenderer({ widgetId, data }: WidgetRendererProps) {
  const {
    leads,
    projects,
    portfolio,
    primaryStore,
    orders,
    topProducts,
    inventoryAlerts,
    properties,
    propertyInquiries,
    pipeline,
    agenda,
  } = data;

  switch (widgetId) {
    // Shared widgets
    case "profile_strength":
      return <ProfileStrengthWidget />;
    case "agenda":
      return <AgendaWidget events={Array.isArray(agenda) ? agenda : []} />;

    // Service Provider widgets
    case "leads":
      return (
        <LeadsWidget
          leads={Array.isArray(leads) ? leads : []}
          newLeadsCount={
            Array.isArray(leads)
              ? leads.filter((l) => l.status === "new").length
              : 0
          }
        />
      );
    case "projects":
      return (
        <ProjectsWidget projects={Array.isArray(projects) ? projects : []} />
      );
    case "portfolio":
      return (
        <PortfolioWidget items={Array.isArray(portfolio) ? portfolio : []} />
      );

    // Store widgets
    case "store_overview":
      return <StoreOverviewWidget store={primaryStore || undefined} />;
    case "orders":
      return (
        <OrdersWidget
          orders={Array.isArray(orders) ? orders : []}
          pendingCount={
            Array.isArray(orders)
              ? orders.filter((o) => o.status === "pending").length
              : 0
          }
        />
      );
    case "products":
      return (
        <ProductsWidget
          products={Array.isArray(topProducts) ? topProducts : []}
        />
      );
    case "inventory_alerts":
      return (
        <InventoryAlertsWidget
          alerts={Array.isArray(inventoryAlerts) ? inventoryAlerts : []}
        />
      );

    // Property widgets
    case "property_listings":
      return (
        <ListingsWidget
          properties={Array.isArray(properties) ? properties : []}
        />
      );
    case "property_inquiries":
      return (
        <InquiriesWidget
          inquiries={Array.isArray(propertyInquiries) ? propertyInquiries : []}
          newCount={
            Array.isArray(propertyInquiries)
              ? propertyInquiries.filter((i) => i.status === "new").length
              : 0
          }
        />
      );
    case "sales_pipeline":
      return (
        <PipelineWidget
          stages={pipeline.stages}
          totalValue={pipeline.totalValue}
        />
      );

    // Hybrid widgets - development_projects shows projects for property developers
    case "development_projects":
      return (
        <ProjectsWidget projects={Array.isArray(projects) ? projects : []} />
      );

    default:
      // Unknown widget - log warning in development
      if (process.env.NODE_ENV === "development") {
        console.warn(`Unknown widget ID: ${widgetId}`);
      }
      return null;
  }
}

// ============================================================================
// ERROR ALERT COMPONENT
// ============================================================================

interface ErrorAlertProps {
  error: Error;
  onRetry?: () => void;
}

function ErrorAlert({ error, onRetry }: ErrorAlertProps) {
  return (
    <Alert variant="destructive" className="mb-6">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>Error loading dashboard data</AlertTitle>
      <AlertDescription className="flex items-center justify-between">
        <span>{error.message || "An unexpected error occurred"}</span>
        {onRetry && (
          <Button
            variant="outline"
            size="sm"
            onClick={onRetry}
            className="ml-4"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        )}
      </AlertDescription>
    </Alert>
  );
}

// ============================================================================
// MAIN PAGE COMPONENT
// ============================================================================

export default function ProfessionalDashboardPage() {
  const { isLoaded } = useUser();
  const { completion, user, isLoading: profileLoading } = useProfileStatus();

  // Dashboard data with conditional fetching based on profession
  const dashboardData = useDashboardData();
  const { config, metrics, isLoading: dataLoading, error } = dashboardData;

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
      {error && <ErrorAlert error={error} />}

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

// ============================================================================
// LOADING SKELETON
// ============================================================================

function DashboardSkeleton() {
  return (
    <div className="space-y-8 max-w-[1600px] mx-auto p-4">
      {/* Header Skeleton */}
      <div className="flex justify-between items-end pb-6 border-b border-zinc-100">
        <div className="space-y-2 animate-pulse">
          <div className="h-8 w-32 bg-zinc-200 rounded" />
          <div className="h-4 w-64 bg-zinc-200 rounded" />
        </div>
        <div className="flex gap-3 animate-pulse">
          <div className="h-10 w-28 bg-zinc-200 rounded" />
          <div className="h-10 w-36 bg-zinc-200 rounded" />
        </div>
      </div>

      {/* Metrics Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-40 bg-zinc-100 rounded-xl animate-pulse" />
        ))}
      </div>

      {/* Content Skeleton */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        <div className="xl:col-span-2 space-y-6">
          <div className="h-80 bg-zinc-100 rounded-xl animate-pulse" />
          <div className="grid grid-cols-2 gap-6">
            <div className="h-48 bg-zinc-100 rounded-xl animate-pulse" />
            <div className="h-48 bg-zinc-100 rounded-xl animate-pulse" />
          </div>
        </div>
        <div className="space-y-6">
          <div className="h-40 bg-zinc-100 rounded-xl animate-pulse" />
          <div className="h-56 bg-zinc-100 rounded-xl animate-pulse" />
          <div className="h-48 bg-zinc-100 rounded-xl animate-pulse" />
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// VERIFICATION PROMPT FOR SKIPPED ONBOARDING
// ============================================================================

const VERIFICATION_STEPS = [
  {
    icon: User,
    title: "Personal Info",
    description: "Name, contact details",
  },
  {
    icon: Building2,
    title: "Business Details",
    description: "Company, services, bio",
  },
  {
    icon: Store,
    title: "Store (Optional)",
    description: "Sell products online",
  },
];

function VerificationPromptCard() {
  return (
    <Card className="border-2 border-emerald-200 bg-gradient-to-br from-emerald-50 to-white shadow-lg overflow-hidden">
      <CardContent className="p-0">
        <div className="flex flex-col lg:flex-row">
          {/* Left: Content */}
          <div className="flex-1 p-8">
            {/* Badge */}
            <div className="flex items-center gap-2 mb-4">
              <div className="p-2 rounded-full bg-emerald-100">
                <Shield className="h-5 w-5 text-emerald-600" />
              </div>
              <Badge
                variant="secondary"
                className="bg-emerald-100 text-emerald-700 border-0"
              >
                Action Required
              </Badge>
            </div>

            {/* Title */}
            <h2 className="text-2xl font-bold text-zinc-900 mb-2">
              Complete Your Professional Verification
            </h2>
            <p className="text-zinc-600 mb-6 max-w-md">
              Verify your profile to unlock all features, receive leads, and
              build trust with clients. It only takes 5 minutes.
            </p>

            {/* Steps Preview */}
            <div className="flex items-center gap-4 mb-6">
              {VERIFICATION_STEPS.map((step, index) => {
                const Icon = step.icon;
                return (
                  <div key={step.title} className="flex items-center">
                    <div className="flex flex-col items-center group">
                      <div className="w-12 h-12 rounded-full bg-white border-2 border-zinc-200 flex items-center justify-center group-hover:border-emerald-500 group-hover:bg-emerald-50 transition-all">
                        <Icon className="h-5 w-5 text-zinc-400 group-hover:text-emerald-600 transition-colors" />
                      </div>
                      <span className="text-xs font-medium text-zinc-500 mt-2 text-center max-w-[80px]">
                        {step.title}
                      </span>
                    </div>
                    {index < VERIFICATION_STEPS.length - 1 && (
                      <ChevronRight className="h-4 w-4 text-zinc-300 mx-2" />
                    )}
                  </div>
                );
              })}
            </div>

            {/* CTAs */}
            <div className="flex items-center gap-3 flex-wrap">
              <Button
                asChild
                className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-md hover:shadow-lg transition-all"
              >
                <Link href="/professional-portal/settings/complete-profile">
                  <Shield className="h-4 w-4 mr-2" />
                  Complete Verification
                  <ArrowUpRight className="h-4 w-4 ml-2" />
                </Link>
              </Button>
              <Button
                variant="ghost"
                className="text-zinc-600 hover:text-zinc-900"
              >
                Why verify?
              </Button>
            </div>
          </div>

          {/* Right: Benefits */}
          <div className="lg:w-72 bg-zinc-900 p-6 text-white">
            <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-400 mb-4">
              Verified Benefits
            </h3>
            <ul className="space-y-3">
              {[
                "Priority in search results",
                "Trust badge on profile",
                "Receive client leads",
                "Access to quotes & projects",
                "Sell products in marketplace",
              ].map((benefit) => (
                <li key={benefit} className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                  <span className="text-zinc-300">{benefit}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
