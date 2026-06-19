/**
 * Admin Actions - Domain Module Exports
 *
 * This module re-exports all admin actions organized by domain.
 * Import from this file to access any admin action:
 *
 * @example
 * import { getUsers, verifyProfessional, getDashboardStats } from "@/actions/admin";
 */

// Types & Shared Utilities
export type {
  ActionResponse,
  PaginationMeta,
  SystemSettingsInput,
  UpdateProfileInput,
} from "./shared";

// Dashboard
export { getDashboardStats } from "./dashboard";
export type { DashboardStats } from "@/lib/domains/dashboard/contracts";

// Users
export {
  getUsers,
  getUserDetails,
  deleteUser,
  deleteUsersBulk,
  inviteUser,
  resetUserCredentials,
  assignUserRole,
} from "./users";
export type {
  AdminUserListItem as UserWithProfile,
  AdminUserDetails as UserDetails,
} from "@/lib/domains/users";

// Professionals
export {
  getProfessionals,
  getProfessionalDetails,
  verifyProfessional,
  rejectProfessional,
  updateProfessionalProfile,
  deleteCertificate,
} from "./professionals";
export type {
  ProfessionalDetails,
  ProfessionalListItem as ProfessionalWithUser,
} from "@/lib/domains/professionals/contracts";

// Projects
export { getProjects, getProjectDetails } from "./projects";
export type {
  ProjectListItem,
  ProjectDetails,
} from "@/lib/domains/projects/contracts";

// Settings
export {
  getSystemSettings,
  updateSystemSettings,
  clearSystemCache,
} from "./settings";
export type { SystemSettings } from "@/lib/domains/settings/contracts";

// Onboarding Remediation
export {
  onboardingReconcile,
  onboardingClerkSync,
  onboardingIdempotencyReconcile,
} from "./onboarding-remediation";
export type {
  AdminOnboardingReconciliationResult,
  AdminOnboardingClerkSyncResult,
  AdminOnboardingIdempotencyReconcileResult,
} from "./types";

// Verification
export {
  getPendingVerifications,
  getVerificationStats,
  getVerificationDetails,
  verifyEntity,
  verifyDocument,
  batchVerifyDocuments,
  batchVerifyEntities,
  getVerificationUpdates,
} from "./verification";
export type {
  EntityType,
  VerificationAction,
  DocumentAction,
  VerificationStatus,
  VerificationQueueItem,
  VerificationStats,
  VerificationDetails,
  VerificationFilterInput,
  VerifyEntityInput,
  VerifyDocumentInput,
  BatchVerifyDocumentsInput,
} from "./types";

// Stores
export {
  getStores,
  getStoreDetails,
  updateStore,
  toggleStoreFeatured,
  verifyStore,
  rejectStore,
  deleteStore,
  getStoreStats,
} from "./stores";
export type {
  StoreListItem,
  StoreDetailResult as StoreDetails,
  StoreFilterInput,
  StoreUpdateInput as UpdateStoreInput,
} from "@/lib/domains/stores/contracts";

// Properties
export {
  getProperties,
  getPropertyDetails,
  updateProperty,
  togglePropertyFeatured,
  verifyProperty,
  rejectProperty,
  changePropertyStatus,
  deleteProperty,
  getPropertyStats,
} from "./properties";
export type {
  PropertyListItem,
  PropertyDetailResult as PropertyDetails,
  PropertyFilterInput,
  PropertyUpdateInput as UpdatePropertyInput,
} from "@/lib/domains/properties/contracts";

// Leads
export {
  getLeads,
  getLeadDetails,
  updateLead,
  deleteLead,
  getLeadStats,
  bulkUpdateLeadStatus,
  exportLeads,
} from "./leads";
export type {
  LeadListItem,
  LeadDetails,
  LeadFilterInput,
  UpdateLeadInput,
} from "@/lib/domains/leads/contracts";

// Service Categories
export {
  getServiceCategories,
  getServiceCategoryDetails,
  createServiceCategory,
  updateServiceCategory,
  toggleServiceCategoryActive,
  deleteServiceCategory,
  reorderServiceCategories,
  getServiceCategoryStats,
} from "./services";
export type {
  ServiceCategoryListItem,
  ServiceCategoryDetails,
  ServiceFilterInput,
  CreateServiceInput,
  UpdateServiceInput,
} from "@/lib/domains/services/contracts";

// Audit Logs
export {
  getAuditLogs,
  getAuditLogStats,
  getAuditLogActions,
  exportAuditLogs,
} from "./audit";
export type {
  AuditLogEntry,
  AuditLogStats,
  AuditLogPage,
  AuditExportPage,
  AuditExportEntry,
  AuditLogInput,
} from "@/lib/domains/audit/contracts";

// Analytics
export {
  getPlatformAnalytics,
  getMetricTimeSeries,
  getGeographicDistribution,
  getTopProfessionals,
} from "./analytics";
export type {
  PlatformAnalyticsResult as PlatformAnalytics,
  AnalyticsPeriod,
  AnalyticsInput as AnalyticsFilterInput,
} from "@/lib/domains/finance/contracts";
import type { TimeSeriesEntry } from "@/lib/domains/finance/contracts";
export type TimeSeriesData = TimeSeriesEntry[];
