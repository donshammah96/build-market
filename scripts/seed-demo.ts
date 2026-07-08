#!/usr/bin/env npx tsx
/**
 * seed-demo.ts
 *
 * Idempotent seed script to initialize the live demo environment.
 * Resets Postgres database entries and Redis logs/rate limits.
 */

import { UserStatus } from "@prisma/client";
import { getRedisClient } from "@build/redis";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "../packages/db/.env") });
dotenv.config({ path: path.resolve(__dirname, "../apps/client/.env") });

let prisma: any;

const DEMO_EMAILS = [
  "don@example.com",
  "second_prof@example.com",
  "reviewer@example.com",
];

async function main() {
  const prismaPath = path.resolve(
    __dirname,
    "../packages/db/dist/lib/prisma.js",
  );
  const { prisma: prismaClient } = await import(pathToFileURL(prismaPath).href);
  prisma = prismaClient;
  console.log("🧹 Initializing Demo Environment Cleanup...");

  // 1. Fetch existing demo user IDs first to delete associated records
  const existingUsers = await prisma.user.findMany({
    where: { email: { in: DEMO_EMAILS } },
    select: { id: true },
  });
  const demoUserIds = existingUsers.map((u: any) => u.id);

  // 2. Delete idempotency keys for these user IDs
  const deletedKeys = await prisma.idempotencyKey.deleteMany({
    where: {
      userId: { in: demoUserIds },
    },
  });
  console.log(`   Deleted ${deletedKeys.count} idempotency key(s).`);

  // 3. Delete users from database (cascades to profiles, documents, licenses)
  const deletedUsers = await prisma.user.deleteMany({
    where: {
      id: { in: demoUserIds },
    },
  });
  console.log(`   Deleted ${deletedUsers.count} existing demo user(s).`);

  // 3. Clear demo telemetry logs in Redis
  try {
    const redis = getRedisClient();
    await redis.del("demo:logs");
    console.log("   Cleared Redis demo:logs telemetry queue.");

    // Clear rate limits for demo users
    const rateLimitPatterns = [
      "prof-licenses-write:clerk_don_demo",
      "prof-docs-write:clerk_don_demo",
      "prof-certificates-write:clerk_don_demo",
      "prof-licenses-read:clerk_don_demo",
      "prof-docs-read:clerk_don_demo",
      "prof-certificates-read:clerk_don_demo",
    ];
    for (const key of rateLimitPatterns) {
      await redis.del(`limit:${key}`);
    }
    console.log("   Cleared Redis rate-limiting keys for demo users.");
  } catch (err) {
    console.warn(
      "⚠️  Redis cleanup skipped (Upstash credentials might be missing or offline).",
    );
  }

  console.log("🌱 Seeding Demo Users...");

  // 4. Seed Reviewer Admin
  const reviewer = await prisma.user.create({
    data: {
      clerkId: "clerk_reviewer_demo",
      email: "reviewer@example.com",
      firstName: "Admin",
      lastName: "Reviewer",
      role: "ADMIN",
      status: "ACTIVE",
      isEmailVerified: true,
      adminProfile: {
        create: {
          role: "SUPER_ADMIN",
        },
      },
    },
  });
  console.log(`   Seeded Reviewer Admin: ${reviewer.email}`);

  // 5. Seed don (Professional - Zero state)
  const don = await prisma.user.create({
    data: {
      clerkId: "clerk_don_demo",
      email: "don@example.com",
      firstName: "don",
      lastName: "Electrical",
      role: "PROFESSIONAL",
      status: "ONBOARDING",
      isEmailVerified: true,
      professionalProfile: {
        create: {
          companyName: "don Electrical Contractors",
          profession: "ELECTRICAL_ENGINEER",
          verified: false,
          verificationStatus: "PENDING",
        },
      },
    },
  });
  console.log(`   Seeded Professional (don): ${don.email}`);

  // 6. Seed Second Professional (For IDOR test)
  const secondProf = await prisma.user.create({
    data: {
      clerkId: "clerk_second_prof_demo",
      email: "second_prof@example.com",
      firstName: "Second",
      lastName: "Professional",
      role: "PROFESSIONAL",
      status: "PENDING_VERIFICATION",
      isEmailVerified: true,
      professionalProfile: {
        create: {
          companyName: "Second Contractors Ltd",
          profession: "GENERAL_CONTRACTOR",
          verified: false,
          verificationStatus: "PENDING",
          licenses: {
            create: [
              {
                authority: "NCA",
                licenseNumber: "NCA-DEMO-2222",
                category: "NCA 1",
                validFrom: new Date(),
                validUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
                status: "PENDING",
              },
            ],
          },
          documents: {
            create: [
              {
                category: "ID_OR_PASSPORT",
                title: "National ID Second Prof",
                status: "PENDING",
              },
            ],
          },
        },
      },
    },
  });
  console.log(
    `   Seeded Second Professional (IDOR target): ${secondProf.email}`,
  );

  console.log("✅ Demo environment seeded successfully!");
}

main()
  .catch((e) => {
    console.error("❌ Seeding failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
