import { HttpStatus } from "@/app/lib/api/api-response";
import { getClientLogger } from "@/app/lib/api/resilient-api";
import {
  err,
  ok,
  type DomainError,
  type Result,
} from "@/app/lib/errors/result";
import { clerkIntegrationRepository } from "./repository";
import {
  ClerkSessionPayloadSchema,
  ClerkUserPayloadSchema,
  computeDisplayName,
  resolveUserRole,
  UserRole,
  UserStatus,
  type ClerkSessionData,
  type ClerkUserData,
} from "@/app/lib/validation/clerk-webhook-validation";

const logger = getClientLogger();

export type ClerkWebhookActor = {
  correlationId: string;
};

export type ClerkWebhookErrorCode =
  | "invalid_payload"
  | "missing_required_data"
  | "conflict"
  | "not_found"
  | "processing_failed";

type ClerkWebhookError = DomainError<ClerkWebhookErrorCode>;

export type ClerkWebhookResult<T> = Result<T, ClerkWebhookError>;

type ProcessedWebhookData = {
  userId?: string;
  message: string;
};

function fail<T>(
  error: ClerkWebhookErrorCode,
  status: number,
  message: string,
  details?: unknown,
): ClerkWebhookResult<T> {
  return err({ error, status, message, details });
}

function mapPrismaError(
  error: unknown,
  operation: string,
  actor: ClerkWebhookActor,
  context?: Record<string, unknown>,
): ClerkWebhookResult<never> {
  const prismaError = error as { code?: string };

  logger.error(
    `${operation} processing failed`,
    error instanceof Error ? error : new Error(String(error)),
    {
      correlationId: actor.correlationId,
      prismaCode: prismaError.code,
      ...context,
    },
  );

  switch (prismaError.code) {
    case "P2002":
      return fail(
        "conflict",
        HttpStatus.CONFLICT,
        "User already exists with this identifier",
      );
    case "P2025":
      return fail("not_found", HttpStatus.NOT_FOUND, "User not found");
    default:
      return fail(
        "processing_failed",
        HttpStatus.INTERNAL_SERVER_ERROR,
        `Failed to process ${operation}`,
      );
  }
}

async function syncProfessionalVerification(
  actor: ClerkWebhookActor,
  clerkId: string,
  isVerified: boolean,
): Promise<void> {
  try {
    const user = await clerkIntegrationRepository.findUserIdByClerkId(clerkId);

    if (!user) {
      logger.warn("User not found for verification sync", {
        correlationId: actor.correlationId,
        operationName: "sync-professional-verification",
        outcome: "not_found",
      });
      return;
    }

    const profile =
      await clerkIntegrationRepository.findProfessionalProfileByUserId(user.id);

    if (!profile) {
      logger.debug("No professional profile for verification sync", {
        correlationId: actor.correlationId,
        operationName: "sync-professional-verification",
        outcome: "skipped",
      });
      return;
    }

    if (profile.verified !== isVerified) {
      await clerkIntegrationRepository.updateProfessionalVerification(
        user.id,
        isVerified,
      );

      logger.info("Professional verification status synced", {
        correlationId: actor.correlationId,
        verified: isVerified,
        operationName: "sync-professional-verification",
        outcome: "succeeded",
      });
    }
  } catch (error) {
    logger.error(
      "Failed to sync professional verification",
      error instanceof Error ? error : new Error(String(error)),
      {
        correlationId: actor.correlationId,
        operationName: "sync-professional-verification",
        outcome: "failed",
      },
    );
  }
}

export const clerkIntegrationService = {
  async handleUserCreated(
    actor: ClerkWebhookActor,
    data: ClerkUserData,
  ): Promise<ClerkWebhookResult<ProcessedWebhookData>> {
    const parsed = ClerkUserPayloadSchema.safeParse(data);
    if (!parsed.success) {
      return fail(
        "invalid_payload",
        HttpStatus.BAD_REQUEST,
        "Invalid user data",
        { fields: parsed.error.flatten().fieldErrors },
      );
    }

    const {
      id: clerkId,
      email_addresses,
      first_name,
      last_name,
      phone_numbers,
      image_url,
      public_metadata,
    } = parsed.data;

    const primaryEmail = email_addresses?.[0];
    if (!primaryEmail?.email_address) {
      return fail(
        "missing_required_data",
        HttpStatus.BAD_REQUEST,
        "Missing required email address",
      );
    }

    const email = primaryEmail.email_address;
    const isEmailVerified = primaryEmail.verification?.status === "verified";
    const primaryPhone = phone_numbers?.[0];
    const phone = primaryPhone?.phone_number || null;
    const isPhoneVerified =
      primaryPhone?.verification?.status === "verified" || false;
    const role = resolveUserRole(public_metadata?.role) ?? UserRole.CLIENT;
    const now = new Date();

    try {
      const user = await clerkIntegrationRepository.upsertUser({
        clerkId,
        email,
        firstName: first_name || null,
        lastName: last_name || null,
        displayName: computeDisplayName(first_name, last_name),
        phone,
        avatar: image_url || null,
        role,
        isEmailVerified,
        isPhoneVerified,
        ...(isEmailVerified ? { emailVerifiedAt: now } : {}),
        ...(isPhoneVerified ? { phoneVerifiedAt: now } : {}),
      });

      return ok({
        userId: user.id,
        message: "User created successfully",
      });
    } catch (error) {
      return mapPrismaError(error, "user.created", actor, { clerkId });
    }
  },

  async handleUserUpdated(
    actor: ClerkWebhookActor,
    data: ClerkUserData,
  ): Promise<ClerkWebhookResult<ProcessedWebhookData>> {
    const parsed = ClerkUserPayloadSchema.safeParse(data);
    if (!parsed.success) {
      return fail(
        "invalid_payload",
        HttpStatus.BAD_REQUEST,
        "Invalid user data",
        { fields: parsed.error.flatten().fieldErrors },
      );
    }

    const {
      id: clerkId,
      email_addresses,
      first_name,
      last_name,
      phone_numbers,
      image_url,
      public_metadata,
    } = parsed.data;

    try {
      const existingUser =
        await clerkIntegrationRepository.findUserForSync(clerkId);
      if (!existingUser) {
        return fail("not_found", HttpStatus.NOT_FOUND, "User not found");
      }

      const primaryEmail = email_addresses?.[0];
      const email = primaryEmail?.email_address;
      const isEmailVerified = primaryEmail?.verification?.status === "verified";
      const primaryPhone = phone_numbers?.[0];
      const phone = primaryPhone?.phone_number;
      const isPhoneVerified = primaryPhone?.verification?.status === "verified";
      const effectiveFirstName =
        first_name !== undefined ? first_name : existingUser.firstName;
      const effectiveLastName =
        last_name !== undefined ? last_name : existingUser.lastName;
      const emailJustVerified =
        !!isEmailVerified && !existingUser.isEmailVerified;
      const phoneJustVerified =
        !!isPhoneVerified && !existingUser.isPhoneVerified;

      const user = await clerkIntegrationRepository.updateUser(clerkId, {
        ...(email !== undefined ? { email } : {}),
        ...(first_name !== undefined ? { firstName: first_name || null } : {}),
        ...(last_name !== undefined ? { lastName: last_name || null } : {}),
        displayName: computeDisplayName(effectiveFirstName, effectiveLastName),
        ...(phone !== undefined ? { phone: phone || null } : {}),
        ...(image_url !== undefined ? { avatar: image_url || null } : {}),
        ...(isEmailVerified !== undefined ? { isEmailVerified } : {}),
        ...(isPhoneVerified !== undefined ? { isPhoneVerified } : {}),
        ...(emailJustVerified ? { emailVerifiedAt: new Date() } : {}),
        ...(phoneJustVerified ? { phoneVerifiedAt: new Date() } : {}),
        ...(public_metadata?.role
          ? { role: resolveUserRole(public_metadata.role) }
          : {}),
      });

      if (public_metadata?.isVerified !== undefined) {
        await syncProfessionalVerification(
          actor,
          clerkId,
          public_metadata.isVerified,
        );
      }

      return ok({ userId: user.id, message: "User updated successfully" });
    } catch (error) {
      return mapPrismaError(error, "user.updated", actor, { clerkId });
    }
  },

  async handleUserDeleted(
    actor: ClerkWebhookActor,
    data: ClerkUserData,
  ): Promise<ClerkWebhookResult<ProcessedWebhookData>> {
    const clerkId = data.id;
    if (!clerkId) {
      return fail(
        "missing_required_data",
        HttpStatus.BAD_REQUEST,
        "Missing user ID",
      );
    }

    const now = new Date();

    try {
      const user = await clerkIntegrationRepository.softDeleteUser(clerkId, {
        status: UserStatus.DEACTIVATED,
        deletedAt: now,
        deletionRequestedAt: now,
        deletionReason: "CLERK_ACCOUNT_DELETED",
        scheduledDeletionAt: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
      });

      return ok({ userId: user.id, message: "User deletion processed" });
    } catch (error) {
      return mapPrismaError(error, "user.deleted", actor, { clerkId });
    }
  },

  async handleSessionCreated(
    actor: ClerkWebhookActor,
    data: ClerkSessionData,
  ): Promise<ClerkWebhookResult<ProcessedWebhookData>> {
    const parsed = ClerkSessionPayloadSchema.safeParse(data);
    if (!parsed.success) {
      logger.warn("Invalid session.created payload", {
        correlationId: actor.correlationId,
        errors: parsed.error.flatten().fieldErrors,
      });
      return ok({ message: "Session event acknowledged" });
    }

    const { user_id: clerkUserId } = parsed.data;

    try {
      const updateResult =
        await clerkIntegrationRepository.updateSessionActivity(clerkUserId);

      if (updateResult.count === 0) {
        logger.debug("User not found for session tracking (race condition)", {
          correlationId: actor.correlationId,
          operationName: "track-clerk-session-created",
          outcome: "not_found",
        });
      }

      return ok({ message: "Session tracked" });
    } catch (error) {
      logger.warn("Failed to track login activity", {
        correlationId: actor.correlationId,
        error: error instanceof Error ? error.message : String(error),
        operationName: "track-clerk-session-created",
        outcome: "failed",
      });
      return ok({ message: "Session event acknowledged" });
    }
  },
};
