import { LeadStatus } from "@prisma/client";
import { createNotification } from "@/lib/notifications";
import { err, ok } from "@/app/lib/errors/result";
import { normalizeRole } from "@/app/lib/security/roles";
import { leadsRepository } from "@/app/lib/domains/leads/repository";
import {
  toLeadDetailDto,
  toLeadListItemDto,
  toPublicLeadCreateDto,
  toPublicLeadStatusDto,
} from "@/app/lib/domains/leads/mappers";
import {
  LEAD_STATUS_LABELS,
  type CreateLeadInput,
  type CreatePublicLeadInput,
  type LeadActor,
  type LeadDetailResult,
  type LeadListResult,
  type LeadResult,
  type LeadQueryInput,
  type PublicLeadCreateResult,
  type PublicLeadStatusResult,
  type UpdateLeadInput,
} from "@/app/lib/domains/leads/contracts";

const PROFESSIONAL_LEAD_ROLES = new Set(["professional", "admin"]);

function forbidden(message = "Forbidden"): LeadResult<never> {
  return err({ error: "forbidden", message, status: 403 });
}

function notFound(message = "Lead not found"): LeadResult<never> {
  return err({ error: "not_found", message, status: 404 });
}

function requireProfessionalLeadActor(
  actor: LeadActor,
): LeadResult<{ userId: string }> {
  const role = normalizeRole(actor.role);
  if (!role || !PROFESSIONAL_LEAD_ROLES.has(role)) {
    return forbidden();
  }

  return ok({ userId: actor.userId });
}

async function getOwnedLeadDetail(
  actor: LeadActor,
  leadId: string,
): Promise<LeadResult<LeadDetailResult>> {
  const actorResult = requireProfessionalLeadActor(actor);
  if (!actorResult.ok) {
    return actorResult;
  }

  const lead = await leadsRepository.findProfessionalLeadById(leadId);

  if (!lead) {
    return notFound();
  }

  if (lead.professionalId !== actorResult.data.userId) {
    return forbidden();
  }

  const { professionalId, ...rest } = lead;
  void professionalId;
  return ok(toLeadDetailDto(rest as Parameters<typeof toLeadDetailDto>[0]));
}

export const leadsService = {
  async listProfessionalLeads(
    actor: LeadActor,
    query: LeadQueryInput,
  ): Promise<LeadResult<LeadListResult>> {
    const actorResult = requireProfessionalLeadActor(actor);
    if (!actorResult.ok) {
      return actorResult;
    }

    const userId = actorResult.data.userId;
    const { page, limit, status, priority, source } = query;
    const skip = (page - 1) * limit;

    let statusFilter: LeadStatus | { in: LeadStatus[] } | undefined;
    if (status && status.length === 1) {
      statusFilter = status[0];
    } else if (status && status.length > 1) {
      statusFilter = { in: status };
    }

    const where = {
      professionalId: userId,
      ...(statusFilter && { status: statusFilter }),
      ...(priority && { priority }),
      ...(source && { source }),
    };

    const [rawLeads, total] = await leadsRepository.listProfessionalLeads(
      where,
      skip,
      limit,
    );

    const leads = rawLeads.map((r) =>
      toLeadListItemDto(r as Parameters<typeof toLeadListItemDto>[0]),
    );

    return ok({
      leads,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  },

  async getProfessionalLeadById(
    actor: LeadActor,
    leadId: string,
  ): Promise<LeadResult<LeadDetailResult>> {
    return getOwnedLeadDetail(actor, leadId);
  },

  async createProfessionalLead(
    actor: LeadActor,
    data: CreateLeadInput,
  ): Promise<LeadResult<LeadListResult["leads"][number]>> {
    const actorResult = requireProfessionalLeadActor(actor);
    if (!actorResult.ok) {
      return actorResult;
    }

    const userId = actorResult.data.userId;
    const lead = await leadsRepository.createProfessionalLead(userId, data);
    return ok(
      toLeadListItemDto(lead as Parameters<typeof toLeadListItemDto>[0]),
    );
  },

  async updateProfessionalLead(
    actor: LeadActor,
    leadId: string,
    data: UpdateLeadInput,
  ): Promise<LeadResult<LeadDetailResult>> {
    const existing = await getOwnedLeadDetail(actor, leadId);
    if (!existing.ok) {
      return existing;
    }

    const updated = await leadsRepository.updateProfessionalLead(leadId, data);
    return ok(
      toLeadDetailDto(updated as Parameters<typeof toLeadDetailDto>[0]),
    );
  },

  async deleteProfessionalLead(
    actor: LeadActor,
    leadId: string,
  ): Promise<LeadResult<{ message: string; leadId: string }>> {
    const existing = await getOwnedLeadDetail(actor, leadId);
    if (!existing.ok) {
      return existing;
    }

    await leadsRepository.deleteProfessionalLead(leadId);

    return ok({ message: "Lead deleted successfully", leadId });
  },

  async submitPublicLead(
    input: CreatePublicLeadInput,
  ): Promise<LeadResult<PublicLeadCreateResult>> {
    const professional =
      await leadsRepository.findProfessionalProfileForPublicLead(
        input.professionalId,
      );

    if (!professional) {
      return err({
        error: "professional_not_found",
        message: "Professional not found",
        status: 404,
      });
    }

    const lead = await leadsRepository.createPublicLead(input);

    void createNotification({
      userId: input.professionalId,
      title: "New Lead Received",
      message: `New inquiry from ${input.clientName}: ${input.title}`,
      type: "LEAD",
      link: "/professional-portal/leads",
    });

    return ok({
      message: "Inquiry sent successfully",
      lead: toPublicLeadCreateDto(lead),
    });
  },

  async getPublicLeadStatus(
    leadId: string,
  ): Promise<LeadResult<PublicLeadStatusResult>> {
    const lead = await leadsRepository.findPublicLeadStatus(leadId);

    if (!lead) {
      return notFound();
    }

    return ok(
      toPublicLeadStatusDto(
        lead as Parameters<typeof toPublicLeadStatusDto>[0],
        LEAD_STATUS_LABELS[lead.status] ?? lead.status,
      ),
    );
  },
};
