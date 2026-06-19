import { AdminRole, LeadSource, LeadStatus, ProjectType } from "@build/db";
import type { AdminActor } from "@/lib/security/admin-actor";

export type LeadsActor = AdminActor;

export type LeadsDomainErrorCode =
  | "LEADS_NOT_FOUND"
  | "LEADS_POLICY_DENIED"
  | "LEADS_VALIDATION_ERROR"
  | "LEADS_PERSISTENCE_ERROR";

export interface LeadsDomainError {
  code: LeadsDomainErrorCode;
  message: string;
}

export interface LeadFilterInput {
  page?: number | undefined;
  limit?: number | undefined;
  search?: string | undefined;
  status?: LeadStatus | undefined;
  source?: LeadSource | undefined;
  projectType?: ProjectType | undefined;
  professionalId?: string | undefined;
  dateFrom?: string | undefined;
  dateTo?: string | undefined;
  sortBy?: ("createdAt" | "updatedAt" | "clientName" | "status") | undefined;
  sortOrder?: ("asc" | "desc") | undefined;
}

export interface LeadListQuery {
  page: number;
  limit: number;
  skip: number;
  search?: string | undefined;
  status?: LeadStatus | undefined;
  source?: LeadSource | undefined;
  projectType?: ProjectType | undefined;
  professionalId?: string | undefined;
  dateFrom?: Date | undefined;
  dateTo?: Date | undefined;
  sortBy: "createdAt" | "updatedAt" | "clientName" | "status";
  sortOrder: "asc" | "desc";
}

export interface LeadListItem {
  id: string;
  clientName: string;
  clientEmail: string | null;
  clientPhone: string | null;
  projectType: string;
  status: string;
  source: string | null;
  location: string | null;
  budget: string | null;
  createdAt: Date;
  updatedAt: Date;
  professional: {
    userId: string;
    companyName: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
  };
}

export interface LeadDetails {
  id: string;
  clientName: string;
  clientEmail: string;
  clientPhone: string | null;
  projectType: string;
  status: string;
  source: string | null;
  location: string | null;
  budget: string | null;
  notes: string | null;
  followUpDate: Date | null;
  createdAt: Date;
  updatedAt: Date;
  professional: {
    userId: string;
    companyName: string;
    profession: string | null;
    verified: boolean;
    user: {
      id: string;
      email: string;
      firstName: string | null;
      lastName: string | null;
      avatar: string | null;
      phone: string | null;
    };
  };
}

export interface UpdateLeadInput {
  status?: ("NEW" | "CONTACTED" | "PROPOSAL" | "WON" | "LOST") | undefined;
  notes?: string | undefined;
  followUpDate?: string | null | undefined;
}

export interface LeadStatsResult {
  total: number;
  byStatus: { status: string; count: number }[];
  bySource: { source: string; count: number }[];
  byProjectType: { projectType: string; count: number }[];
  thisWeek: number;
  thisMonth: number;
  conversionRate: number;
  recent: {
    id: string;
    clientName: string;
    projectType: string;
    status: string;
    createdAt: Date;
  }[];
  topProfessionals: {
    professionalId: string;
    leadCount: number;
    companyName: string;
  }[];
}

export interface ExportLeadListItem {
  id: string;
  clientName: string;
  clientEmail: string | null;
  clientPhone: string;
  projectType: string;
  status: string;
  source: string;
  location: string;
  budget: string;
  notes: string;
  professionalCompany: string;
  professionalEmail: string;
  createdAt: string;
  updatedAt: string;
}

export interface LeadPageResult {
  leads: LeadListItem[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
  filters: LeadListQuery;
}
