import { PrismaClient } from "@build/db";
import fs from "fs";
import path from "path";

// Load .env manually since we are running via tsx
const envPath = path.resolve(process.cwd(), "apps/admin/.env");
console.log("Loading env from:", envPath);
if (fs.existsSync(envPath)) {
  const envConfig = fs.readFileSync(envPath, "utf8");
  envConfig.split("\n").forEach((line) => {
    const parts = line.split("=");
    if (parts.length >= 2) {
      const key = parts[0]?.trim();
      const val = parts.slice(1).join("=").trim().replace(/"/g, "");
      if (key && val) {
        process.env[key] = val;
      }
    }
  });
} else {
  console.error("No .env file found at", envPath);
}

const prisma = new PrismaClient();

async function main() {
  // Dynamic import to ensure env vars are loaded first
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
          role: "client",
        },
      });
    }

    console.log("Sync complete.");
  } catch (error) {
    console.error("Error fetching/syncing users:", error);
  }
}

main()
  .catch((e) => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
