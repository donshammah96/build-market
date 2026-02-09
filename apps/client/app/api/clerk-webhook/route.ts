import { Webhook } from "svix";
import { NextRequest, NextResponse } from "next/server";
import { prisma, UserRole, VerificationStatus } from "@build/db";
import { apiError, apiSuccess, HttpStatus } from "@/app/lib/api-response";
import { UserRepository } from "@/app/lib/repositories/user.repository";
import {
  checkRateLimit,
  getRateLimitIdentifier,
  RateLimits,
} from "@/app/lib/rate-limit";
import { env } from "@/app/lib/env";
import {
  initializeCorrelationId,
  getClientLogger,
} from "@/app/lib/resilient-api";

const logger = getClientLogger();

// Clerk webhook event types
interface ClerkEmailAddress {
  email_address: string;
  verification?: {
    status: "verified" | "unverified" | "expired";
  };
}

interface ClerkPhoneNumber {
  phone_number: string;
  verification?: {
    status: "verified" | "unverified" | "expired";
  };
}

interface ClerkUserData {
  id: string;
  email_addresses?: ClerkEmailAddress[];
  first_name?: string | null;
  last_name?: string | null;
  phone_numbers?: ClerkPhoneNumber[];
  image_url?: string;
  username?: string | null;
  public_metadata?: {
    role?: "client" | "professional";
    isOnboarded?: boolean;
    isVerified?: boolean;
  };
}

interface ClerkWebhookEvent {
  type: string;
  data: ClerkUserData;
}

interface PrismaError extends Error {
  code?: string;
}

/**
 * POST /api/clerk-webhook
 * Handle Clerk webhook events for user creation and updates
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const correlationId = initializeCorrelationId(req);

  logger.info("Webhook request received", { correlationId });

  try {
    // Rate limiting for webhooks
    const identifier = getRateLimitIdentifier(req);
    const rateLimitResult = await checkRateLimit(
      `webhook:${identifier}`,
      RateLimits.WEBHOOK.limit,
      RateLimits.WEBHOOK.window,
    );

    if (!rateLimitResult.success) {
      return apiError(
        "Too many webhook requests",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // Check webhook secret
    if (!env.CLERK_WEBHOOK_SECRET) {
      logger.error("CLERK_WEBHOOK_SECRET not configured", undefined, {
        correlationId,
      });
      return apiError(
        "Service configuration error",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    // Parse request
    const payload = await req.text();
    const headers = Object.fromEntries(req.headers);

    logger.debug("Webhook payload received", {
      correlationId,
      payloadLength: payload.length,
    });

    // Verify webhook signature
    const wh = new Webhook(env.CLERK_WEBHOOK_SECRET);
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

    logger.info("Webhook verified", { correlationId, eventType: evt.type });

    // Check database connection
    try {
      await prisma.$connect();
      logger.debug("Database connection verified", { correlationId });
    } catch (dbError) {
      logger.error(
        "Database connection failed",
        dbError instanceof Error ? dbError : new Error(String(dbError)),
        { correlationId },
      );
      return apiError(
        "Database connection failed",
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    // Initialize repository
    const userRepo = new UserRepository(prisma);

    // Handle user.created event
    if (evt.type === "user.created") {
      return await handleUserCreated(evt, userRepo, correlationId);
    }

    // Handle user.updated event
    if (evt.type === "user.updated") {
      return await handleUserUpdated(evt, userRepo, correlationId);
    }

    // Handle user.deleted event (optional)
    if (evt.type === "user.deleted") {
      return await handleUserDeleted(evt, userRepo, correlationId);
    }

    // Other events - just acknowledge
    logger.info("Event type not handled", {
      correlationId,
      eventType: evt.type,
    });
    return apiSuccess(
      { message: `Event ${evt.type} acknowledged` },
      HttpStatus.OK,
    );
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

/**
 * Handle user.created webhook event
 */
async function handleUserCreated(
  evt: ClerkWebhookEvent,
  userRepo: UserRepository,
  correlationId: string,
) {
  const {
    id,
    email_addresses,
    first_name,
    last_name,
    phone_numbers,
    image_url,
    public_metadata,
  } = evt.data;

  if (!id || !email_addresses?.[0]?.email_address) {
    logger.error("Missing required data (id or email)", undefined, {
      correlationId,
    });
    return apiError("Missing required user data", HttpStatus.BAD_REQUEST);
  }

  const emailData = email_addresses[0];
  const email = emailData.email_address;
  const isEmailVerified = emailData.verification?.status === "verified";

  const phoneData = phone_numbers?.[0];
  const phone = phoneData?.phone_number;
  const isPhoneVerified = phoneData?.verification?.status === "verified";

  // Determine role from metadata or default to CLIENT
  let role: UserRole = UserRole.CLIENT;
  if (public_metadata?.role) {
    const roleStr = public_metadata.role.toUpperCase();
    if (roleStr === "PROFESSIONAL") role = UserRole.PROFESSIONAL;
    else if (roleStr === "ADMIN") role = UserRole.ADMIN;
  }

  logger.info("Processing user creation", {
    correlationId,
    clerkId: id,
    email,
    role,
  });

  try {
    const user = await userRepo.upsert(
      id,
      {
        clerkId: id,
        email,
        firstName: first_name || null,
        lastName: last_name || null,
        phone: phone || null,
        avatar: image_url || null,
        role,
        isEmailVerified,
        isPhoneVerified,
      },
      {
        email,
        firstName: first_name || null,
        lastName: last_name || null,
        phone: phone || null,
        avatar: image_url || null,
        isEmailVerified,
        isPhoneVerified,
      },
    );

    logger.info("User created successfully", {
      correlationId,
      userId: user.id,
      email: user.email,
    });

    return apiSuccess(
      {
        userId: user.id,
        message: "User created successfully",
      },
      HttpStatus.OK,
    );
  } catch (err: unknown) {
    const prismaErr = err as PrismaError;
    logger.error(
      "User creation failed",
      err instanceof Error ? err : new Error(String(err)),
      {
        correlationId,
        clerkId: id,
        errorCode: prismaErr.code,
      },
    );

    if (prismaErr.code === "P2002") {
      return apiError("User already exists", HttpStatus.CONFLICT);
    }

    return apiError("Failed to create user", HttpStatus.INTERNAL_SERVER_ERROR);
  }
}

/**
 * Handle user.updated webhook event
 */
async function handleUserUpdated(
  evt: ClerkWebhookEvent,
  userRepo: UserRepository,
  correlationId: string,
) {
  const {
    id,
    email_addresses,
    first_name,
    last_name,
    phone_numbers,
    image_url,
    public_metadata,
  } = evt.data;

  if (!id) {
    logger.error("Missing user ID in update event", undefined, {
      correlationId,
    });
    return apiError("Missing user ID", HttpStatus.BAD_REQUEST);
  }

  const emailData = email_addresses?.[0];
  const email = emailData?.email_address;
  const isEmailVerified = emailData?.verification?.status === "verified";

  const phoneData = phone_numbers?.[0];
  const phone = phoneData?.phone_number;
  const isPhoneVerified = phoneData?.verification?.status === "verified";

  logger.info("Processing user update", {
    correlationId,
    clerkId: id,
    hasMetadata: !!public_metadata,
  });

  try {
    const updateData: any = {
      ...(email && { email }),
      ...(first_name !== undefined && { firstName: first_name || null }),
      ...(last_name !== undefined && { lastName: last_name || null }),
      ...(phone !== undefined && { phone: phone || null }),
      ...(image_url !== undefined && { avatar: image_url || null }),
      ...(isEmailVerified !== undefined && { isEmailVerified }),
      ...(isPhoneVerified !== undefined && { isPhoneVerified }),
    };

    // Update role if changed in metadata
    if (public_metadata?.role) {
      const roleStr = public_metadata.role.toUpperCase();
      if (
        roleStr === "PROFESSIONAL" ||
        roleStr === "CLIENT" ||
        roleStr === "ADMIN"
      ) {
        updateData.role = roleStr as UserRole;
      }
    }

    const user = await userRepo.update(id, updateData);

    // Sync professional verification status if metadata contains isVerified
    if (public_metadata?.isVerified !== undefined) {
      await syncProfessionalVerification(
        id,
        public_metadata.isVerified,
        correlationId,
      );
    }

    logger.info("User updated successfully", {
      correlationId,
      userId: user.id,
    });

    return apiSuccess(
      {
        userId: user.id,
        message: "User updated successfully",
      },
      HttpStatus.OK,
    );
  } catch (err: unknown) {
    const prismaErr = err as PrismaError;
    logger.error(
      "User update failed",
      err instanceof Error ? err : new Error(String(err)),
      {
        correlationId,
        clerkId: id,
        errorCode: prismaErr.code,
      },
    );

    if (prismaErr.code === "P2025") {
      return apiError("User not found", HttpStatus.NOT_FOUND);
    }

    return apiError("Failed to update user", HttpStatus.INTERNAL_SERVER_ERROR);
  }
}

/**
 * Handle user.deleted webhook event
 */
async function handleUserDeleted(
  evt: ClerkWebhookEvent,
  userRepo: UserRepository,
  correlationId: string,
) {
  const { id } = evt.data;

  if (!id) {
    logger.error("Missing user ID in delete event", undefined, {
      correlationId,
    });
    return apiError("Missing user ID", HttpStatus.BAD_REQUEST);
  }

  logger.info("Processing user deletion", { correlationId, clerkId: id });

  try {
    // Soft delete the user
    await prisma.user.update({
      where: { clerkId: id },
      data: {
        deletedAt: new Date(),
        status: "ARCHIVED",
      },
    });

    logger.info("User soft deleted successfully", {
      correlationId,
      clerkId: id,
    });

    return apiSuccess(
      {
        message: "User deletion acknowledged",
      },
      HttpStatus.OK,
    );
  } catch (err: unknown) {
    logger.error(
      "User deletion failed",
      err instanceof Error ? err : new Error(String(err)),
      {
        correlationId,
        clerkId: id,
      },
    );
    return apiError("Failed to delete user", HttpStatus.INTERNAL_SERVER_ERROR);
  }
}

/**
 * Sync professional verification status from Clerk metadata to database
 * Called when user.updated event contains verification metadata changes
 */
async function syncProfessionalVerification(
  clerkId: string,
  isVerified: boolean,
  correlationId: string,
) {
  try {
    // Find user by clerkId
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

    // Update professional profile verification status
    const profile = await prisma.professionalProfile.findUnique({
      where: { userId: user.id },
      select: { verified: true },
    });

    if (!profile) {
      logger.debug("No professional profile found for verification sync", {
        correlationId,
        clerkId,
      });
      return;
    }

    // Only update if status changed
    if (profile.verified !== isVerified) {
      const newStatus = isVerified
        ? VerificationStatus.VERIFIED
        : VerificationStatus.UNVERIFIED;

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
        status: newStatus,
      });
    }
  } catch (err) {
    logger.error(
      "Failed to sync professional verification",
      err instanceof Error ? err : new Error(String(err)),
      {
        correlationId,
        clerkId,
      },
    );
  }
}
