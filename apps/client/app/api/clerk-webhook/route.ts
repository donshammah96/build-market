import { Webhook } from 'svix';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@repo/db';
import { apiError, apiSuccess, HttpStatus } from '@/app/lib/api-response';
import { UserRepository } from '@/app/lib/repositories/user.repository';
import { checkRateLimit, getRateLimitIdentifier, RateLimits } from '@/app/lib/rate-limit';
import { env } from '@/app/lib/env';

/**
 * POST /api/clerk-webhook
 * Handle Clerk webhook events for user creation and updates
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  console.log('===============================================');
  console.log('WEBHOOK: Request received');
  console.log('===============================================');

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
      console.error('ERROR: CLERK_WEBHOOK_SECRET not configured');
      return apiError('Service configuration error', HttpStatus.INTERNAL_SERVER_ERROR);
    }

    // Parse request
    const payload = await req.text();
    const headers = Object.fromEntries(req.headers);

    console.log('WEBHOOK: Payload received, length:', payload.length);

    // Verify webhook signature
    const wh = new Webhook(env.CLERK_WEBHOOK_SECRET);
    let evt: any;

    try {
      evt = wh.verify(payload, headers);
    } catch (verifyError) {
      console.error('WEBHOOK: Signature verification failed:', verifyError);
      return apiError('Invalid webhook signature', HttpStatus.UNAUTHORIZED);
    }

    console.log('WEBHOOK: Verified, event type:', evt.type);

    // Check database connection
    try {
      await prisma.$connect();
      console.log('DATABASE: Connection verified');
    } catch (dbError) {
      console.error('DATABASE: Connection failed:', dbError);
      return apiError('Database connection failed', HttpStatus.SERVICE_UNAVAILABLE);
    }

    // Initialize repository
    const userRepo = new UserRepository(prisma);

    // Handle user.created event
    if (evt.type === 'user.created') {
      return await handleUserCreated(evt, userRepo);
    }

    // Handle user.updated event
    if (evt.type === 'user.updated') {
      return await handleUserUpdated(evt, userRepo);
    }

    // Handle user.deleted event (optional)
    if (evt.type === 'user.deleted') {
      return await handleUserDeleted(evt, userRepo);
    }

    // Other events - just acknowledge
    console.log('WEBHOOK: Event type not handled:', evt.type);
    return apiSuccess(
      { message: `Event ${evt.type} acknowledged` },
      HttpStatus.OK
    );
  } catch (err: any) {
    console.error('===============================================');
    console.error('WEBHOOK ERROR');
    console.error('===============================================');
    console.error(err);
    console.error('===============================================');

    return apiError('Webhook processing failed', HttpStatus.INTERNAL_SERVER_ERROR);
  }
}

/**
 * Handle user.created webhook event
 */
async function handleUserCreated(evt: any, userRepo: UserRepository) {
  const { id, email_addresses, first_name, last_name, phone_numbers } = evt.data;

  if (!id || !email_addresses?.[0]?.email_address) {
    console.error('ERROR: Missing required data (id or email)');
    return apiError('Missing required user data', HttpStatus.BAD_REQUEST);
  }

  const email = email_addresses[0].email_address;
  const phone = phone_numbers?.[0]?.phone_number;

  console.log('USER CREATE: Processing', { clerkId: id, email });

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

    console.log('USER CREATE: Success', { userId: user.id, email: user.email });

    return apiSuccess(
      {
        userId: user.id,
        message: 'User created successfully',
      },
      HttpStatus.OK
    );
  } catch (err: any) {
    console.error('===============================================');
    console.error('USER CREATE: Failed');
    console.error('Error:', err);
    console.error('===============================================');

    if (err.code === 'P2002') {
      return apiError('User already exists', HttpStatus.CONFLICT);
    }

    return apiError('Failed to create user', HttpStatus.INTERNAL_SERVER_ERROR);
  }
}

/**
 * Handle user.updated webhook event
 */
async function handleUserUpdated(evt: any, userRepo: UserRepository) {
  const { id, email_addresses, first_name, last_name, phone_numbers } = evt.data;

  if (!id) {
    console.error('ERROR: Missing user ID in update event');
    return apiError('Missing user ID', HttpStatus.BAD_REQUEST);
  }

  const email = email_addresses?.[0]?.email_address;
  const phone = phone_numbers?.[0]?.phone_number;

  console.log('USER UPDATE: Processing', { clerkId: id });

  try {
    const user = await userRepo.update(id, {
      ...(email && { email }),
      ...(first_name !== undefined && { firstName: first_name || null }),
      ...(last_name !== undefined && { lastName: last_name || null }),
      ...(phone !== undefined && { phone: phone || null }),
    });

    console.log('USER UPDATE: Success', { userId: user.id });

    return apiSuccess(
      {
        userId: user.id,
        message: 'User updated successfully',
      },
      HttpStatus.OK
    );
  } catch (err: any) {
    console.error('USER UPDATE: Failed:', err.message);

    if (err.code === 'P2025') {
      return apiError('User not found', HttpStatus.NOT_FOUND);
    }

    return apiError('Failed to update user', HttpStatus.INTERNAL_SERVER_ERROR);
  }
}

/**
 * Handle user.deleted webhook event
 */
async function handleUserDeleted(evt: any, userRepo: UserRepository) {
  const { id } = evt.data;

  if (!id) {
    console.error('ERROR: Missing user ID in delete event');
    return apiError('Missing user ID', HttpStatus.BAD_REQUEST);
  }

  console.log('USER DELETE: Processing', { clerkId: id });

  try {
    // Soft delete or mark as deleted
    // For now, just log it - implement based on your requirements
    console.log('USER DELETE: User deletion requested but not implemented');

    return apiSuccess(
      {
        message: 'User deletion acknowledged',
      },
      HttpStatus.OK
    );
  } catch (err: any) {
    console.error('USER DELETE: Failed:', err.message);
    return apiError('Failed to delete user', HttpStatus.INTERNAL_SERVER_ERROR);
  }
}
