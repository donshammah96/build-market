"use server";

import { revalidatePath } from "next/cache";
import { clerkClient } from "@clerk/nextjs/server";
import { Prisma, prisma } from "@repo/db";
import { safeAction } from "./shared";
import { PaginationSchema } from "./types";

// ============================================================================
// Types
// ============================================================================

export type UserWithProfile = Prisma.UserGetPayload<{
  include: {
    professionalProfile: {
      select: { companyName: true; verified: true };
    };
  };
}>;

export type UserDetails = Prisma.UserGetPayload<{
  include: {
    professionalProfile: true;
    clientProfile: true;
    orders: true;
    reviews: {
      include: {
        professional: { select: { companyName: true } };
      };
    };
  };
}>;

// ============================================================================
// Actions
// ============================================================================

/**
 * Fetches a paginated list of users with optional search.
 * Includes professional profile summary for quick status view.
 */
export async function getUsers(page = 1, limit = 10, search = "") {
  return safeAction("getUsers", async () => {
    const valid = PaginationSchema.parse({ page, limit, search });
    const skip = (valid.page - 1) * valid.limit;

    const where: Prisma.UserWhereInput = valid.search ? {
      OR: [
        { email: { contains: valid.search, mode: "insensitive" } },
        { firstName: { contains: valid.search, mode: "insensitive" } },
        { lastName: { contains: valid.search, mode: "insensitive" } },
      ],
    } : {};

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: valid.limit,
        orderBy: { createdAt: "desc" },
        include: {
          professionalProfile: {
            select: { companyName: true, verified: true },
          },
        },
      }),
      prisma.user.count({ where }),
    ]);

    return {
      users,
      meta: {
        total,
        page: valid.page,
        limit: valid.limit,
        totalPages: Math.ceil(total / valid.limit),
      }
    };
  });
}

/**
 * Fetches complete user details with related profiles and recent activity.
 */
export async function getUserDetails(userId: string) {
  return safeAction("getUserDetails", async () => {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        professionalProfile: true,
        clientProfile: true,
        orders: {
          take: 5,
          orderBy: { createdAt: 'desc' }
        },
        reviews: {
          take: 5,
          orderBy: { createdAt: 'desc' },
          include: {
            professional: { select: { companyName: true } }
          }
        }
      }
    });

    if (!user) throw new Error("User not found");
    return user;
  });
}

/**
 * Permanently removes a user from both Clerk and database.
 * Returns the deleted user ID for optimistic UI updates.
 * 
 * @warning This is a destructive action with cascading deletes.
 */
export async function deleteUser(userId: string) {
  return safeAction("deleteUser", async () => {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, clerkId: true, email: true }
    });

    if (!user) throw new Error("User not found");

    // 1. Attempt Clerk Deletion
    try {
      const client = await clerkClient();
      await client.users.deleteUser(user.clerkId);
    } catch (clerkError: unknown) {
      // If user is not found in Clerk (404), we can proceed to delete from DB
      const error = clerkError as { status?: number };
      if (error.status !== 404) {
        console.error("Clerk delete error:", clerkError);
        throw new Error("Failed to remove user from identity provider");
      }
    }

    // 2. DB Deletion (Cascading)
    await prisma.user.delete({ where: { id: userId } });

    revalidatePath("/users");
    
    // Return deleted user info for optimistic updates
    return { 
      deleted: true,
      userId: user.id,
      email: user.email,
    };
  });
}
