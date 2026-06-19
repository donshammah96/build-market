import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env") });

async function main() {
  const { prisma, UserRole, AdminRole } = await import("@build/db");
  const emails = ["[EMAIL_ADDRESS]"];

  for (const email of emails) {
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
    } catch (error) {
      console.error(`Failed to promote ${email}:`, error);
    }
  }
}

main().catch((e) => console.error(e));
