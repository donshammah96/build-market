import { Webhook } from "svix";
import { NextRequest } from "next/server";
import { prisma, VerificationStatus } from "@build/db";
import { apiError, apiSuccess, HttpStatus } from "@/app/lib/api/api-response";
import { checkBodySize } from "@/app/lib/api/api-guards";
import {
  checkRateLimit,
  getRateLimitIdentifier,
  RateLimits,
} from "@/app/lib/api/rate-limit";
import { env } from "@/app/lib/infrastructure/env";
import {
  initializeCorrelationId,
  getClientLogger,
} from "@/app/lib/api/resilient-api";
import {
  ClerkUserPayloadSchema,
  ClerkSessionPayloadSchema,
  resolveUserRole,
  computeDisplayName,
  userWebhookSelect,
  professionalProfileSelect,
  WEBHOOK_CONFIG,
  UserRole,
  UserStatus,
  type ClerkWebhookEvent,
  type ClerkUserData,
  type ClerkSessionData,
  type HandledEventType,
} from "@/app/lib/validation/clerk-webhook-validation";

const logger = getClientLogger();

// ─── Route Handler ───────────────────────────────────────────────────────────

/**
 * POST /api/clerk-webhook
 *
 * Handles Clerk webhook events for user lifecycle management.
 *
 * Supported events:
 * - user.created  → Upserts user record with profile, verification timestamps, displayName
 * - user.updated  → Patches user fields, syncs professional verification status
 * - user.deleted  → Soft-deletes with GDPR audit trail (deletionRequestedAt, deletionReason)
 * - session.created → Tracks login activity (lastLoginAt, loginCount)
 *
 * Security:
 * - Svix signature verification (HMAC-SHA256) — rejects tampered payloads
 * - Body size guard (256 KB max)
 * - Rate limiting (post-verification, scoped to source IP)
 *
 * Schema alignment:
 * - Sets emailVerifiedAt / phoneVerifiedAt timestamps alongside boolean flags
 * - Computes displayName from firstName + lastName
 * - Uses UserStatus enum for soft-delete (not string literal)
 * - Populates GDPR deletion audit fields on user.deleted
 */
export async function POST(req: NextRequest) {
  const correlationId = initializeCorrelationId(req);

  logger.info("Clerk webhook request received", { correlationId });

  try {
    // ── 1. Body size guard ─────────────────────────────────────────────
    const sizeError = checkBodySize(req, WEBHOOK_CONFIG.MAX_PAYLOAD_SIZE);
    if (sizeError) return sizeError;

    // ── 2. Verify webhook secret is configured ─────────────────────────
    if (!env.clerk.webhookSecret) {
      logger.error("CLERK_WEBHOOK_SECRET not configured", undefined, {
        correlationId,
      });
      return apiError(
        "Service configuration error",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    // ── 3. Read raw payload for Svix verification ──────────────────────
    const payload = await req.text();
    const headers = Object.fromEntries(req.headers);

    // Verify required Svix headers are present before verification
    const missingSvixHeaders = WEBHOOK_CONFIG.REQUIRED_HEADERS.filter(
      (h) => !headers[h],
    );
    if (missingSvixHeaders.length > 0) {
      logger.warn("Missing Svix headers", {
        correlationId,
        missing: missingSvixHeaders,
      });
      return apiError("Missing webhook signature headers", HttpStatus.BAD_REQUEST);
    }

    // ── 4. Svix signature verification ─────────────────────────────────
    const wh = new Webhook(env.clerk.webhookSecret);
    let evt: ClerkWebhookEvent;

    try {
      evt = wh.verify(payload, headers) as ClerkWebhookEvent;
    } catch (verifyError) {
      logger.error(
        "Webhook signature verification failed",
        verifyError instanceof Error
          ? verifyError
          : new Error(String(verifyError)),
        { correlationId },
      );
      return apiError("Invalid webhook signature", HttpStatus.UNAUTHORIZED);
    }

    logger.info("Webhook signature verified", {
      correlationId,
      eventType: evt.type,
    });

    // ── 5. Rate limit (post-verification to avoid penalizing legit retries)
    const identifier = getRateLimitIdentifier(req);
    const rateLimitResult = await checkRateLimit(
      `clerk-webhook:${identifier}`,
      RateLimits.WEBHOOK.limit,
      RateLimits.WEBHOOK.window,
    );
    if (!rateLimitResult.success) {
      logger.warn("Webhook rate limited", { correlationId, identifier });
      return apiError(
        "Too many webhook requests",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // ── 6. Route to event handler ──────────────────────────────────────
    switch (evt.type as HandledEventType) {
      case "user.created":
        return await handleUserCreated(
          evt.data as ClerkUserData,
          correlationId,
        );

      case "user.updated":
        return await handleUserUpdated(
          evt.data as ClerkUserData,
          correlationId,
        );

      case "user.deleted":
        return await handleUserDeleted(
          evt.data as ClerkUserData,
          correlationId,
        );

      case "session.created":
        return await handleSessionCreated(
          evt.data as ClerkSessionData,
          correlationId,
        );

      default:
        logger.info("Unhandled event type acknowledged", {
          correlationId,
          eventType: evt.type,
        });
        return apiSuccess(
          { message: `Event ${evt.type} acknowledged` },
          HttpStatus.OK,
        );
    }
  } catch (err: unknown) {
    logger.error(
      "Webhook processing failed",
      err instanceof Error ? err : new Error(String(err)),
      { correlationId },
    );
    return apiError(
      "Webhook processing failed",
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }
}

// ─── Event Handlers ──────────────────────────────────────────────────────────

/**
 * user.created → Upsert user record.
 *
 * Uses upsert to handle Clerk replay / duplicate webhook delivery gracefully.
 * Sets emailVerifiedAt/phoneVerifiedAt timestamps, computes displayName,
 * and resolves role from public_metadata.
 */
async function handleUserCreated(data: ClerkUserData, correlationId: string) {
  // Validate payload structure
  const parsed = ClerkUserPayloadSchema.safeParse(data);
  if (!parsed.success) {
    logger.error("Invalid user.created payload", undefined, {
      correlationId,
      errors: parsed.error.flatten().fieldErrors,
    });
    return apiError("Invalid user data", HttpStatus.BAD_REQUEST, {
      fields: parsed.error.flatten().fieldErrors,
    });
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

  // Primary email is required for user creation
  const primaryEmail = email_addresses?.[0];
  if (!primaryEmail?.email_address) {
    logger.error("Missing primary email in user.created", undefined, {
      correlationId,
      clerkId,
    });
    return apiError(
      "Missing required email address",
      HttpStatus.BAD_REQUEST,
    );
  }

  const email = primaryEmail.email_address;
  const isEmailVerified = primaryEmail.verification?.status === "verified";

  const primaryPhone = phone_numbers?.[0];
  const phone = primaryPhone?.phone_number || null;
  const isPhoneVerified =
    primaryPhone?.verification?.status === "verified" || false;

  // Resolve role from metadata (defaults to CLIENT)
  const role = resolveUserRole(public_metadata?.role) ?? UserRole.CLIENT;
  const displayName = computeDisplayName(first_name, last_name);

  logger.info("Processing user.created", {
    correlationId,
    clerkId,
    email,
    role,
  });

  try {
    const user = await prisma.user.upsert({
      where: { clerkId },
      create: {
        clerkId,
        email,
        firstName: first_name || null,
        lastName: last_name || null,
        displayName,
        phone,
        avatar: image_url || null,
        role,
        isEmailVerified,
        isPhoneVerified,
        ...(isEmailVerified && { emailVerifiedAt: new Date() }),
        ...(isPhoneVerified && { phoneVerifiedAt: new Date() }),
      },
      update: {
        // On replay / race condition: update non-destructive fields
        email,
        firstName: first_name || null,
        lastName: last_name || null,
        displayName,
        phone,
        avatar: image_url || null,
        isEmailVerified,
        isPhoneVerified,
        ...(isEmailVerified && { emailVerifiedAt: new Date() }),
        ...(isPhoneVerified && { phoneVerifiedAt: new Date() }),
      },
      select: userWebhookSelect,
    });

    logger.info("User created/upserted successfully", {
      correlationId,
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    return apiSuccess(
      { userId: user.id, message: "User created successfully" },
      HttpStatus.OK,
      correlationId,
    );
  } catch (err: unknown) {
    return handlePrismaError(err, "user.created", clerkId, correlationId);
  }
}

/**
 * user.updated → Patch user fields.
 *
 * Only updates fields present in the webhook payload (partial update).
 * Syncs professional verification status if public_metadata.isVerified changes.
 * Updates emailVerifiedAt/phoneVerifiedAt timestamps when status transitions to verified.
 */
async function handleUserUpdated(data: ClerkUserData, correlationId: string) {
  const parsed = ClerkUserPayloadSchema.safeParse(data);
  if (!parsed.success) {
    logger.error("Invalid user.updated payload", undefined, {
      correlationId,
      errors: parsed.error.flatten().fieldErrors,
    });
    return apiError("Invalid user data", HttpStatus.BAD_REQUEST, {
      fields: parsed.error.flatten().fieldErrors,
    });
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

  logger.info("Processing user.updated", {
    correlationId,
    clerkId,
    hasMetadata: !!public_metadata,
  });

  try {
    // Fetch current user to compute diff-aware updates
    const existingUser = await prisma.user.findUnique({
      where: { clerkId },
      select: {
        id: true,
        isEmailVerified: true,
        isPhoneVerified: true,
        firstName: true,
        lastName: true,
      },
    });

    if (!existingUser) {
      logger.warn("User not found for update — will attempt upsert via user.created path", {
        correlationId,
        clerkId,
      });
      return apiError("User not found", HttpStatus.NOT_FOUND);
    }

    // Build update payload — only include fields present in the event
    const primaryEmail = email_addresses?.[0];
    const email = primaryEmail?.email_address;
    const isEmailVerified =
      primaryEmail?.verification?.status === "verified";

    const primaryPhone = phone_numbers?.[0];
    const phone = primaryPhone?.phone_number;
    const isPhoneVerified =
      primaryPhone?.verification?.status === "verified";

    // Compute displayName from updated or existing names
    const effectiveFirstName =
      first_name !== undefined ? first_name : existingUser.firstName;
    const effectiveLastName =
      last_name !== undefined ? last_name : existingUser.lastName;
    const displayName = computeDisplayName(effectiveFirstName, effectiveLastName);

    // Detect verification state transitions for timestamp updates
    const emailJustVerified =
      isEmailVerified && !existingUser.isEmailVerified;
    const phoneJustVerified =
      isPhoneVerified && !existingUser.isPhoneVerified;

    const updateData: Record<string, unknown> = {
      ...(email !== undefined && { email }),
      ...(first_name !== undefined && { firstName: first_name || null }),
      ...(last_name !== undefined && { lastName: last_name || null }),
      displayName,
      ...(phone !== undefined && { phone: phone || null }),
      ...(image_url !== undefined && { avatar: image_url || null }),
      ...(isEmailVerified !== undefined && { isEmailVerified }),
      ...(isPhoneVerified !== undefined && { isPhoneVerified }),
      // Set verification timestamps only on transition to verified
      ...(emailJustVerified && { emailVerifiedAt: new Date() }),
      ...(phoneJustVerified && { phoneVerifiedAt: new Date() }),
    };

    // Resolve role if metadata contains it
    if (public_metadata?.role) {
      const resolvedRole = resolveUserRole(public_metadata.role);
      if (resolvedRole) {
        updateData.role = resolvedRole;
      }
    }

    const user = await prisma.user.update({
      where: { clerkId },
      data: updateData,
      select: userWebhookSelect,
    });

    // Sync professional verification status if metadata changed
    if (public_metadata?.isVerified !== undefined) {
      await syncProfessionalVerification(
        clerkId,
        public_metadata.isVerified,
        correlationId,
      );
    }

    logger.info("User updated successfully", {
      correlationId,
      userId: user.id,
      role: user.role,
      emailJustVerified,
      phoneJustVerified,
    });

    return apiSuccess(
      { userId: user.id, message: "User updated successfully" },
      HttpStatus.OK,
      correlationId,
    );
  } catch (err: unknown) {
    return handlePrismaError(err, "user.updated", clerkId, correlationId);
  }
}

/**
 * user.deleted → Soft-delete with GDPR audit trail.
 *
 * Sets:
 * - deletedAt timestamp
 * - status to DEACTIVATED (GDPR deletion requested, anonymization pending)
 * - deletionRequestedAt and deletionReason for audit trail
 * - scheduledDeletionAt for the data retention pipeline
 *
 * Does NOT hard-delete — the data retention/anonymization pipeline handles that.
 */
async function handleUserDeleted(data: ClerkUserData, correlationId: string) {
  const clerkId = data.id;

  if (!clerkId) {
    logger.error("Missing user ID in user.deleted event", undefined, {
      correlationId,
    });
    return apiError("Missing user ID", HttpStatus.BAD_REQUEST);
  }

  logger.info("Processing user.deleted", { correlationId, clerkId });

  try {
    const now = new Date();

    const user = await prisma.user.update({
      where: { clerkId },
      data: {
        status: UserStatus.DEACTIVATED,
        deletedAt: now,
        deletionRequestedAt: now,
        deletionReason: "CLERK_ACCOUNT_DELETED",
        // Schedule for anonymization after retention period (30 days default)
        scheduledDeletionAt: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
      },
      select: userWebhookSelect,
    });

    logger.info("User soft-deleted successfully", {
      correlationId,
      userId: user.id,
      clerkId,
      status: user.status,
    });

    return apiSuccess(
      { userId: user.id, message: "User deletion processed" },
      HttpStatus.OK,
      correlationId,
    );
  } catch (err: unknown) {
    return handlePrismaError(err, "user.deleted", clerkId, correlationId);
  }
}

/**
 * session.created → Track login activity.
 *
 * Updates:
 * - lastLoginAt timestamp
 * - loginCount (atomic increment)
 * - lastActiveAt timestamp
 *
 * This enables the User model's activity tracking fields to stay current
 * without relying on polling Clerk's API.
 */
async function handleSessionCreated(
  data: ClerkSessionData,
  correlationId: string,
) {
  const parsed = ClerkSessionPayloadSchema.safeParse(data);
  if (!parsed.success) {
    logger.warn("Invalid session.created payload", {
      correlationId,
      errors: parsed.error.flatten().fieldErrors,
    });
    // Don't fail on session events — they're non-critical
    return apiSuccess(
      { message: "Session event acknowledged" },
      HttpStatus.OK,
      correlationId,
    );
  }

  const { user_id: clerkUserId } = parsed.data;

  try {
    await prisma.user.update({
      where: { clerkId: clerkUserId },
      data: {
        lastLoginAt: new Date(),
        lastActiveAt: new Date(),
        loginCount: { increment: 1 },
        // Reset failed login count on successful session
        failedLoginCount: 0,
      },
      select: { id: true },
    });

    logger.debug("Login activity tracked", {
      correlationId,
      clerkId: clerkUserId,
    });

    return apiSuccess(
      { message: "Session tracked" },
      HttpStatus.OK,
      correlationId,
    );
  } catch (err: unknown) {
    // Non-critical — user may not exist yet if session.created fires before user.created
    const prismaErr = err as { code?: string };
    if (prismaErr.code === "P2025") {
      logger.debug("User not found for session tracking (race condition)", {
        correlationId,
        clerkId: clerkUserId,
      });
    } else {
      logger.warn(
        "Failed to track login activity",
        {
          correlationId,
          clerkId: clerkUserId,
          error: err instanceof Error ? err.message : String(err),
        },
      );
    }

    // Always acknowledge — session tracking failures should not cause retries
    return apiSuccess(
      { message: "Session event acknowledged" },
      HttpStatus.OK,
      correlationId,
    );
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Sync professional verification status from Clerk metadata to ProfessionalProfile.
 *
 * Called when user.updated contains a `public_metadata.isVerified` change.
 * Only updates if the status actually changed to avoid unnecessary writes.
 */
async function syncProfessionalVerification(
  clerkId: string,
  isVerified: boolean,
  correlationId: string,
): Promise<void> {
  try {
    const user = await prisma.user.findUnique({
      where: { clerkId },
      select: { id: true },
    });

    if (!user) {
      logger.warn("User not found for verification sync", {
        correlationId,
        clerkId,
      });
      return;
    }

    const profile = await prisma.professionalProfile.findUnique({
      where: { userId: user.id },
      select: professionalProfileSelect,
    });

    if (!profile) {
      logger.debug("No professional profile for verification sync", {
        correlationId,
        clerkId,
      });
      return;
    }

    // Only write if status actually changed
    if (profile.verified !== isVerified) {
      const newStatus = isVerified
        ? VerificationStatus.VERIFIED
        : VerificationStatus.PENDING;

      await prisma.professionalProfile.update({
        where: { userId: user.id },
        data: {
          verified: isVerified,
          verificationStatus: newStatus,
          ...(isVerified && { verifiedAt: new Date() }),
        },
      });

      logger.info("Professional verification status synced", {
        correlationId,
        clerkId,
        userId: user.id,
        verified: isVerified,
        verificationStatus: newStatus,
      });
    }
  } catch (err) {
    // Non-fatal — log and continue
    logger.error(
      "Failed to sync professional verification",
      err instanceof Error ? err : new Error(String(err)),
      { correlationId, clerkId },
    );
  }
}

/**
 * Centralized Prisma error handler for webhook operations.
 * Maps known Prisma error codes to appropriate HTTP responses.
 */
function handlePrismaError(
  err: unknown,
  eventType: string,
  clerkId: string,
  correlationId: string,
) {
  const prismaErr = err as { code?: string };

  logger.error(
    `${eventType} processing failed`,
    err instanceof Error ? err : new Error(String(err)),
    {
      correlationId,
      clerkId,
      prismaCode: prismaErr.code,
    },
  );

  switch (prismaErr.code) {
    case "P2002":
      // Unique constraint violation (e.g., duplicate email)
      return apiError(
        "User already exists with this identifier",
        HttpStatus.CONFLICT,
        { clerkId },
        correlationId,
      );
    case "P2025":
      // Record not found
      return apiError(
        "User not found",
        HttpStatus.NOT_FOUND,
        { clerkId },
        correlationId,
      );
    default:
      return apiError(
        `Failed to process ${eventType}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
        undefined,
        correlationId,
      );
  }
}
