import { auth } from "@clerk/nextjs/server";
import { prisma } from "@build/db";

export async function syncUserRole() {
  const { userId, sessionClaims } = await auth();

  if (!userId) return;

  // 1. Get the role from Clerk's session (Source of Truth)
  const metadata = sessionClaims?.metadata as { role?: string } | undefined;
  const clerkRole = metadata?.role;

  if (!clerkRole) return; // No role set in Clerk yet

  // 2. Get the current user from DB
  const dbUser = await prisma.user.findUnique({
    where: { clerkId: userId },
    select: { role: true },
  });

  // 3. If they mismatch, update the DB
  if (dbUser && dbUser.role !== clerkRole) {
    console.log(
      `Syncing Role: Updating user ${userId} from ${dbUser.role} to ${clerkRole}`,
    );

    await prisma.user.update({
      where: { clerkId: userId },
      data: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        role: clerkRole as any,
      },
    });
  }
}
