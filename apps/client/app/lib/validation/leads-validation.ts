import { z } from "zod";
import {
  LeadStatus,
  LeadPriority,
  LeadSource,
  LostReason,
  ProjectType,
  County,
} from "@prisma/client";

/**
 * Shared validation schemas for Lead API routes.
 * Uses Prisma-generated enums for type safety.
 * Aligned with Lead model in schema.prisma.
 */

// ─── Enum Schemas ────────────────────────────────────────────────────

export const LeadStatusSchema = z.nativeEnum(LeadStatus);
export const LeadPrioritySchema = z.nativeEnum(LeadPriority);
export const LeadSourceSchema = z.nativeEnum(LeadSource);
export const LostReasonSchema = z.nativeEnum(LostReason);
export const ProjectTypeSchema = z.nativeEnum(ProjectType);
export const CountySchema = z.nativeEnum(County);

// ═══════════════════════════════════════════════════════════════════════
// QUERY & MUTATION SCHEMAS
// ═══════════════════════════════════════════════════════════════════════

/** Query parameters for GET /api/professional-portal/leads */
export const LeadQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  status: z
    .string()
    .optional()
    .transform((val) => {
      if (!val) return undefined;
      // Support comma-separated values: "NEW,CONTACTED"
      const values = val
        .split(",")
        .map((s) => s.trim().toUpperCase())
        .filter((s) =>
          Object.values(LeadStatus).includes(s as LeadStatus),
        ) as LeadStatus[];
      return values.length > 0 ? values : undefined;
    }),
  priority: LeadPrioritySchema.optional(),
  source: LeadSourceSchema.optional(),
});

export type LeadQueryInput = z.infer<typeof LeadQuerySchema>;

/** Body schema for POST /api/professional-portal/leads */
export const CreateLeadSchema = z.object({
  clientName: z.string().min(1, "Client name is required").max(200),
  clientEmail: z.string().email().optional().or(z.literal("")),
  clientPhone: z.string().max(20).optional(),
  clientId: z.string().uuid().optional(),
  title: z.string().min(1, "Title is required").max(200),
  description: z.string().max(5000).optional(),
  projectType: ProjectTypeSchema.optional().default("RESIDENTIAL"),
  location: z.string().max(500).optional(),
  county: CountySchema.optional(),
  budget: z.number().positive().optional(),
  budgetMin: z.number().positive().optional(),
  budgetMax: z.number().positive().optional(),
  currency: z.string().max(3).optional().default("KES"),
  status: LeadStatusSchema.optional().default("NEW"),
  priority: LeadPrioritySchema.optional().default("MEDIUM"),
  source: LeadSourceSchema.optional().default("PLATFORM_SEARCH"),
  notes: z.string().max(5000).optional(),
  followUpDate: z.string().datetime().optional(),
});

export type CreateLeadInput = z.infer<typeof CreateLeadSchema>;

/** Body schema for PATCH /api/professional-portal/leads/[id] */
export const UpdateLeadSchema = z.object({
  clientName: z.string().min(1).max(200).optional(),
  clientEmail: z.string().email().optional().or(z.literal("")),
  clientPhone: z.string().max(20).optional(),
  clientId: z.string().uuid().nullable().optional(),
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(5000).optional(),
  projectType: ProjectTypeSchema.optional(),
  location: z.string().max(500).optional(),
  county: CountySchema.optional(),
  budget: z.number().positive().optional(),
  budgetMin: z.number().positive().optional(),
  budgetMax: z.number().positive().optional(),
  currency: z.string().max(3).optional(),
  status: LeadStatusSchema.optional(),
  priority: LeadPrioritySchema.optional(),
  source: LeadSourceSchema.optional(),
  lostReason: LostReasonSchema.optional(),
  notes: z.string().max(5000).optional(),
  followUpDate: z.string().datetime().nullable().optional(),
  lastContactedAt: z.string().datetime().optional(),
});

export type UpdateLeadInput = z.infer<typeof UpdateLeadSchema>;

// ═══════════════════════════════════════════════════════════════════════
// PRISMA SELECT OBJECTS (Data Minimization)
// ═══════════════════════════════════════════════════════════════════════

/** Prisma select for lead list queries */
export const leadListSelect = {
  id: true,
  clientName: true,
  clientEmail: true,
  clientPhone: true,
  clientId: true,
  title: true,
  projectType: true,
  location: true,
  county: true,
  budget: true,
  budgetMin: true,
  budgetMax: true,
  currency: true,
  status: true,
  priority: true,
  source: true,
  lostReason: true,
  followUpDate: true,
  lastContactedAt: true,
  reminderSent: true,
  createdAt: true,
  updatedAt: true,
} as const;

/** Prisma select for lead detail queries */
export const leadDetailSelect = {
  ...leadListSelect,
  description: true,
  notes: true,
  wonAt: true,
  client: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      avatar: true,
    },
  },
} as const;

// ─── UI Interfaces ──────────────────────────────────────────────────────────

export interface Lead {
  id: string;
  clientName: string;
  clientEmail?: string | null;
  clientPhone?: string | null;
  projectType: ProjectType;
  location?: string | null;
  budget?: string | null;
  status: LeadStatus;
  notes?: string | null;
  followUpDate?: string | null;
  source?: LeadSource;
  createdAt: string | Date;
  updatedAt: string | Date;
}

export interface LeadList {
  id: string;
  clientName: string;
  clientEmail?: string | null;
  clientPhone?: string | null;
  projectType: ProjectType;
  location?: string | null;
  budget?: string | null;
  status: LeadStatus;
  createdAt: string | Date;
  updatedAt: string | Date;
}

// ═══════════════════════════════════════════════════════════════════════
// PUBLIC LEAD SCHEMAS (for /api/leads — unauthenticated contact form)
// ═══════════════════════════════════════════════════════════════════════

/** Body schema for POST /api/leads — public inquiry submission */
export const CreatePublicLeadSchema = z.object({
  professionalId: z.string().uuid("Invalid professional ID"),
  clientName: z.string().min(1, "Name is required").max(200),
  clientEmail: z.string().email("Invalid email address"),
  clientPhone: z.string().max(20).optional(),
  title: z.string().min(1, "Subject is required").max(200),
  projectType: ProjectTypeSchema.optional().default("RESIDENTIAL"),
  message: z.string().min(1, "Message is required").max(5000),
  location: z.string().max(500).optional(),
  county: CountySchema.optional(),
  budget: z.number().positive().optional(),
  source: LeadSourceSchema.optional().default("PLATFORM_SEARCH"),
});

export type CreatePublicLeadInput = z.infer<typeof CreatePublicLeadSchema>;

/** Prisma select for public lead creation response (sanitized) */
export const publicLeadCreateSelect = {
  id: true,
  projectType: true,
  status: true,
  createdAt: true,
} as const;

/** Prisma select for public lead status lookup */
export const publicLeadStatusSelect = {
  id: true,
  title: true,
  projectType: true,
  status: true,
  location: true,
  createdAt: true,
  updatedAt: true,
  professional: {
    select: {
      companyName: true,
      user: {
        select: {
          firstName: true,
          lastName: true,
        },
      },
    },
  },
} as const;

/** Human-readable status labels for public display */
export const LEAD_STATUS_LABELS: Record<string, string> = {
  NEW: "Submitted",
  CONTACTED: "Under Review",
  PROPOSAL: "Proposal Sent",
  WON: "Accepted",
  LOST: "Closed",
} as const;

// ═══════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════

export const LEAD_CONFIG = {
  MAX_BODY_SIZE: 32 * 1024, // 32KB
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,
} as const;
