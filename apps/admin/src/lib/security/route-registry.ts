import { createRouteMatcher } from "@clerk/nextjs/server";
import { AdminRole } from "@build/enums";
import { type AdminAccessRole } from "./authorization-policy";

export type RouteAccessRole = AdminRole | AdminAccessRole | string;

export interface AdminRouteMetadata {
  /** Path segment or pattern under dashboard (e.g. "/users", "/verifications/[id]") */
  path: string;
  /** Primary category grouping */
  section: "core" | "compliance" | "operations" | "finance" | "settings";
  /** Descriptive title for navigation UI */
  title: string;
  /** Allowed roles required to access this route */
  allowedRoles: readonly RouteAccessRole[];
  /** Optional feature flag gate governing availability */
  featureFlag?: string;
  /** Whether the route handles sensitive high-risk mutations */
  isHighRisk?: boolean;
}

export const ADMIN_ROUTE_REGISTRY: readonly AdminRouteMetadata[] = [
  {
    path: "/",
    section: "core",
    title: "Overview Dashboard",
    allowedRoles: [
      "super_admin",
      "ops_admin",
      "finance_admin",
      "support_admin",
      "verification_admin",
    ],
  },
  {
    path: "/users",
    section: "core",
    title: "User Directory & Governance",
    allowedRoles: ["super_admin", "ops_admin", "support_admin"],
  },
  {
    path: "/users-v2",
    section: "core",
    title: "User Management V2",
    allowedRoles: ["super_admin", "ops_admin"],
    featureFlag: "NEXT_PUBLIC_ADMIN_FF_V2_USER_MANAGEMENT",
  },
  {
    path: "/users/[id]",
    section: "core",
    title: "User Detail & Activity",
    allowedRoles: ["super_admin", "ops_admin", "support_admin"],
  },
  {
    path: "/verifications",
    section: "compliance",
    title: "Verification Queue",
    allowedRoles: ["super_admin", "ops_admin", "verification_admin"],
  },
  {
    path: "/verifications-v2",
    section: "compliance",
    title: "Verification Queue V2",
    allowedRoles: ["super_admin", "verification_admin"],
    featureFlag: "NEXT_PUBLIC_ADMIN_FF_V2_VERIFICATION_QUEUE",
  },
  {
    path: "/verifications/[entityType]/[id]",
    section: "compliance",
    title: "Verification Review Console",
    allowedRoles: ["super_admin", "ops_admin", "verification_admin"],
  },
  {
    path: "/verifications/regulator",
    section: "compliance",
    title: "Regulator Manual Verification Queue",
    allowedRoles: ["super_admin", "ops_admin", "verification_admin"],
  },
  {
    path: "/verification-ops",
    section: "compliance",
    title: "Verification Operations Center",
    allowedRoles: ["super_admin", "ops_admin", "verification_admin"],
  },
  {
    path: "/audit",
    section: "compliance",
    title: "System Audit Log",
    allowedRoles: ["super_admin", "ops_admin"],
  },
  {
    path: "/audit-v2",
    section: "compliance",
    title: "System Audit Log V2",
    allowedRoles: ["super_admin"],
    featureFlag: "NEXT_PUBLIC_ADMIN_FF_V2_AUDIT_LOG_UI",
  },
  {
    path: "/analytics",
    section: "finance",
    title: "Finance & Market Analytics",
    allowedRoles: ["super_admin", "finance_admin"],
  },
  {
    path: "/analytics-v2",
    section: "finance",
    title: "Finance Analytics V2",
    allowedRoles: ["super_admin", "finance_admin"],
    featureFlag: "NEXT_PUBLIC_ADMIN_FF_V2_FINANCE_DASHBOARD",
  },
  {
    path: "/leads",
    section: "operations",
    title: "Lead Operations",
    allowedRoles: ["super_admin", "ops_admin", "support_admin"],
  },
  {
    path: "/leads/[id]",
    section: "operations",
    title: "Lead Detail",
    allowedRoles: ["super_admin", "ops_admin", "support_admin"],
  },
  {
    path: "/professionals",
    section: "operations",
    title: "Professional Services",
    allowedRoles: ["super_admin", "ops_admin"],
  },
  {
    path: "/professionals/[id]",
    section: "operations",
    title: "Professional Detail",
    allowedRoles: ["super_admin", "ops_admin"],
  },
  {
    path: "/projects",
    section: "operations",
    title: "Project Management",
    allowedRoles: ["super_admin", "ops_admin"],
  },
  {
    path: "/projects/[id]",
    section: "operations",
    title: "Project Detail",
    allowedRoles: ["super_admin", "ops_admin"],
  },
  {
    path: "/properties",
    section: "operations",
    title: "Real Estate & Properties",
    allowedRoles: ["super_admin", "ops_admin"],
  },
  {
    path: "/properties/[id]",
    section: "operations",
    title: "Property Detail",
    allowedRoles: ["super_admin", "ops_admin"],
  },
  {
    path: "/services",
    section: "operations",
    title: "Service Catalog",
    allowedRoles: ["super_admin", "ops_admin"],
  },
  {
    path: "/services/[id]",
    section: "operations",
    title: "Service Detail",
    allowedRoles: ["super_admin", "ops_admin"],
  },
  {
    path: "/stores",
    section: "operations",
    title: "Storefront Operations",
    allowedRoles: ["super_admin", "ops_admin"],
  },
  {
    path: "/stores/[id]",
    section: "operations",
    title: "Storefront Detail",
    allowedRoles: ["super_admin", "ops_admin"],
  },
  {
    path: "/settings",
    section: "settings",
    title: "Admin System Settings",
    allowedRoles: ["super_admin"],
  },
] as const;

/** Matcher for public authentication and status pages */
export const isPublicRoute = createRouteMatcher([
  "/sign-in(.*)",
  "/unauthorized(.*)",
  "/unauthorized-sign-in(.*)",
]);

/** Matcher for general dashboard routes requiring admin privileges */
export const isDashboardRoute = createRouteMatcher([
  "/",
  "/analytics(.*)",
  "/audit(.*)",
  "/leads(.*)",
  "/professionals(.*)",
  "/projects(.*)",
  "/properties(.*)",
  "/services(.*)",
  "/settings(.*)",
  "/stores(.*)",
  "/users(.*)",
]);

/** Matcher for verification queues requiring verification_admin or super_admin */
export const isVerificationRoute = createRouteMatcher([
  "/verifications(.*)",
  "/verification-ops(.*)",
]);
