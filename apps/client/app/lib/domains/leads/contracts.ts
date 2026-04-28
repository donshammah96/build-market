import { z } from "zod";
import type { AppRole } from "@/app/lib/security/roles";
import type { DomainError, Result } from "@/app/lib/errors/result";
import {
  CreateLeadSchema as CreateLeadSchemaValue,
  CreatePublicLeadSchema as CreatePublicLeadSchemaValue,
  LEAD_STATUS_LABELS,
  LeadQuerySchema as LeadQuerySchemaValue,
  UpdateLeadSchema as UpdateLeadSchemaValue,
} from "@/app/lib/validation/leads-validation";

export {
  CreateLeadSchemaValue as CreateLeadSchema,
  CreatePublicLeadSchemaValue as CreatePublicLeadSchema,
  LeadQuerySchemaValue as LeadQuerySchema,
  UpdateLeadSchemaValue as UpdateLeadSchema,
  LEAD_STATUS_LABELS,
};

export type LeadQueryInput = z.infer<typeof LeadQuerySchemaValue>;
export type CreateLeadInput = z.infer<typeof CreateLeadSchemaValue>;
export type UpdateLeadInput = z.infer<typeof UpdateLeadSchemaValue>;
export type CreatePublicLeadInput = z.infer<typeof CreatePublicLeadSchemaValue>;

export type LeadActor = {
  userId: string;
  role?: AppRole | string | null;
};

export type LeadDomainErrorCode =
  | "not_found"
  | "forbidden"
  | "conflict"
  | "invalid_input"
  | "internal"
  | "professional_not_found";

export type LeadDomainError = DomainError<LeadDomainErrorCode>;

export type LeadResult<T> = Result<T, LeadDomainError>;

export type LeadListItem = {
  id: string;
  clientName: string;
  clientEmail: string | null;
  clientPhone: string | null;
  clientId: string | null;
  title: string;
  projectType: string;
  location: string | null;
  county: string | null;
  budget: number | null;
  budgetMin: number | null;
  budgetMax: number | null;
  currency: string;
  status: string;
  priority: string;
  source: string;
  lostReason: string | null;
  followUpDate: string | null;
  lastContactedAt: string | null;
  reminderSent: boolean;
  createdAt: string;
  updatedAt: string;
};

export type LeadListResult = {
  leads: LeadListItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export type LeadDetailResult = LeadListItem & {
  description: string | null;
  notes: string | null;
  wonAt: string | null;
  client: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string | null;
    avatar: string | null;
  } | null;
};

export type PublicLeadCreateResult = {
  message: string;
  lead: {
    id: string;
    projectType: string;
    status: string;
    createdAt: string;
  };
};

export type PublicLeadStatusResult = {
  id: string;
  title: string;
  projectType: string;
  location: string | null;
  status: string;
  statusLabel: string;
  professionalName: string;
  submittedAt: string;
  lastUpdated: string;
};
