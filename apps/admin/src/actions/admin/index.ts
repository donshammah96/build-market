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
export type { DashboardStats } from "./dashboard";

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
export type { UserWithProfile, UserDetails } from "./users";

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
  ProfessionalWithUser,
  ProfessionalDetails,
} from "./professionals";

// Projects
export { getProjects, getProjectDetails } from "./projects";
export type { ProjectListItem, ProjectDetails } from "./projects";

// Settings
export {
  getSystemSettings,
  updateSystemSettings,
  clearSystemCache,
} from "./settings";
export type { SystemSettings } from "./settings";

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
} from "./verification";

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
  StoreDetails,
  StoreFilterInput,
  UpdateStoreInput,
} from "./stores";

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
  PropertyDetails,
  PropertyFilterInput,
  UpdatePropertyInput,
} from "./properties";

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
} from "./leads";

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
} from "./services";

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
  AuditLogFilterInput,
} from "./audit";

// Analytics
export {
  getPlatformAnalytics,
  getMetricTimeSeries,
  getGeographicDistribution,
  getTopProfessionals,
} from "./analytics";
export type {
  PlatformAnalytics,
  TimeSeriesData,
  AnalyticsPeriod,
  AnalyticsFilterInput,
} from "./analytics";
