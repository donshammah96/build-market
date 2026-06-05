"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { LeadSource, LeadStatus, ProjectType } from "@build/db";
import { safeAction } from "./shared";
import { leadsService } from "@/lib/domains/leads/service";
import type {
  LeadFilterInput,
  UpdateLeadInput,
} from "@/lib/domains/leads/contracts";

const LeadFilterSchema = z.object({
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(1000).default(10),
  search: z.string().optional(),
  status: z.nativeEnum(LeadStatus).optional(),
  source: z.nativeEnum(LeadSource).optional(),
  projectType: z.nativeEnum(ProjectType).optional(),
  professionalId: z.string().uuid().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  sortBy: z
    .enum(["createdAt", "updatedAt", "clientName", "status"])
    .default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

const UpdateLeadSchema = z.object({
  status: z.enum(["NEW", "CONTACTED", "PROPOSAL", "WON", "LOST"]).optional(),
  notes: z.string().optional(),
  followUpDate: z.string().datetime().optional().nullable(),
});

function parseActionInput<T>(
  schema: z.ZodType<T>,
  input: unknown,
  fallbackMessage: string,
): T {
  const result = schema.safeParse(input);

  if (!result.success) {
    throw new Error(result.error.issues[0]?.message ?? fallbackMessage);
  }

  return result.data;
}

// ============================================================================
// Actions
// ============================================================================

/**
 * Fetches a paginated list of leads with filtering and sorting.
 */
export async function getLeads(filters: Partial<LeadFilterInput> = {}) {
  return safeAction("getLeads", async ({ actor }) => {
    const validatedFilters = parseActionInput(
      LeadFilterSchema,
      filters,
      "Invalid filters",
    );
    const result = await leadsService.listLeadPage(actor, validatedFilters);
    if (!result.ok) {
      throw new Error(result.message);
    }
    return result.data;
  });
}

/**
 * Fetches complete lead details.
 */
export async function getLeadDetails(leadId: string) {
  return safeAction("getLeadDetails", async ({ actor }) => {
    const parsedLeadId = parseActionInput(
      z.string().min(1),
      leadId,
      "Lead ID is required",
    );
    const result = await leadsService.getLeadDetail(actor, parsedLeadId);
    if (!result.ok) {
      throw new Error(result.message);
    }
    return result.data;
  });
}

/**
 * Updates lead information.
 */
export async function updateLead(leadId: string, data: UpdateLeadInput) {
  return safeAction(
    "updateLead",
    async ({ actor }) => {
      const parsedLeadId = parseActionInput(
        z.string().min(1),
        leadId,
        "Lead ID is required",
      );
      const validated = parseActionInput(
        UpdateLeadSchema,
        data,
        "Invalid update data",
      );
      const result = await leadsService.updateLead(
        actor,
        parsedLeadId,
        validated,
      );
      if (!result.ok) {
        throw new Error(result.message);
      }

      revalidatePath("/leads");
      revalidatePath(`/leads/${parsedLeadId}`);

      return result.data;
    },
    {
      auditLog: {
        operation: "UPDATE_LEAD",
        resourceType: "lead",
        getTargetId: () => leadId,
        getDetails: () => data as Record<string, unknown>,
      },
    },
  );
}

/**
 * Deletes a lead.
 */
export async function deleteLead(leadId: string) {
  return safeAction(
    "deleteLead",
    async ({ actor }) => {
      const parsedLeadId = parseActionInput(
        z.string().min(1),
        leadId,
        "Lead ID is required",
      );
      const result = await leadsService.deleteLead(actor, parsedLeadId);
      if (!result.ok) {
        throw new Error(result.message);
      }

      revalidatePath("/leads");

      return result.data;
    },
    {
      auditLog: {
        operation: "DELETE_LEAD",
        resourceType: "lead",
        getTargetId: () => leadId,
        getDetails: ({ data }) => {
          const resultData = data as { clientName: string };
          return { clientName: resultData.clientName };
        },
      },
    },
  );
}

/**
 * Gets lead statistics for dashboard.
 */
export async function getLeadStats() {
  return safeAction("getLeadStats", async ({ actor }) => {
    const result = await leadsService.getLeadStats(actor);
    if (!result.ok) {
      throw new Error(result.message);
    }
    return result.data;
  });
}

/**
 * Bulk update lead status.
 */
export async function bulkUpdateLeadStatus(
  leadIds: string[],
  status: "NEW" | "CONTACTED" | "PROPOSAL" | "WON" | "LOST",
) {
  return safeAction(
    "bulkUpdateLeadStatus",
    async ({ actor }) => {
      const parsedLeadIds = parseActionInput(
        z.array(z.string().min(1)),
        leadIds,
        "Invalid Lead IDs",
      );
      const parsedStatus = parseActionInput(
        z.enum(["NEW", "CONTACTED", "PROPOSAL", "WON", "LOST"]),
        status,
        "Invalid status",
      );
      const result = await leadsService.bulkUpdateLeadStatus(
        actor,
        parsedLeadIds,
        parsedStatus,
      );
      if (!result.ok) {
        throw new Error(result.message);
      }

      revalidatePath("/leads");

      return result.data;
    },
    {
      auditLog: {
        operation: "BULK_UPDATE_LEAD_STATUS",
        resourceType: "lead",
        getTargetId: () => "bulk",
        getDetails: () => ({
          leadCount: leadIds.length,
          newStatus: status,
        }),
      },
    },
  );
}

/**
 * Export leads to CSV format data.
 */
export async function exportLeads(filters: Partial<LeadFilterInput> = {}) {
  return safeAction(
    "exportLeads",
    async ({ actor }) => {
      const validatedFilters = parseActionInput(
        LeadFilterSchema,
        filters,
        "Invalid filters",
      );
      const result = await leadsService.exportLeads(actor, validatedFilters);
      if (!result.ok) {
        throw new Error(result.message);
      }
      return result.data;
    },
    {
      auditLog: {
        operation: "EXPORT_LEADS",
        resourceType: "lead",
        getTargetId: () => "export",
        getDetails: ({ data }) => {
          const resultData = data as { count: number };
          return { count: resultData.count };
        },
      },
    },
  );
}
