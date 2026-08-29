import "../prisma/load-env";
import { prisma, disconnectDatabase, UserRole } from "../lib/prisma";

async function deleteAllUsers() {
  try {
    console.log("🗑️  Starting deletion process...\n");

    // Count before deletion
    const clientsBefore = await prisma.user.count({
      where: { role: UserRole.CLIENT },
    });
    const professionalsBefore = await prisma.user.count({
      where: { role: UserRole.PROFESSIONAL },
    });

    console.log(
      `Found ${clientsBefore} clients and ${professionalsBefore} professionals\n`,
    );

    if (clientsBefore === 0 && professionalsBefore === 0) {
      console.log("✅ No users to delete");
      return;
    }

    // Delete clients
    console.log("Deleting clients...");
    const deletedClients = await prisma.user.deleteMany({
      where: { role: UserRole.CLIENT },
    });
    console.log(`✅ Deleted ${deletedClients.count} clients\n`);

    // Delete professionals
    console.log("Deleting professionals...");
    const deletedProfessionals = await prisma.user.deleteMany({
      where: { role: UserRole.PROFESSIONAL },
    });
    console.log(`✅ Deleted ${deletedProfessionals.count} professionals\n`);

    // Verify
    const clientsAfter = await prisma.user.count({
      where: { role: UserRole.CLIENT },
    });
    const professionalsAfter = await prisma.user.count({
      where: { role: UserRole.PROFESSIONAL },
    });

    console.log("Verification:");
    console.log(`  Remaining clients: ${clientsAfter}`);
    console.log(`  Remaining professionals: ${professionalsAfter}\n`);

    if (clientsAfter === 0 && professionalsAfter === 0) {
      console.log("✅ All users successfully deleted!");
    } else {
      console.log("⚠️  Warning: Some users remain");
    }
  } catch (error) {
    console.error("❌ Error:", error);
    throw error;
  } finally {
    await disconnectDatabase();
  }
}

deleteAllUsers();
