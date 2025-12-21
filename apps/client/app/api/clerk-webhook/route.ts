import { Webhook } from 'svix';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@repo/db';
import { apiError, apiSuccess, HttpStatus } from '@/app/lib/api-response';
import { UserRepository } from '@/app/lib/repositories/user.repository';
import { checkRateLimit, getRateLimitIdentifier, RateLimits } from '@/app/lib/rate-limit';
import { env } from '@/app/lib/env';
import { initializeCorrelationId, getClientLogger } from '@/app/lib/resilient-api';

const logger = getClientLogger();

// Clerk webhook event types
interface ClerkEmailAddress {
  email_address: string;
}

interface ClerkPhoneNumber {
  phone_number: string;
}

interface ClerkUserData {
  id: string;
  email_addresses?: ClerkEmailAddress[];
  first_name?: string | null;
  last_name?: string | null;
  phone_numbers?: ClerkPhoneNumber[];
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

  logger.info('Webhook request received', { correlationId });

  try {
    // Rate limiting for webhooks
    const identifier = getRateLimitIdentifier(req);
    const rateLimitResult = await checkRateLimit(
      `webhook:${identifier}`,
      RateLimits.WEBHOOK.limit,
      RateLimits.WEBHOOK.window
    );

    if (!rateLimitResult.success) {
      return apiError('Too many webhook requests', HttpStatus.TOO_MANY_REQUESTS);
    }

    // Check webhook secret
    if (!env.CLERK_WEBHOOK_SECRET) {
      logger.error('CLERK_WEBHOOK_SECRET not configured', undefined, { correlationId });
      return apiError('Service configuration error', HttpStatus.INTERNAL_SERVER_ERROR);
    }

    // Parse request
    const payload = await req.text();
    const headers = Object.fromEntries(req.headers);

    logger.debug('Webhook payload received', { correlationId, payloadLength: payload.length });

    // Verify webhook signature
    const wh = new Webhook(env.CLERK_WEBHOOK_SECRET);
    let evt: ClerkWebhookEvent;

    try {
      evt = wh.verify(payload, headers) as ClerkWebhookEvent;
    } catch (verifyError) {
      logger.error('Webhook signature verification failed', verifyError instanceof Error ? verifyError : new Error(String(verifyError)), { correlationId });
      return apiError('Invalid webhook signature', HttpStatus.UNAUTHORIZED);
    }

    logger.info('Webhook verified', { correlationId, eventType: evt.type });

    // Check database connection
    try {
      await prisma.$connect();
      logger.debug('Database connection verified', { correlationId });
    } catch (dbError) {
      logger.error('Database connection failed', dbError instanceof Error ? dbError : new Error(String(dbError)), { correlationId });
      return apiError('Database connection failed', HttpStatus.SERVICE_UNAVAILABLE);
    }

    // Initialize repository
    const userRepo = new UserRepository(prisma);

    // Handle user.created event
    if (evt.type === 'user.created') {
      return await handleUserCreated(evt, userRepo, correlationId);
    }

    // Handle user.updated event
    if (evt.type === 'user.updated') {
      return await handleUserUpdated(evt, userRepo, correlationId);
    }

    // Handle user.deleted event (optional)
    if (evt.type === 'user.deleted') {
      return await handleUserDeleted(evt, userRepo, correlationId);
    }

    // Other events - just acknowledge
    logger.info('Event type not handled', { correlationId, eventType: evt.type });
    return apiSuccess(
      { message: `Event ${evt.type} acknowledged` },
      HttpStatus.OK
    );
  } catch (err: unknown) {
    logger.error('Webhook processing failed', err instanceof Error ? err : new Error(String(err)), { correlationId });
    return apiError('Webhook processing failed', HttpStatus.INTERNAL_SERVER_ERROR);
  }
}

/**
 * Handle user.created webhook event
 */
async function handleUserCreated(evt: ClerkWebhookEvent, userRepo: UserRepository, correlationId: string) {
  const { id, email_addresses, first_name, last_name, phone_numbers } = evt.data;

  if (!id || !email_addresses?.[0]?.email_address) {
    logger.error('Missing required data (id or email)', undefined, { correlationId });
    return apiError('Missing required user data', HttpStatus.BAD_REQUEST);
  }

  const email = email_addresses[0].email_address;
  const phone = phone_numbers?.[0]?.phone_number;

  logger.info('Processing user creation', { correlationId, clerkId: id, email });

  try {
    const user = await userRepo.upsert(
      id,
      {
        clerkId: id,
        email,
        firstName: first_name || null,
        lastName: last_name || null,
        phone: phone || null,
        role: 'client',
      },
      {
        email,
        firstName: first_name || null,
        lastName: last_name || null,
        phone: phone || null,
      }
    );

    logger.info('User created successfully', { correlationId, userId: user.id, email: user.email });

    return apiSuccess(
      {
        userId: user.id,
        message: 'User created successfully',
      },
      HttpStatus.OK
    );
  } catch (err: unknown) {
    const prismaErr = err as PrismaError;
    logger.error('User creation failed', err instanceof Error ? err : new Error(String(err)), {
      correlationId,
      clerkId: id,
      errorCode: prismaErr.code,
    });

    if (prismaErr.code === 'P2002') {
      return apiError('User already exists', HttpStatus.CONFLICT);
    }

    return apiError('Failed to create user', HttpStatus.INTERNAL_SERVER_ERROR);
  }
}

/**
 * Handle user.updated webhook event
 */
async function handleUserUpdated(evt: ClerkWebhookEvent, userRepo: UserRepository, correlationId: string) {
  const { id, email_addresses, first_name, last_name, phone_numbers } = evt.data;

  if (!id) {
    logger.error('Missing user ID in update event', undefined, { correlationId });
    return apiError('Missing user ID', HttpStatus.BAD_REQUEST);
  }

  const email = email_addresses?.[0]?.email_address;
  const phone = phone_numbers?.[0]?.phone_number;

  logger.info('Processing user update', { correlationId, clerkId: id });

  try {
    const user = await userRepo.update(id, {
      ...(email && { email }),
      ...(first_name !== undefined && { firstName: first_name || null }),
      ...(last_name !== undefined && { lastName: last_name || null }),
      ...(phone !== undefined && { phone: phone || null }),
    });

    logger.info('User updated successfully', { correlationId, userId: user.id });

    return apiSuccess(
      {
        userId: user.id,
        message: 'User updated successfully',
      },
      HttpStatus.OK
    );
  } catch (err: unknown) {
    const prismaErr = err as PrismaError;
    logger.error('User update failed', err instanceof Error ? err : new Error(String(err)), {
      correlationId,
      clerkId: id,
      errorCode: prismaErr.code,
    });

    if (prismaErr.code === 'P2025') {
      return apiError('User not found', HttpStatus.NOT_FOUND);
    }

    return apiError('Failed to update user', HttpStatus.INTERNAL_SERVER_ERROR);
  }
}

/**
 * Handle user.deleted webhook event
 */
async function handleUserDeleted(evt: ClerkWebhookEvent, userRepo: UserRepository, correlationId: string) {
  const { id } = evt.data;

  if (!id) {
    logger.error('Missing user ID in delete event', undefined, { correlationId });
    return apiError('Missing user ID', HttpStatus.BAD_REQUEST);
  }

  logger.info('Processing user deletion', { correlationId, clerkId: id });

  try {
    // Soft delete or mark as deleted
    // For now, just log it - implement based on your requirements
    logger.info('User deletion acknowledged (not implemented)', { correlationId, clerkId: id });

    return apiSuccess(
      {
        message: 'User deletion acknowledged',
      },
      HttpStatus.OK
    );
  } catch (err: unknown) {
    logger.error('User deletion failed', err instanceof Error ? err : new Error(String(err)), {
      correlationId,
      clerkId: id,
    });
    return apiError('Failed to delete user', HttpStatus.INTERNAL_SERVER_ERROR);
  }
}

