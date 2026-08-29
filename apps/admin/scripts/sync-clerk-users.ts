import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, "../.env");
console.log("Loading env from:", envPath);
dotenv.config({ path: envPath });

async function main() {
  const { prisma, UserRole, AdminRole } = await import("@build/db");
  const { clerkClient } = await import("@clerk/nextjs/server");

  console.log("Fetching users from Clerk...");
  try {
    const client = await clerkClient();
    const { data: clerkUsers } = await client.users.getUserList({ limit: 100 });

    console.log(`Found ${clerkUsers.length} users in Clerk.`);

    for (const u of clerkUsers) {
      const email = u.emailAddresses?.[0]?.emailAddress;

      if (!email) {
        console.log(`Skipping user ${u.id} (no email)`);
        continue;
      }

      console.log(`Syncing ${email} (${u.id})...`);

      await prisma.user.upsert({
        where: { clerkId: u.id },
        update: {
          email: email,
          firstName: u.firstName,
          lastName: u.lastName,
          avatar: u.imageUrl,
        },
        create: {
          clerkId: u.id,
          email: email,
          firstName: u.firstName,
          lastName: u.lastName,
          avatar: u.imageUrl,
          role: UserRole.ADMIN,
          adminProfile: {
            create: {
              role: AdminRole.SUPER_ADMIN,
              isActive: true,
            },
          },
        },
      });
    }

    console.log("Sync complete.");
  } catch (error) {
    console.error("Error fetching/syncing users:", error);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => console.error(e));
