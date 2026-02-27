"use server";

import {
  getProfessionalLeads,
  getProfessionalLeadById,
  createProfessionalLead,
  updateProfessionalLead,
  deleteProfessionalLead,
} from "@/lib/services/leads";
import type {
  LeadQueryInput,
  CreateLeadInput,
  UpdateLeadInput,
} from "@/lib/services/leads";
import {
  LeadQuerySchema,
  CreateLeadSchema,
  UpdateLeadSchema,
} from "@/app/lib/validation/leads-validation";
import { IdempotencyService } from "@/app/lib/services/idempotency.service";
import { LEAD_CONFIG } from "@/app/lib/config/lead.config";
import { isValidId } from "@/app/lib/utils/validators";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@build/db";
import { revalidatePath } from "next/cache";

async function resolveDbUserId(): Promise<string> {
  const { userId: clerkId } = await auth();
  if (!clerkId) throw new Error("Unauthorized");

  const user = await prisma.user.findUnique({
    where: { clerkId },
    select: { id: true },
  });
  if (!user) throw new Error("User not found");

  return user.id;
}

export async function getProfessionalLeadsAction(
  filters?: Partial<LeadQueryInput>,
) {
  const dbUserId = await resolveDbUserId();
  const merged = {
    page: 1,
    limit: LEAD_CONFIG.DEFAULT_LIMIT,
    ...filters,
  };
  const parsed = LeadQuerySchema.safeParse(merged);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    throw new Error(first?.message ?? "Invalid query parameters");
  }
  return getProfessionalLeads(dbUserId, parsed.data);
}

export async function getProfessionalLeadByIdAction(leadId: string) {
  const dbUserId = await resolveDbUserId();
  if (!isValidId(leadId)) throw new Error("Invalid lead ID");

  const result = await getProfessionalLeadById(dbUserId, leadId);
  if (result.success === false) {
    if (result.error === "not_found") throw new Error("Lead not found");
    throw new Error("Forbidden");
  }
  return result.data;
}

export type CreateLeadActionInput = CreateLeadInput & {
  idempotencyKey?: string;
};

export async function createProfessionalLeadAction(data: CreateLeadActionInput) {
  const dbUserId = await resolveDbUserId();

  const { idempotencyKey: clientKey, ...rest } = data;
  const parsed = CreateLeadSchema.safeParse(rest);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    throw new Error(first?.message ?? "Invalid lead data");
  }

  const payload = parsed.data;
  const idempotencyKey =
    clientKey ??
    IdempotencyService.generateKey(dbUserId, "POST", {
      domain: "lead",
      clientName: payload.clientName,
      title: payload.title,
    });

  const idempotencyCheck = await IdempotencyService.checkOrCreate(
    idempotencyKey,
    "lead",
    dbUserId,
    "POST",
    undefined,
    LEAD_CONFIG.IDEMPOTENCY_KEY_TTL_HOURS,
  );

  if (idempotencyCheck?.status === "completed" && idempotencyCheck.response) {
    revalidatePath("/professional-portal/leads");
    return idempotencyCheck.response;
  }

  if (idempotencyCheck?.status === "pending") {
    throw new Error("Request is being processed. Please wait.");
  }

  try {
    const lead = await createProfessionalLead(dbUserId, payload);
    await IdempotencyService.complete(idempotencyKey, lead);
    revalidatePath("/professional-portal/leads");
    return lead;
  } catch (err) {
    await IdempotencyService.fail(idempotencyKey);
    throw err;
  }
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
) {
  const dbUserId = await resolveDbUserId();

  if (!isValidId(input.leadId)) throw new Error("Invalid lead ID");
  const parsed = UpdateLeadSchema.safeParse(input.data);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    throw new Error(first?.message ?? "Invalid update data");
  }

  const idempotencyKey =
    input.idempotencyKey ??
    IdempotencyService.generateKey(dbUserId, "PATCH", {
      leadId: input.leadId,
      ...input.data,
    });

  const idempotencyCheck = await IdempotencyService.checkOrCreate(
    idempotencyKey,
    "lead",
    dbUserId,
    "PATCH",
    input.leadId,
    LEAD_CONFIG.IDEMPOTENCY_KEY_TTL_HOURS,
  );

  if (idempotencyCheck?.status === "completed" && idempotencyCheck.response) {
    revalidatePath("/professional-portal/leads");
    revalidatePath(`/professional-portal/leads/${input.leadId}`);
    return idempotencyCheck.response;
  }

  if (idempotencyCheck?.status === "pending") {
    throw new Error("Request is being processed. Please wait.");
  }

  try {
    const result = await updateProfessionalLead(
      dbUserId,
      input.leadId,
      parsed.data,
    );
    if (result.success === false) {
      await IdempotencyService.fail(idempotencyKey);
      if (result.error === "not_found") throw new Error("Lead not found");
      throw new Error("Forbidden");
    }
    await IdempotencyService.complete(idempotencyKey, result.data);
    revalidatePath("/professional-portal/leads");
    revalidatePath(`/professional-portal/leads/${input.leadId}`);
    return result.data;
  } catch (err) {
    await IdempotencyService.fail(idempotencyKey);
    throw err;
  }
}

export type DeleteLeadActionInput = {
  leadId: string;
  idempotencyKey?: string;
};

export async function deleteProfessionalLeadAction(
  input: DeleteLeadActionInput,
) {
  const dbUserId = await resolveDbUserId();

  if (!isValidId(input.leadId)) throw new Error("Invalid lead ID");

  const idempotencyKey =
    input.idempotencyKey ??
    IdempotencyService.generateKey(dbUserId, "DELETE", {
      leadId: input.leadId,
    });

  const idempotencyCheck = await IdempotencyService.checkOrCreate(
    idempotencyKey,
    "lead",
    dbUserId,
    "DELETE",
    input.leadId,
    LEAD_CONFIG.IDEMPOTENCY_KEY_TTL_HOURS,
  );

  if (idempotencyCheck?.status === "completed" && idempotencyCheck.response) {
    revalidatePath("/professional-portal/leads");
    return idempotencyCheck.response;
  }

  if (idempotencyCheck?.status === "pending") {
    throw new Error("Request is being processed. Please wait.");
  }

  try {
    const result = await deleteProfessionalLead(dbUserId, input.leadId);
    if (result.success === false) {
      await IdempotencyService.fail(idempotencyKey);
      if (result.error === "not_found") throw new Error("Lead not found");
      throw new Error("Forbidden");
    }
    await IdempotencyService.complete(idempotencyKey, result.data);
    revalidatePath("/professional-portal/leads");
    return result.data;
  } catch (err) {
    await IdempotencyService.fail(idempotencyKey);
    throw err;
  }
}
