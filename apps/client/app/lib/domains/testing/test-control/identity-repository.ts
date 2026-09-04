import { prisma } from "@build/db";
import {
  isAllowedScenarioForIdentityLease,
  parseStagingIdentitySlots,
  findAvailableSlotForRole,
  type StagingSlotConfig,
} from "@build/db/staging-test-runs";
import { env } from "@/app/lib/infrastructure/env";

export interface IdentityLease {
  id: string;
  stagingTestRunId: string;
  slot: string;
  role: "CLIENT" | "PROFESSIONAL";
  userId: string;
  clerkId: string;
  state: string;
  leaseExpiresAt: Date;
  resetAt?: Date | null;
  releasedAt?: Date | null;
}

export interface IdentityBaseline {
  role: "CLIENT" | "PROFESSIONAL";
  userStatus: "ONBOARDING";
  onboardingState: "NOT_STARTED";
  isProfileComplete: boolean;
  verified: boolean;
  trustTier: "UNVERIFIED";
}

export interface IdentityResetProjection {
  leaseId: string;
  runId: string;
  slot: string;
  userId: string;
  role: "CLIENT" | "PROFESSIONAL";
  userStatus: string;
  onboardingState: string;
  documentsDeletedCount: number;
  licensesDeletedCount: number;
  verificationCasesDeletedCount: number;
  notificationsDeletedCount: number;
  resetAt: Date;
}

const DEFAULT_STAGING_SLOTS: readonly StagingSlotConfig[] = [
  {
    slot: "pro-1",
    role: "PROFESSIONAL",
    email: "e2e_pro_1@staging.buildmarket.app",
  },
  {
    slot: "pro-2",
    role: "PROFESSIONAL",
    email: "e2e_pro_2@staging.buildmarket.app",
  },
  {
    slot: "client-1",
    role: "CLIENT",
    email: "e2e_client_1@staging.buildmarket.app",
  },
  {
    slot: "client-2",
    role: "CLIENT",
    email: "e2e_client_2@staging.buildmarket.app",
  },
];

function resolveConfiguredSlots(): readonly StagingSlotConfig[] {
  const envSlots = env.stagingTestControl?.identitySlots;
  if (!envSlots) {
    return DEFAULT_STAGING_SLOTS;
  }
  return parseStagingIdentitySlots(envSlots, {
    isProduction: env.isProd,
  });
}

export class IdentityRepository {
  /**
   * Leases a dedicated identity slot for an active staging test run.
   * Concurrent-safe: filters against all active leases in the pool.
   */
  async leaseIdentity(input: {
    runId: string;
    scenario: "onboarding" | "verification";
    role: "CLIENT" | "PROFESSIONAL";
    now?: Date;
  }): Promise<IdentityLease | null> {
    const now = input.now ?? new Date();

    if (!isAllowedScenarioForIdentityLease(input.scenario)) {
      throw new Error(
        `Disallowed scenario "${input.scenario}" for identity lease. Only onboarding and verification are permitted.`,
      );
    }

    const run = await prisma.stagingTestRun.findUnique({
      where: { id: input.runId },
    });

    if (
      !run ||
      run.state !== "ACTIVE" ||
      new Date(run.expiresAt).getTime() <= now.getTime()
    ) {
      throw new Error(
        `Staging test run ${input.runId} is not active or has expired`,
      );
    }

    if (run.scenario !== input.scenario) {
      throw new Error(
        `Run scenario "${run.scenario}" does not match requested scenario "${input.scenario}"`,
      );
    }

    // Check if this run already has an active lease for this role (idempotency)
    const existingRunLease = await prisma.stagingTestIdentityLease.findFirst({
      where: {
        stagingTestRunId: input.runId,
        role: input.role,
        state: { in: ["LEASED", "RESETTING", "READY"] },
        leaseExpiresAt: { gt: now },
      },
    });

    if (existingRunLease) {
      return existingRunLease as unknown as IdentityLease;
    }

    const slots = resolveConfiguredSlots();

    // Query currently active leases across all runs
    const activeLeases = await prisma.stagingTestIdentityLease.findMany({
      where: {
        state: { in: ["LEASED", "RESETTING", "READY"] },
        leaseExpiresAt: { gt: now },
      },
      select: { slot: true },
    });

    const activeSlotSet = new Set(activeLeases.map((l) => l.slot));
    const availableSlot = findAvailableSlotForRole(
      slots,
      input.role,
      activeSlotSet,
    );

    if (!availableSlot) {
      return null;
    }

    // Resolve user strictly from the server-configured slot email
    const user = await prisma.user.findFirst({
      where: { email: availableSlot.email, role: input.role },
      select: { id: true, clerkId: true },
    });

    if (!user) {
      throw new Error(
        `STAGING_TEST_USER_MISSING: Pre-provisioned user "${availableSlot.email}" was not found in DB`,
      );
    }

    const created = await prisma.stagingTestIdentityLease.create({
      data: {
        stagingTestRunId: input.runId,
        slot: availableSlot.slot,
        role: input.role,
        userId: user.id,
        clerkId: user.clerkId,
        state: "LEASED",
        leaseExpiresAt: new Date(now.getTime() + 300_000), // 5 minute lease
      },
    });

    return created as unknown as IdentityLease;
  }

  /**
   * Restores database baseline for the leased identity.
   * Owns ONLY records tied to the leased userId. Never deletes base User.
   */
  async restoreIdentityBaseline(input: {
    leaseId: string;
    runId: string;
    baseline: IdentityBaseline;
    now?: Date;
  }): Promise<IdentityResetProjection> {
    const now = input.now ?? new Date();

    const lease = await prisma.stagingTestIdentityLease.findUnique({
      where: { id: input.leaseId },
    });

    if (!lease) {
      throw new Error(`Identity lease "${input.leaseId}" not found`);
    }

    if (lease.stagingTestRunId !== input.runId) {
      throw new Error(
        `Identity lease "${input.leaseId}" is not owned by run "${input.runId}" (foreign run rejection)`,
      );
    }

    if (
      lease.state === "RELEASED" ||
      lease.state === "FAILED" ||
      new Date(lease.leaseExpiresAt).getTime() <= now.getTime()
    ) {
      throw new Error(
        `Cannot restore baseline on inactive or expired lease "${input.leaseId}"`,
      );
    }

    return prisma.$transaction(async (tx) => {
      // 1. Mark lease RESETTING
      await tx.stagingTestIdentityLease.update({
        where: { id: lease.id },
        data: { state: "RESETTING" },
      });

      // 2. Reset base User fields (preserving the base User row)
      await tx.user.update({
        where: { id: lease.userId },
        data: {
          status: "ONBOARDING",
          isProfileComplete: false,
          isEmailVerified: true,
          role: lease.role as any,
        },
      });

      // 3. Upsert OnboardingState to NOT_STARTED
      await tx.onboardingState.upsert({
        where: { userId: lease.userId },
        create: {
          userId: lease.userId,
          state: "NOT_STARTED",
          role: lease.role as any,
          currentStep: 1,
          version: 0,
        },
        update: {
          state: "NOT_STARTED",
          role: lease.role as any,
          currentStep: 1,
          completedAt: null,
          lastErrorCode: null,
          version: 0,
        },
      });

      // 4. Delete existing onboarding transitions
      await tx.onboardingTransition.deleteMany({
        where: { userId: lease.userId },
      });

      let docsDeletedCount = 0;
      let licensesDeletedCount = 0;
      let casesDeletedCount = 0;

      // 5. Professional-specific cleanup
      if (lease.role === "PROFESSIONAL") {
        await tx.professionalProfile.updateMany({
          where: { userId: lease.userId },
          data: {
            verified: false,
            verificationStatus: "PENDING",
            trustTier: "UNVERIFIED",
            verifiedAt: null,
            verifiedById: null,
            verificationNotes: null,
          },
        });

        const docs = await tx.professionalDocument.deleteMany({
          where: { professionalId: lease.userId },
        });
        docsDeletedCount = docs.count;

        const licenses = await tx.professionalLicense.deleteMany({
          where: { professionalId: lease.userId },
        });
        licensesDeletedCount = licenses.count;

        const cases = await tx.regulatorVerificationCase.deleteMany({
          where: { professionalId: lease.userId },
        });
        casesDeletedCount = cases.count;
      }

      // 6. Delete test notifications for this user
      const notifs = await tx.notification.deleteMany({
        where: {
          userId: lease.userId,
          createdAt: { gte: lease.createdAt },
        },
      });

      // 7. Transition lease to READY with resetAt
      await tx.stagingTestIdentityLease.update({
        where: { id: lease.id },
        data: {
          state: "READY",
          resetAt: now,
        },
      });

      return {
        leaseId: lease.id,
        runId: input.runId,
        slot: lease.slot,
        userId: lease.userId,
        role: lease.role as any,
        userStatus: "ONBOARDING",
        onboardingState: "NOT_STARTED",
        documentsDeletedCount: docsDeletedCount,
        licensesDeletedCount: licensesDeletedCount,
        verificationCasesDeletedCount: casesDeletedCount,
        notificationsDeletedCount: notifs.count,
        resetAt: now,
      };
    });
  }

  /**
   * Releases any active identity lease owned by the run.
   * Idempotent: safe to call repeatedly.
   */
  async releaseIdentityLease(runId: string, now = new Date()): Promise<void> {
    await prisma.stagingTestIdentityLease.updateMany({
      where: {
        stagingTestRunId: runId,
        state: { in: ["LEASED", "RESETTING", "READY", "FAILED"] },
      },
      data: {
        state: "RELEASED",
        releasedAt: now,
      },
    });
  }
}

export const identityRepository = new IdentityRepository();
