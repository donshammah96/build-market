"use server";

import {
  getProfessionalInquiries,
  getProfessionalInquiryById,
  updateProfessionalInquiry,
  deleteProfessionalInquiry,
} from "@/lib/services/inquiries";
import type {
  InquiriesQueryInput,
  UpdateInquiryInput,
} from "@/lib/services/inquiries";
import {
  InquiriesQuerySchema,
  UpdateInquirySchema,
} from "@/app/lib/validation/inquiries-validation";
import { IdempotencyService } from "@/app/lib/services/idempotency.service";
import { INQUIRY_CONFIG } from "@/app/lib/config/inquiry.config";
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

export async function getProfessionalInquiriesAction(
  filters?: Partial<InquiriesQueryInput>,
) {
  const dbUserId = await resolveDbUserId();
  const merged = {
    limit: String(filters?.limit ?? INQUIRY_CONFIG.DEFAULT_LIMIT),
    page: String(filters?.page ?? 1),
    status: filters?.status,
  };
  const parsed = InquiriesQuerySchema.safeParse(merged);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    throw new Error(first?.message ?? "Invalid query parameters");
  }
  return getProfessionalInquiries(dbUserId, parsed.data);
}

export async function getProfessionalInquiryByIdAction(inquiryId: string) {
  const dbUserId = await resolveDbUserId();
  if (!isValidId(inquiryId)) throw new Error("Invalid inquiry ID");

  const result = await getProfessionalInquiryById(dbUserId, inquiryId);
  if (result.success === false) {
    if (result.error === "not_found") throw new Error("Inquiry not found");
    throw new Error("Forbidden");
  }
  return result.data;
}

export type UpdateInquiryActionInput = {
  inquiryId: string;
  data: UpdateInquiryInput;
  idempotencyKey?: string;
};

export async function updateProfessionalInquiryAction(
  input: UpdateInquiryActionInput,
) {
  const dbUserId = await resolveDbUserId();

  if (!isValidId(input.inquiryId)) throw new Error("Invalid inquiry ID");
  const parsed = UpdateInquirySchema.safeParse(input.data);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    throw new Error(first?.message ?? "Invalid update data");
  }
  if (Object.keys(parsed.data).length === 0) {
    throw new Error("No fields to update");
  }

  const idempotencyKey =
    input.idempotencyKey ??
    IdempotencyService.generateKey(dbUserId, "PATCH", {
      inquiryId: input.inquiryId,
      ...input.data,
    });

  const idempotencyCheck = await IdempotencyService.checkOrCreate(
    idempotencyKey,
    "property_inquiry",
    dbUserId,
    "PATCH",
    input.inquiryId,
    INQUIRY_CONFIG.IDEMPOTENCY_KEY_TTL_HOURS,
  );

  if (idempotencyCheck?.status === "completed" && idempotencyCheck.response) {
    revalidatePath("/professional-portal/inquiries");
    revalidatePath(`/professional-portal/inquiries/${input.inquiryId}`);
    return idempotencyCheck.response;
  }

  if (idempotencyCheck?.status === "pending") {
    throw new Error("Request is being processed. Please wait.");
  }

  try {
    const result = await updateProfessionalInquiry(
      dbUserId,
      input.inquiryId,
      parsed.data,
    );
    if (result.success === false) {
      await IdempotencyService.fail(idempotencyKey);
      if (result.error === "not_found") throw new Error("Inquiry not found");
      throw new Error("Forbidden");
    }
    await IdempotencyService.complete(idempotencyKey, result.data);
    revalidatePath("/professional-portal/inquiries");
    revalidatePath(`/professional-portal/inquiries/${input.inquiryId}`);
    return result.data;
  } catch (err) {
    await IdempotencyService.fail(idempotencyKey);
    throw err;
  }
}

export type DeleteInquiryActionInput = {
  inquiryId: string;
  idempotencyKey?: string;
};

export async function deleteProfessionalInquiryAction(
  input: DeleteInquiryActionInput,
) {
  const dbUserId = await resolveDbUserId();

  if (!isValidId(input.inquiryId)) throw new Error("Invalid inquiry ID");

  const idempotencyKey =
    input.idempotencyKey ??
    IdempotencyService.generateKey(dbUserId, "DELETE", {
      inquiryId: input.inquiryId,
    });

  const idempotencyCheck = await IdempotencyService.checkOrCreate(
    idempotencyKey,
    "property_inquiry",
    dbUserId,
    "DELETE",
    input.inquiryId,
    INQUIRY_CONFIG.IDEMPOTENCY_KEY_TTL_HOURS,
  );

  if (idempotencyCheck?.status === "completed" && idempotencyCheck.response) {
    revalidatePath("/professional-portal/inquiries");
    return idempotencyCheck.response;
  }

  if (idempotencyCheck?.status === "pending") {
    throw new Error("Request is being processed. Please wait.");
  }

  try {
    const result = await deleteProfessionalInquiry(dbUserId, input.inquiryId);
    if (result.success === false) {
      await IdempotencyService.fail(idempotencyKey);
      if (result.error === "not_found") throw new Error("Inquiry not found");
      throw new Error("Forbidden");
    }
    await IdempotencyService.complete(idempotencyKey, { deleted: true });
    revalidatePath("/professional-portal/inquiries");
    return { message: "Inquiry deleted successfully" };
  } catch (err) {
    await IdempotencyService.fail(idempotencyKey);
    throw err;
  }
}
