"use server";

import { z } from "zod";
import {
  leadsService,
  type LeadQueryInput,
  type CreateLeadInput,
  type UpdateLeadInput,
} from "@/app/lib/domains/leads";
import {
  LeadQuerySchema,
  CreateLeadSchema,
  UpdateLeadSchema,
} from "@/app/lib/validation/leads-validation";
import { IdempotencyService } from "@/app/lib/services/idempotency.service";
import { LEAD_CONFIG } from "@/app/lib/config/lead.config";
import {
  createActionFailure,
  secureAction,
  SecureActionError,
  throwActionFailure,
  unwrapResultOrThrow,
  type ActionResult,
} from "@/app/lib/actions/secure-action";
import { normalizeRole } from "@/app/lib/security/roles";
import { revalidatePath } from "next/cache";

const LeadIdActionSchema = z.object({
  leadId: z.string().uuid("Invalid lead ID"),
});

const CreateLeadActionSchema = CreateLeadSchema.extend({
  idempotencyKey: z.string().optional(),
});

const UpdateLeadActionSchema = z.object({
  leadId: z.string().uuid("Invalid lead ID"),
  data: UpdateLeadSchema,
  idempotencyKey: z.string().optional(),
});

const DeleteLeadActionSchema = z.object({
  leadId: z.string().uuid("Invalid lead ID"),
  idempotencyKey: z.string().optional(),
});

function createLeadsActionErrorMapper(message: string) {
  return (error: unknown) => {
    if (error instanceof SecureActionError) {
      return undefined;
    }

    if (error instanceof z.ZodError) {
      return createActionFailure(
        "validation_error",
        error.issues[0]?.message ?? "Validation failed",
        400,
        error.issues,
      );
    }

    return createActionFailure("internal", message, 500);
  };
}

function ensureProfessionalLeadActor(role: string | null | undefined) {
  const normalizedRole = normalizeRole(role);
  if (normalizedRole !== "PROFESSIONAL" && normalizedRole !== "ADMIN") {
    return createActionFailure("forbidden", "Forbidden", 403);
  }

  return true;
}

export async function getProfessionalLeadsAction(
  filters?: Partial<LeadQueryInput>,
): Promise<ActionResult<unknown>> {
  return secureAction({
    input: filters,
    schema: LeadQuerySchema.partial().optional(),
    policy: ({ actor }) => ensureProfessionalLeadActor(actor?.role),
    handler: async ({ actor, input }) => {
      const parsedResult = LeadQuerySchema.safeParse({
        page: 1,
        limit: LEAD_CONFIG.DEFAULT_LIMIT,
        ...input,
      });

      if (!parsedResult.success) {
        throwActionFailure(
          createActionFailure(
            "validation_error",
            parsedResult.error.issues[0]?.message ?? "Invalid query parameters",
            400,
            parsedResult.error.issues,
          ),
        );
      }

      const parsed = parsedResult.data;

      return unwrapResultOrThrow(
        await leadsService.listProfessionalLeads(
          {
            userId: actor!.dbUserId,
            role: actor!.role,
          },
          parsed,
        ),
        "Failed to fetch leads",
      );
    },
    mapError: createLeadsActionErrorMapper("Failed to fetch leads"),
  });
}

export async function getProfessionalLeadByIdAction(
  leadId: string,
): Promise<ActionResult<unknown>> {
  return secureAction({
    input: { leadId },
    schema: LeadIdActionSchema,
    policy: ({ actor }) => ensureProfessionalLeadActor(actor?.role),
    handler: async ({ actor, input }) =>
      unwrapResultOrThrow(
        await leadsService.getProfessionalLeadById(
          {
            userId: actor!.dbUserId,
            role: actor!.role,
          },
          input.leadId,
        ),
        "Failed to fetch lead",
      ),
    mapError: createLeadsActionErrorMapper("Failed to fetch lead"),
  });
}

export type CreateLeadActionInput = CreateLeadInput & {
  idempotencyKey?: string;
};

export async function createProfessionalLeadAction(
  data: CreateLeadActionInput,
): Promise<ActionResult<unknown>> {
  return secureAction({
    input: data,
    schema: CreateLeadActionSchema,
    policy: ({ actor }) => ensureProfessionalLeadActor(actor?.role),
    handler: async ({ actor, input }) => {
      const { idempotencyKey: clientKey, ...payload } = input;
      const idempotencyKey =
        clientKey ??
        IdempotencyService.generateKey(actor!.dbUserId, "POST", {
          domain: "lead",
          clientName: payload.clientName,
          title: payload.title,
        });

      const idempotencyCheck = await IdempotencyService.checkOrCreate(
        idempotencyKey,
        "lead",
        actor!.dbUserId,
        "POST",
        undefined,
        LEAD_CONFIG.IDEMPOTENCY_KEY_TTL_HOURS,
      );

      if (
        idempotencyCheck?.status === "completed" &&
        idempotencyCheck.response
      ) {
        revalidatePath("/professional-portal/leads");
        return idempotencyCheck.response;
      }

      if (idempotencyCheck?.status === "pending") {
        throwActionFailure(
          createActionFailure(
            "conflict",
            "Request is being processed. Please wait.",
            409,
          ),
        );
      }

      try {
        const createdLead = unwrapResultOrThrow(
          await leadsService.createProfessionalLead(
            {
              userId: actor!.dbUserId,
              role: actor!.role,
            },
            payload,
          ),
          "Failed to create lead",
        );
        await IdempotencyService.complete(idempotencyKey, createdLead);
        revalidatePath("/professional-portal/leads");
        return createdLead;
      } catch (error) {
        await IdempotencyService.fail(idempotencyKey);
        throw error;
      }
    },
    mapError: createLeadsActionErrorMapper("Failed to create lead"),
  });
}

export type UpdateLeadActionInput = {
  leadId: string;
  data: UpdateLeadInput;
  idempotencyKey?: string;
};

/** Return type of updateProfessionalLeadAction on success */
export type UpdateLeadResult = Awaited<
  ReturnType<typeof updateProfessionalLeadAction>
>;

export async function updateProfessionalLeadAction(
  input: UpdateLeadActionInput,
): Promise<ActionResult<unknown>> {
  return secureAction({
    input,
    schema: UpdateLeadActionSchema,
    policy: ({ actor }) => ensureProfessionalLeadActor(actor?.role),
    handler: async ({ actor, input: validatedInput }) => {
      const idempotencyKey =
        validatedInput.idempotencyKey ??
        IdempotencyService.generateKey(actor!.dbUserId, "PATCH", {
          leadId: validatedInput.leadId,
          ...validatedInput.data,
        });

      const idempotencyCheck = await IdempotencyService.checkOrCreate(
        idempotencyKey,
        "lead",
        actor!.dbUserId,
        "PATCH",
        validatedInput.leadId,
        LEAD_CONFIG.IDEMPOTENCY_KEY_TTL_HOURS,
      );

      if (
        idempotencyCheck?.status === "completed" &&
        idempotencyCheck.response
      ) {
        revalidatePath("/professional-portal/leads");
        revalidatePath(`/professional-portal/leads/${validatedInput.leadId}`);
        return idempotencyCheck.response;
      }

      if (idempotencyCheck?.status === "pending") {
        throwActionFailure(
          createActionFailure(
            "conflict",
            "Request is being processed. Please wait.",
            409,
          ),
        );
      }

      try {
        const updatedLead = unwrapResultOrThrow(
          await leadsService.updateProfessionalLead(
            {
              userId: actor!.dbUserId,
              role: actor!.role,
            },
            validatedInput.leadId,
            validatedInput.data,
          ),
          "Failed to update lead",
        );
        await IdempotencyService.complete(idempotencyKey, updatedLead);
        revalidatePath("/professional-portal/leads");
        revalidatePath(`/professional-portal/leads/${validatedInput.leadId}`);
        return updatedLead;
      } catch (error) {
        await IdempotencyService.fail(idempotencyKey);
        throw error;
      }
    },
    mapError: createLeadsActionErrorMapper("Failed to update lead"),
  });
}

export type DeleteLeadActionInput = {
  leadId: string;
  idempotencyKey?: string;
};

export async function deleteProfessionalLeadAction(
  input: DeleteLeadActionInput,
): Promise<ActionResult<unknown>> {
  return secureAction({
    input,
    schema: DeleteLeadActionSchema,
    policy: ({ actor }) => ensureProfessionalLeadActor(actor?.role),
    handler: async ({ actor, input: validatedInput }) => {
      const idempotencyKey =
        validatedInput.idempotencyKey ??
        IdempotencyService.generateKey(actor!.dbUserId, "DELETE", {
          leadId: validatedInput.leadId,
        });

      const idempotencyCheck = await IdempotencyService.checkOrCreate(
        idempotencyKey,
        "lead",
        actor!.dbUserId,
        "DELETE",
        validatedInput.leadId,
        LEAD_CONFIG.IDEMPOTENCY_KEY_TTL_HOURS,
      );

      if (
        idempotencyCheck?.status === "completed" &&
        idempotencyCheck.response
      ) {
        revalidatePath("/professional-portal/leads");
        return idempotencyCheck.response;
      }

      if (idempotencyCheck?.status === "pending") {
        throwActionFailure(
          createActionFailure(
            "conflict",
            "Request is being processed. Please wait.",
            409,
          ),
        );
      }

      try {
        const deletedLead = unwrapResultOrThrow(
          await leadsService.deleteProfessionalLead(
            {
              userId: actor!.dbUserId,
              role: actor!.role,
            },
            validatedInput.leadId,
          ),
          "Failed to delete lead",
        );
        await IdempotencyService.complete(idempotencyKey, deletedLead);
        revalidatePath("/professional-portal/leads");
        return deletedLead;
      } catch (error) {
        await IdempotencyService.fail(idempotencyKey);
        throw error;
      }
    },
    mapError: createLeadsActionErrorMapper("Failed to delete lead"),
  });
}
