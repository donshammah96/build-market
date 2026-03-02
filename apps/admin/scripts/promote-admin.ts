import { PrismaClient } from "@build/db";

const prisma = new PrismaClient();

async function main() {
  const emails = ["donshammah1@gmail.com", "buildmarkettest@gmail.com"];

  for (const email of emails) {
    try {
      const user = await prisma.user.update({
        where: { email },
        data: { role: "admin" },
      });
      console.log(`Successfully promoted ${email} to admin.`);
    } catch (error) {
      console.error(`Failed to promote ${email}:`, error);
    }
  }
}

main()
  .catch((e) => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
