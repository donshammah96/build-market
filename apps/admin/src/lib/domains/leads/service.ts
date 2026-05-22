import { err, ok, type Result } from "@/lib/errors/result";
import {
  AdminCapability,
  requireAdminCapability,
} from "@/lib/security/authorization-policy";
import type {
  ExportLeadListItem,
  LeadDetails,
  LeadFilterInput,
  LeadListQuery,
  LeadPageResult,
  LeadStatsResult,
  LeadsActor,
  LeadsDomainError,
  UpdateLeadInput,
} from "./contracts";
import { leadsRepository } from "./repository";

function requireViewContent(actor: LeadsActor): Result<true, LeadsDomainError> {
  const policy = requireAdminCapability(actor, AdminCapability.VIEW_CONTENT);
  if (!policy.success) {
    return err({
      code: "LEADS_POLICY_DENIED",
      message: "Admin capability denied",
    });
  }
  return ok(true);
}

function requireManageContent(
  actor: LeadsActor,
): Result<true, LeadsDomainError> {
  const policy = requireAdminCapability(actor, AdminCapability.MANAGE_CONTENT);
  if (!policy.success) {
    return err({
      code: "LEADS_POLICY_DENIED",
      message: "Admin capability denied",
    });
  }
  return ok(true);
}

function requireExportData(actor: LeadsActor): Result<true, LeadsDomainError> {
  const policy = requireAdminCapability(actor, AdminCapability.EXPORT_DATA);
  if (!policy.success) {
    return err({
      code: "LEADS_POLICY_DENIED",
      message: "Admin capability denied",
    });
  }
  return ok(true);
}

const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 10;

export function buildLeadListQuery(
  input: LeadFilterInput = {},
): Result<LeadListQuery, LeadsDomainError> {
  const page = Math.max(1, input.page ?? 1);
  const limit = Math.min(MAX_LIMIT, Math.max(1, input.limit ?? DEFAULT_LIMIT));

  return ok({
    page,
    limit,
    skip: (page - 1) * limit,
    search: input.search?.trim() || undefined,
    status: input.status,
    source: input.source,
    projectType: input.projectType,
    professionalId: input.professionalId,
    dateFrom: input.dateFrom ? new Date(input.dateFrom) : undefined,
    dateTo: input.dateTo ? new Date(input.dateTo) : undefined,
    sortBy: input.sortBy ?? "createdAt",
    sortOrder: input.sortOrder ?? "desc",
  });
}

export async function listLeadPage(
  actor: LeadsActor,
  input: LeadFilterInput = {},
): Promise<Result<LeadPageResult, LeadsDomainError>> {
  const cap = requireViewContent(actor);
  if (!cap.ok) return cap;

  const queryResult = buildLeadListQuery(input);
  if (!queryResult.ok) return queryResult;

  const query = queryResult.data;
  const [leads, total] = await Promise.all([
    leadsRepository.listLeads(query),
    leadsRepository.countLeads(query),
  ]);

  return ok({
    leads,
    meta: {
      total,
      page: query.page,
      limit: query.limit,
      totalPages: Math.ceil(total / query.limit),
    },
    filters: query,
  });
}

export async function getLeadDetail(
  actor: LeadsActor,
  leadId: string,
): Promise<Result<LeadDetails, LeadsDomainError>> {
  const cap = requireViewContent(actor);
  if (!cap.ok) return cap;

  const lead = await leadsRepository.findLeadById(leadId);
  if (!lead) {
    return err({ code: "LEADS_NOT_FOUND", message: "Lead not found" });
  }

  return ok(lead);
}

export async function getLeadStats(
  actor: LeadsActor,
): Promise<Result<LeadStatsResult, LeadsDomainError>> {
  const cap = requireViewContent(actor);
  if (!cap.ok) return cap;

  const stats = await leadsRepository.getLeadStats();
  return ok(stats);
}

export async function updateLead(
  actor: LeadsActor,
  leadId: string,
  data: UpdateLeadInput,
): Promise<
  Result<
    {
      updated: boolean;
      lead: { id: string; clientName: string; status: string; updatedAt: Date };
    },
    LeadsDomainError
  >
> {
  const cap = requireManageContent(actor);
  if (!cap.ok) return cap;

  const lead = await leadsRepository.updateLeadById(leadId, data);
  return ok({ updated: true, lead });
}

export async function deleteLead(
  actor: LeadsActor,
  leadId: string,
): Promise<
  Result<
    { deleted: boolean; leadId: string; clientName: string },
    LeadsDomainError
  >
> {
  const cap = requireManageContent(actor);
  if (!cap.ok) return cap;

  const lead = await leadsRepository.deleteLeadById(leadId);
  return ok({ deleted: true, leadId: lead.id, clientName: lead.clientName });
}

export async function bulkUpdateLeadStatus(
  actor: LeadsActor,
  leadIds: string[],
  status: "NEW" | "CONTACTED" | "PROPOSAL" | "WON" | "LOST",
): Promise<
  Result<{ updated: boolean; count: number; status: string }, LeadsDomainError>
> {
  const cap = requireManageContent(actor);
  if (!cap.ok) return cap;

  const res = await leadsRepository.bulkUpdateStatus(leadIds, status);
  return ok({ updated: true, count: res.count, status });
}

export async function exportLeads(
  actor: LeadsActor,
  filters: LeadFilterInput = {},
): Promise<
  Result<{ data: ExportLeadListItem[]; count: number }, LeadsDomainError>
> {
  const cap = requireExportData(actor);
  if (!cap.ok) return cap;

  const queryResult = buildLeadListQuery({ ...filters, limit: 1000 });
  if (!queryResult.ok) return queryResult;

  const leads = await leadsRepository.findLeadsForExport(queryResult.data);
  const exportData = leads.map((lead) => ({
    id: lead.id,
    clientName: lead.clientName,
    clientEmail: lead.clientEmail,
    clientPhone: lead.clientPhone || "",
    projectType: lead.projectType,
    status: lead.status,
    source: lead.source || "",
    location: lead.location || "",
    budget: lead.budget ? lead.budget.toString() : "",
    notes: lead.notes || "",
    professionalCompany: lead.professional.companyName,
    professionalEmail: lead.professional.user.email,
    createdAt: lead.createdAt.toISOString(),
    updatedAt: lead.updatedAt.toISOString(),
  }));

  return ok({
    data: exportData,
    count: exportData.length,
  });
}

export const leadsService = {
  buildLeadListQuery,
  listLeadPage,
  getLeadDetail,
  getLeadStats,
  updateLead,
  deleteLead,
  bulkUpdateLeadStatus,
  exportLeads,
};
