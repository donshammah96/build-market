import { z } from "zod";

// ============================================================================
// Types
// ============================================================================

/**
 * Standardized response wrapper for all admin actions.
 * Supports optimistic updates by including the updated entity in `data`.
 */
export type ActionResponse<T = null> = {
  success: boolean;
  data?: T;
  error?: string;
  /** Timestamp for cache invalidation in optimistic updates */
  timestamp?: string;
  meta?: PaginationMeta;
};

export type PaginationMeta = {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

// ============================================================================
// Schemas
// ============================================================================

export const PaginationSchema = z.object({
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(100).default(10),
  search: z.string().optional(),
});

export const UpdateProfileSchema = z.object({
  companyName: z.string().min(2).optional(),
  licenseNumber: z.string().optional(),
  yearsExperience: z.number().min(0).optional(),
  bio: z.string().max(1000).optional(),
  website: z.string().url().optional().or(z.literal("")),
  servicesOffered: z.array(z.string()).optional(),
  city: z.string().optional(),
  county: z.string().optional(),
  country: z.string().optional(),
});

export const SystemSettingsSchema = z.object({
  maintenanceMode: z.boolean(),
  publicSignup: z.boolean(),
  autoVerifyNCA: z.boolean(),
  commissionRate: z.number().min(0).max(100),
  supportEmail: z.string().email(),
  adminEmailAlerts: z.boolean(),
  securityMFA: z.boolean(),
});

export type SystemSettingsInput = z.infer<typeof SystemSettingsSchema>;
export type UpdateProfileInput = z.infer<typeof UpdateProfileSchema>;
