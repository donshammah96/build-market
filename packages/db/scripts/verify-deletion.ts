import "../prisma/load-env";
import { prisma, disconnectDatabase, UserRole } from "../lib/prisma";

async function verify() {
  const clients = await prisma.user.count({
    where: { role: UserRole.CLIENT },
  });
  const professionals = await prisma.user.count({
    where: { role: UserRole.PROFESSIONAL },
  });

  console.log("Current database status:");
  console.log(`  Clients: ${clients}`);
  console.log(`  Professionals: ${professionals}`);

  await disconnectDatabase();
}

verify();

