#!/usr/bin/env npx tsx
/**
 * Clear Users Script
 * 
 * Deletes users from both Clerk and the database.
 * This is useful for development/testing to reset user state.
 * 
 * Usage:
 *   npx tsx scripts/clear-users.ts [options]
 * 
 * Options:
 *   --role <client|professional|all>  Filter by role (default: all)
 *   --dry-run                         Show what would be deleted without deleting
 *   --confirm                         Skip confirmation prompt
 *   --help                            Show help
 * 
 * Examples:
 *   npx tsx scripts/clear-users.ts --role client --dry-run
 *   npx tsx scripts/clear-users.ts --role all --confirm
 */

import { prisma } from '@repo/db';
import { UserRole } from '@prisma/client';
import { createClerkClient } from '@clerk/backend';
import * as readline from 'readline';

// Initialize Clerk client
const clerk = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY!,
});

interface Options {
  role: 'client' | 'professional' | 'all';
  dryRun: boolean;
  confirm: boolean;
}

function parseArgs(): Options {
  const args = process.argv.slice(2);
  const options: Options = {
    role: 'all',
    dryRun: false,
    confirm: false,
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--role':
        const role = args[++i];
        if (!['client', 'professional', 'all'].includes(role)) {
          console.error(`Invalid role: ${role}. Must be client, professional, or all.`);
          process.exit(1);
        }
        options.role = role as Options['role'];
        break;
      case '--dry-run':
        options.dryRun = true;
        break;
      case '--confirm':
        options.confirm = true;
        break;
      case '--help':
        console.log(`
Clear Users Script

Deletes users from both Clerk and the database.

Usage:
  npx ts-node scripts/clear-users.ts [options]

Options:
  --role <client|professional|all>  Filter by role (default: all)
  --dry-run                         Show what would be deleted without deleting
  --confirm                         Skip confirmation prompt
  --help                            Show help

Examples:
  npx ts-node scripts/clear-users.ts --role client --dry-run
  npx ts-node scripts/clear-users.ts --role all --confirm
        `);
        process.exit(0);
    }
  }

  return options;
}

async function prompt(question: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
    });
  });
}

async function main() {
  const options = parseArgs();
  
  console.log('\n🧹 Clear Users Script');
  console.log('='.repeat(50));
  console.log(`Role filter: ${options.role}`);
  console.log(`Dry run: ${options.dryRun}`);
  console.log('');

  try {
    // Build where clause based on role
    const whereClause = options.role === 'all' 
      ? { role: { in: ['client' as UserRole, 'professional' as UserRole] } }
      : { role: options.role as UserRole };

    // Fetch users to delete
    const users = await prisma.user.findMany({
      where: whereClause,
      select: {
        id: true,
        clerkId: true,
        email: true,
        role: true,
        firstName: true,
        lastName: true,
      },
    });

    console.log(`Found ${users.length} user(s) to delete:\n`);

    if (users.length === 0) {
      console.log('✅ No users found matching criteria. Nothing to delete.\n');
      return;
    }

    // List users
    users.forEach((user, index) => {
      const name = [user.firstName, user.lastName].filter(Boolean).join(' ') || 'No name';
      console.log(`  ${index + 1}. [${user.role}] ${name} <${user.email}>`);
    });
    console.log('');

    if (options.dryRun) {
      console.log('🔍 DRY RUN - No changes will be made.\n');
      console.log('To actually delete these users, run without --dry-run flag.\n');
      return;
    }

    // Confirm deletion
    if (!options.confirm) {
      const confirmed = await prompt(`⚠️  Delete ${users.length} user(s)? This cannot be undone. (y/N): `);
      if (!confirmed) {
        console.log('\n❌ Cancelled.\n');
        return;
      }
    }

    console.log('\n🗑️  Deleting users...\n');

    let clerkDeleted = 0;
    let clerkErrors = 0;
    let dbDeleted = 0;

    for (const user of users) {
      const name = [user.firstName, user.lastName].filter(Boolean).join(' ') || 'No name';
      process.stdout.write(`  Deleting ${name} <${user.email}>...`);

      // 1. Delete from Clerk
      try {
        await clerk.users.deleteUser(user.clerkId);
        clerkDeleted++;
        process.stdout.write(' [Clerk ✓]');
      } catch (clerkError: any) {
        // User might not exist in Clerk (404), which is fine
        if (clerkError.status === 404) {
          process.stdout.write(' [Clerk: not found]');
        } else {
          clerkErrors++;
          process.stdout.write(` [Clerk ✗: ${clerkError.message}]`);
        }
      }

      // 2. Delete from Database (cascades to profiles)
      try {
        await prisma.user.delete({ where: { id: user.id } });
        dbDeleted++;
        process.stdout.write(' [DB ✓]\n');
      } catch (dbError: any) {
        process.stdout.write(` [DB ✗: ${dbError.message}]\n`);
      }
    }

    console.log('\n' + '='.repeat(50));
    console.log('📊 Summary:');
    console.log(`  - Users found: ${users.length}`);
    console.log(`  - Deleted from Clerk: ${clerkDeleted}`);
    console.log(`  - Clerk errors: ${clerkErrors}`);
    console.log(`  - Deleted from DB: ${dbDeleted}`);
    console.log('='.repeat(50) + '\n');

    // Verify
    const remaining = await prisma.user.count({ where: whereClause });
    console.log(`✅ Remaining ${options.role} users in DB: ${remaining}\n`);

  } catch (error) {
    console.error('\n❌ Error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
