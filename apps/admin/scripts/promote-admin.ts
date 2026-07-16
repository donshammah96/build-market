import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import readline from "readline";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env") });

function askQuestion(query: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) =>
    rl.question(query, (ans) => {
      rl.close();
      resolve(ans);
    }),
  );
}

async function main() {
  const email = process.argv[2];
  if (!email || email.startsWith("-")) {
    console.error(
      "Error: Please provide a valid email address as the first argument.",
    );
    console.error("Usage: pnpm tsx scripts/promote-admin.ts <email> [--yes]");
    process.exit(1);
  }

  const { prisma, UserRole, AdminRole } = await import("@build/db");

  // Resolve and log the database host
  const dbUrl = process.env.DATABASE_URL;
  let host = "Unknown Host";
  if (dbUrl) {
    try {
      const url = new URL(dbUrl);
      host = url.host;
    } catch {
      host = dbUrl;
    }
  }
  console.log(`Target database host: ${host}`);
  console.log(`About to promote user: ${email} to ADMIN / SUPER_ADMIN`);

  const skipPrompt = process.argv.includes("--yes");
  if (!skipPrompt) {
    const confirmation = await askQuestion(
      "Are you sure you want to proceed? (y/N): ",
    );
    if (
      confirmation.toLowerCase() !== "y" &&
      confirmation.toLowerCase() !== "yes"
    ) {
      console.log("Operation aborted.");
      process.exit(0);
    }
  }

  try {
    // 1. Promote User to ADMIN role in standard user table
    const user = await prisma.user.update({
      where: { email },
      data: { role: UserRole.ADMIN },
    });
    console.log(`Successfully promoted ${email} to ADMIN user.`);

    // 2. Create or update the AdminProfile as SUPER_ADMIN
    await prisma.adminProfile.upsert({
      where: { userId: user.id },
      update: {
        role: AdminRole.SUPER_ADMIN,
        isActive: true,
      },
      create: {
        userId: user.id,
        role: AdminRole.SUPER_ADMIN,
        isActive: true,
      },
    });
    console.log(
      `Successfully set ${email}'s AdminProfile to SUPER_ADMIN (isActive: true).`,
    );

    // 3. Write an AdminAuditLog row for the promotion
    await prisma.adminAuditLog.create({
      data: {
        adminId: null,
        adminName: "SYSTEM/CLI",
        adminEmail: "cli-script@buildmarket.app",
        adminRole: "SYSTEM",
        action: "ADMIN_PROMOTED",
        severity: "CRITICAL",
        status: "SUCCESS",
        targetId: user.id,
        targetType: "User",
        reason: `CLI promotion of ${email} to SUPER_ADMIN`,
        details: {
          promotedEmail: email,
          promotedUserId: user.id,
          adminRoleAssigned: "SUPER_ADMIN",
          userRoleAssigned: "ADMIN",
          executionTime: new Date().toISOString(),
        },
      },
    });
    console.log("Successfully recorded audit log for admin promotion.");
  } catch (error) {
    console.error(`Failed to promote ${email}:`, error);
    process.exit(1);
  }
}

main().catch((e) => console.error(e));
