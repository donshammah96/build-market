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
  deleteUser 
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
export type { ProfessionalWithUser, ProfessionalDetails } from "./professionals";

// Projects
export { 
  getProjects, 
  getProjectDetails 
} from "./projects";
export type { ProjectListItem, ProjectDetails } from "./projects";

// Settings
export { 
  getSystemSettings, 
  updateSystemSettings, 
  clearSystemCache 
} from "./settings";
export type { SystemSettings } from "./settings";
