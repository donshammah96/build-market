import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@repo/db';
import { apiError } from './api-response';
import { z } from 'zod';

/**
 * Context provided to authenticated route handlers
 */
export interface AuthContext {
  clerkId: string;
  dbUserId: string;
  userEmail: string;
}

/**
 * Handler function with authentication context
 */
type AuthenticatedHandler<T = any> = (
  req: NextRequest,
  context: AuthContext,
  params?: T
) => Promise<NextResponse>;

/**
 * Middleware that ensures the request is authenticated via Clerk
 * and provides the database user ID in the context
 */
export function withAuth<T = any>(handler: AuthenticatedHandler<T>) {
  return async (req: NextRequest, routeContext: { params?: Promise<T> } = {}) => {
    try {
      // Get Clerk user ID
      const { userId: clerkId } = await auth();

      if (!clerkId) {
        return apiError('Unauthorized. Please sign in.', 401);
      }

      // Get database user
      const user = await prisma.user.findUnique({
        where: { clerkId },
        select: { id: true, email: true },
      });

      if (!user) {
        return apiError('User not found. Please complete onboarding.', 404);
      }

      const context: AuthContext = {
        clerkId,
        dbUserId: user.id,
        userEmail: user.email,
      };

      // Resolve params if provided
      const params = routeContext?.params ? await routeContext.params : undefined;

      return handler(req, context, params);
    } catch (error) {
      console.error('Authentication middleware error:', error);
      return apiError('Authentication failed', 401);
    }
  };
}

/**
 * Middleware for validating request body against a Zod schema
 */
export function withValidation<T extends z.ZodType>(schema: T) {
  return (handler: (req: NextRequest, data: z.infer<T>) => Promise<NextResponse>) => {
    return async (req: NextRequest) => {
      try {
        const body = await req.json();
        const validatedData = schema.parse(body);
        return handler(req, validatedData);
      } catch (error) {
        if (error instanceof z.ZodError) {
          return apiError('Validation failed', 400, error.issues);
        }
        return apiError('Invalid request body', 400);
      }
    };
  };
}

/**
 * Combine multiple middleware functions
 */
export function compose(...middlewares: any[]) {
  return (handler: any) => {
    return middlewares.reduceRight((acc, middleware) => middleware(acc), handler);
  };
}

/**
 * Middleware for checking if user has a specific role
 */
export function withRole(allowedRoles: string[]) {
  return (handler: AuthenticatedHandler) => {
    return withAuth(async (req, context, params) => {
      const user = await prisma.user.findUnique({
        where: { id: context.dbUserId },
        select: { role: true },
      });

      if (!user || !allowedRoles.includes(user.role)) {
        return apiError('Forbidden. Insufficient permissions.', 403);
      }

      return handler(req, context, params);
    });
  };
}

