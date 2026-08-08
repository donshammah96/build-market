import "./prisma/load-env";
import { prisma } from "./lib/prisma";

async function grantAdminAccess() {
  const clerkId = "user_3FKfonUuBhDFq41AfYXQ0yPHPdw";
  const email = "donshammah1@gmail.com";

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
        role: "ADMIN",
        status: "ACTIVE",
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
      role: "SUPER_ADMIN",
      isActive: true,
    },
    update: {
      role: "SUPER_ADMIN",
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
    await prisma.$disconnect();
  });
