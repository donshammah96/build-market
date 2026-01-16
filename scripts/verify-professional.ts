#!/usr/bin/env node
/**
 * Verify Professional Script
 * 
 * Admin utility script to verify professional profiles.
 * 
 * Usage:
 *   npx tsx scripts/verify-professional.ts <userId>        # Verify single professional
 *   npx tsx scripts/verify-professional.ts --all           # Verify all unverified professionals
 *   npx tsx scripts/verify-professional.ts --list          # List all unverified professionals
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function listUnverified() {
  const professionals = await prisma.professionalProfile.findMany({
    where: { verified: false },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
        },
      },
    },
  });

  if (professionals.length === 0) {
    console.log('✓ No unverified professionals found.');
    return;
  }

  console.log(`\n📋 Found ${professionals.length} unverified professional(s):\n`);
  console.log('─'.repeat(80));
  
  for (const prof of professionals) {
    console.log(`  User ID:     ${prof.userId}`);
    console.log(`  Name:        ${prof.user.firstName || ''} ${prof.user.lastName || ''}`.trim() || 'N/A');
    console.log(`  Email:       ${prof.user.email}`);
    console.log(`  Company:     ${prof.companyName}`);
    console.log(`  License:     ${prof.licenseNumber || 'N/A'}`);
    console.log(`  Services:    ${prof.servicesOffered.join(', ')}`);
    console.log(`  Created:     ${prof.createdAt.toISOString()}`);
    console.log('─'.repeat(80));
  }
  
  console.log(`\nTo verify a professional, run:`);
  console.log(`  npx tsx scripts/verify-professional.ts <userId>\n`);
}

async function verifyProfessional(userId: string) {
  const professional = await prisma.professionalProfile.findUnique({
    where: { userId },
    include: {
      user: {
        select: { email: true, firstName: true, lastName: true },
      },
    },
  });

  if (!professional) {
    console.error(`❌ Professional with userId "${userId}" not found.`);
    process.exit(1);
  }

  if (professional.verified) {
    console.log(`ℹ️  Professional "${professional.companyName}" is already verified.`);
    return;
  }

  await prisma.professionalProfile.update({
    where: { userId },
    data: { verified: true },
  });

  console.log(`✅ Successfully verified professional:`);
  console.log(`   Name:    ${professional.user.firstName || ''} ${professional.user.lastName || ''}`.trim());
  console.log(`   Email:   ${professional.user.email}`);
  console.log(`   Company: ${professional.companyName}`);
}

async function verifyAll() {
  const result = await prisma.professionalProfile.updateMany({
    where: { verified: false },
    data: { verified: true },
  });

  console.log(`✅ Verified ${result.count} professional(s).`);
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log(`
Verify Professional Script

Usage:
  npx tsx scripts/verify-professional.ts <userId>        # Verify single professional
  npx tsx scripts/verify-professional.ts --all           # Verify all unverified professionals
  npx tsx scripts/verify-professional.ts --list          # List all unverified professionals
`);
    process.exit(0);
  }

  const command = args[0];

  if (command === '--list' || command === '-l') {
    await listUnverified();
  } else if (command === '--all' || command === '-a') {
    await verifyAll();
  } else {
    await verifyProfessional(command);
  }
}

main()
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
