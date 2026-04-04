"use server";

import { z } from "zod";
import {
  inquiriesService,
  InquiriesQueryInput,
  UpdateInquiryInput,
} from "@/app/lib/domains/inquiries";
import {
  InquiriesQuerySchema,
  UpdateInquirySchema,
} from "@/app/lib/validation/inquiries-validation";
import { IdempotencyService } from "@/app/lib/services/idempotency.service";
import { INQUIRY_CONFIG } from "@/app/lib/config/inquiry.config";
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

const InquiryIdActionSchema = z.object({
  inquiryId: z.string().uuid("Invalid inquiry ID"),
});

const UpdateInquiryActionSchema = z.object({
  inquiryId: z.string().uuid("Invalid inquiry ID"),
  data: UpdateInquirySchema.refine(
    (value) => Object.keys(value).length > 0,
    "No fields to update",
  ),
  idempotencyKey: z.string().optional(),
});

const DeleteInquiryActionSchema = z.object({
  inquiryId: z.string().uuid("Invalid inquiry ID"),
  idempotencyKey: z.string().optional(),
});

function createInquiryActionErrorMapper(message: string) {
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

function ensureProfessionalInquiryActor(role: string | null | undefined) {
  const normalizedRole = normalizeRole(role);
  if (normalizedRole !== "PROFESSIONAL" && normalizedRole !== "ADMIN") {
    return createActionFailure("forbidden", "Forbidden", 403);
  }

  return true;
}

export async function getProfessionalInquiriesAction(
  filters?: Partial<InquiriesQueryInput>,
): Promise<ActionResult<unknown>> {
  return secureAction({
    input: filters,
    schema: InquiriesQuerySchema.partial().optional(),
    policy: ({ actor }) => ensureProfessionalInquiryActor(actor?.role),
    handler: async ({ actor, input }) => {
      const parsedResult = InquiriesQuerySchema.safeParse({
        limit: String(input?.limit ?? INQUIRY_CONFIG.DEFAULT_LIMIT),
        page: String(input?.page ?? 1),
        status: input?.status,
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
        await inquiriesService.listProfessionalInquiries(
          {
            userId: actor!.dbUserId,
            role: actor!.role,
          },
          parsed,
        ),
        "Failed to fetch inquiries",
      );
    },
    mapError: createInquiryActionErrorMapper("Failed to fetch inquiries"),
  });
}

export async function getProfessionalInquiryByIdAction(
  inquiryId: string,
): Promise<ActionResult<unknown>> {
  return secureAction({
    input: { inquiryId },
    schema: InquiryIdActionSchema,
    policy: ({ actor }) => ensureProfessionalInquiryActor(actor?.role),
    handler: async ({ actor, input }) =>
      unwrapResultOrThrow(
        await inquiriesService.getProfessionalInquiryById(
          {
            userId: actor!.dbUserId,
            role: actor!.role,
          },
          input.inquiryId,
        ),
        "Failed to fetch inquiry",
      ),
    mapError: createInquiryActionErrorMapper("Failed to fetch inquiry"),
  });
}

export type UpdateInquiryActionInput = {
  inquiryId: string;
  data: UpdateInquiryInput;
  idempotencyKey?: string;
};

export async function updateProfessionalInquiryAction(
  input: UpdateInquiryActionInput,
): Promise<ActionResult<unknown>> {
  return secureAction({
    input,
    schema: UpdateInquiryActionSchema,
    policy: ({ actor }) => ensureProfessionalInquiryActor(actor?.role),
    handler: async ({ actor, input: validatedInput }) => {
      const idempotencyKey =
        validatedInput.idempotencyKey ??
        IdempotencyService.generateKey(actor!.dbUserId, "PATCH", {
          inquiryId: validatedInput.inquiryId,
          ...validatedInput.data,
        });

      const idempotencyCheck = await IdempotencyService.checkOrCreate(
        idempotencyKey,
        "property_inquiry",
        actor!.dbUserId,
        "PATCH",
        validatedInput.inquiryId,
        INQUIRY_CONFIG.IDEMPOTENCY_KEY_TTL_HOURS,
      );

      if (
        idempotencyCheck?.status === "completed" &&
        idempotencyCheck.response
      ) {
        revalidatePath("/professional-portal/inquiries");
        revalidatePath(
          `/professional-portal/inquiries/${validatedInput.inquiryId}`,
        );
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
        const inquiry = unwrapResultOrThrow(
          await inquiriesService.updateProfessionalInquiry(
            {
              userId: actor!.dbUserId,
              role: actor!.role,
            },
            validatedInput.inquiryId,
            validatedInput.data,
          ),
          "Failed to update inquiry",
        );
        await IdempotencyService.complete(idempotencyKey, inquiry);
        revalidatePath("/professional-portal/inquiries");
        revalidatePath(
          `/professional-portal/inquiries/${validatedInput.inquiryId}`,
        );
        return inquiry;
      } catch (error) {
        await IdempotencyService.fail(idempotencyKey);
        throw error;
      }
    },
    mapError: createInquiryActionErrorMapper("Failed to update inquiry"),
  });
}

export type DeleteInquiryActionInput = {
  inquiryId: string;
  idempotencyKey?: string;
};

export async function deleteProfessionalInquiryAction(
  input: DeleteInquiryActionInput,
): Promise<ActionResult<unknown>> {
  return secureAction({
    input,
    schema: DeleteInquiryActionSchema,
    policy: ({ actor }) => ensureProfessionalInquiryActor(actor?.role),
    handler: async ({ actor, input: validatedInput }) => {
      const idempotencyKey =
        validatedInput.idempotencyKey ??
        IdempotencyService.generateKey(actor!.dbUserId, "DELETE", {
          inquiryId: validatedInput.inquiryId,
        });

      const idempotencyCheck = await IdempotencyService.checkOrCreate(
        idempotencyKey,
        "property_inquiry",
        actor!.dbUserId,
        "DELETE",
        validatedInput.inquiryId,
        INQUIRY_CONFIG.IDEMPOTENCY_KEY_TTL_HOURS,
      );

      if (
        idempotencyCheck?.status === "completed" &&
        idempotencyCheck.response
      ) {
        revalidatePath("/professional-portal/inquiries");
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
        const deleted = unwrapResultOrThrow(
          await inquiriesService.deleteProfessionalInquiry(
            {
              userId: actor!.dbUserId,
              role: actor!.role,
            },
            validatedInput.inquiryId,
          ),
          "Failed to delete inquiry",
        );
        await IdempotencyService.complete(idempotencyKey, deleted);
        revalidatePath("/professional-portal/inquiries");
        return deleted;
      } catch (error) {
        await IdempotencyService.fail(idempotencyKey);
        throw error;
      }
    },
    mapError: createInquiryActionErrorMapper("Failed to delete inquiry"),
  });
}
