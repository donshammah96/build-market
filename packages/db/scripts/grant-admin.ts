import "../prisma/load-env";
import {
  prisma,
  disconnectDatabase,
  UserRole,
  UserStatus,
  AdminRole,
} from "../lib/prisma";

async function grantAdminAccess() {
  const clerkId = process.env.GRANT_ADMIN_CLERK_ID || process.argv[2];
  const email = process.env.GRANT_ADMIN_EMAIL || process.argv[3];

  if (!clerkId || !email) {
    console.error(
      "❌ Missing required parameters. Provide GRANT_ADMIN_CLERK_ID and GRANT_ADMIN_EMAIL env vars, " +
        "or pass them as command line arguments:\n" +
        "   pnpm -C packages/db exec tsx grant-admin.ts <clerkId> <email>",
    );
    process.exit(1);
  }

  console.log(
    `🔍 Searching for user with email "${email}" or clerkId "${clerkId}"...`,
  );

  let user = await prisma.user.findFirst({
    where: {
      OR: [{ clerkId }, { email }],
    },
  });

  if (!user) {
    console.log(`Creating user record for ${email}...`);
    user = await prisma.user.create({
      data: {
        clerkId,
        email,
        role: UserRole.ADMIN,
        status: UserStatus.ACTIVE,
      },
    });
    console.log(`✅ Created User record: ${user.id}`);
  } else {
    console.log(`✅ Found User: ${user.id} (${user.email})`);
    if (!user.clerkId || user.clerkId !== clerkId) {
      await prisma.user.update({
        where: { id: user.id },
        data: { clerkId },
      });
      console.log(`Updated clerkId to ${clerkId}`);
    }
  }

  const profile = await prisma.adminProfile.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      role: AdminRole.SUPER_ADMIN,
      isActive: true,
    },
    update: {
      role: AdminRole.SUPER_ADMIN,
      isActive: true,
    },
  });

  console.log("\n🎉 Admin Profile granted successfully!");
  console.log({
    userId: user.id,
    clerkId: user.clerkId,
    email: user.email,
    adminRole: profile.role,
    isActive: profile.isActive,
  });
}

grantAdminAccess()
  .catch((err) => {
    console.error("❌ Error granting admin access:", err);
    process.exit(1);
  })
  .finally(async () => {
    await disconnectDatabase();
  });
