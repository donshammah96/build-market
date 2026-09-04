import { prisma } from "@build/db";
import { addNotificationRetryJob } from "@build/queue-server";
import {
  assertStagingCleanupOrder,
  STAGING_CLEANUP_DEPENDENCY_ORDER,
  type StagingScenario,
} from "@build/db/staging-test-runs";

export interface CreateRunParams {
  scenario: StagingScenario;
  actorLabel: string;
  gitSha?: string;
  workflowRunId?: string;
  lifetimeSeconds?: number;
}

export class TestControlRepository {
  async createRun(params: CreateRunParams) {
    const now = new Date();
    const expiresAt = new Date(
      now.getTime() + (params.lifetimeSeconds ?? 300) * 1000,
    );

    return prisma.stagingTestRun.create({
      data: {
        scenario: params.scenario,
        actorLabel: params.actorLabel,
        gitSha: params.gitSha ?? "staging-e2e",
        workflowRunId: params.workflowRunId,
        state: "ACTIVE",
        createdAt: now,
        expiresAt,
      },
    });
  }

  async findRunById(runId: string) {
    return prisma.stagingTestRun.findUnique({
      where: { id: runId },
    });
  }

  async seedPendingMpesaTransaction(params: {
    runId: string;
    amount: number;
    phoneNumber: string;
    checkoutRequestId?: string;
    merchantRequestId?: string;
  }) {
    const checkoutRequestId =
      params.checkoutRequestId ??
      `ws_CO_${Date.now()}_${params.runId.slice(0, 8)}`;
    const merchantRequestId =
      params.merchantRequestId ??
      `mr_${Date.now()}_${params.runId.slice(0, 8)}`;

    return prisma.mpesaTransaction.create({
      data: {
        stagingTestRunId: params.runId,
        checkoutRequestId,
        merchantRequestId,
        idempotencyKey: `idemp_${checkoutRequestId}`,
        userId: `e2e_user_${params.runId.slice(0, 8)}`,
        transactionType: "CUSTOMER_PAY_BILL_ONLINE",
        amount: params.amount,
        phoneNumber: params.phoneNumber,
        status: "PENDING",
      },
    });
  }

  /**
   * Creates only data that is either owned by the run or references the
   * pre-provisioned, immutable staging identities. The identities themselves
   * are deliberately never claimed by a run, so cleanup cannot delete them.
   */
  async seedScenario(params: {
    runId: string;
    scenario: StagingScenario;
    payload: Record<string, unknown>;
  }): Promise<Record<string, string>> {
    const [client, professional] = await Promise.all([
      prisma.user.findFirst({
        where: {
          email: "e2e_client_1@staging.buildmarket.app",
          role: "CLIENT",
        },
        select: { id: true },
      }),
      prisma.user.findFirst({
        where: {
          email: "e2e_pro_1@staging.buildmarket.app",
          role: "PROFESSIONAL",
        },
        select: { id: true, professionalProfile: { select: { userId: true } } },
      }),
    ]);

    if (!client || !professional?.professionalProfile) {
      throw new Error(
        "STAGING_TEST_IDENTITY_MISSING: provision e2e_client_1 and e2e_pro_1 before running staging E2E",
      );
    }

    switch (params.scenario) {
      case "lead-routing": {
        const existing = await prisma.marketplaceLead.findFirst({
          where: { stagingTestRunId: params.runId },
          include: { routingEvents: { select: { id: true } } },
        });
        if (existing?.routingEvents[0]) {
          return {
            marketplaceLeadId: existing.id,
            routingEventId: existing.routingEvents[0].id,
          };
        }
        const lead = await prisma.marketplaceLead.create({
          data: {
            clientId: client.id,
            stagingTestRunId: params.runId,
            status: "ROUTED",
            projectCounty: "Nairobi",
            projectType: "RESIDENTIAL",
            title: `E2E routing ${params.runId}`,
            description: "Run-owned staging routing fixture",
            qualification: {
              create: { confidenceLabel: "high", confidenceScore: 0.95 },
            },
            routingEvents: {
              create: {
                professionalId: professional.professionalProfile.userId,
                matchScore: 0.95,
                confidenceLabel: "high",
              },
            },
          },
          include: { routingEvents: { select: { id: true } } },
        });
        return {
          marketplaceLeadId: lead.id,
          routingEventId: lead.routingEvents[0]!.id,
        };
      }
      case "messaging": {
        const existing = await prisma.messageThread.findFirst({
          where: { stagingTestRunId: params.runId },
          select: { id: true },
        });
        if (existing) return { threadId: existing.id };
        const thread = await prisma.messageThread.create({
          data: {
            type: "DIRECT",
            subject: `E2E messaging ${params.runId}`,
            stagingTestRunId: params.runId,
            participants: {
              create: [
                { userId: client.id, role: "OWNER" },
                { userId: professional.id, role: "MEMBER" },
              ],
            },
          },
        });
        return { threadId: thread.id };
      }
      case "review-eligibility": {
        const existing = await prisma.project.findFirst({
          where: { stagingTestRunId: params.runId },
          select: { id: true, clientId: true, professionalId: true },
        });
        if (existing?.professionalId) {
          return {
            projectId: existing.id,
            clientId: existing.clientId,
            professionalId: existing.professionalId,
          };
        }
        const project = await prisma.project.create({
          data: {
            clientId: client.id,
            professionalId: professional.professionalProfile.userId,
            stagingTestRunId: params.runId,
            title: `E2E completed project ${params.runId}`,
            description: "Run-owned review eligibility fixture",
            status: "COMPLETED",
            actualCompletionDate: new Date(),
          },
        });
        return {
          projectId: project.id,
          clientId: client.id,
          professionalId: professional.id,
        };
      }
      case "onboarding":
      case "verification":
      case "mpesa-replay":
      case "capability-rollback":
        return { clientId: client.id, professionalId: professional.id };
      case "queue-recovery": {
        const job = await addNotificationRetryJob(
          {
            recipientUserId: client.id,
            result: {
              entityId: `staging-queue-${params.runId}`,
              entityType: "STAGING_TEST",
              decision: "RECOVERED",
              metadata: { stagingTestRunId: params.runId },
            },
            testControl: {
              stagingTestRunId: params.runId,
              scenario: "queue-recovery",
              simulateFailure: "TRANSIENT_ERROR",
              failAttempts: 1,
            },
          } as any,
          { attempts: 2, backoff: { type: "fixed", delay: 1_000 } },
        );
        return { queueJobId: String(job.id) };
      }
    }
  }

  async getRunProjection(runId: string) {
    const [
      run,
      users,
      profiles,
      leads,
      projects,
      reviews,
      mpesaTransactions,
      mpesaCallbackEvents,
      outboundDeliveries,
      marketplaceLeads,
      messageThreads,
      identityLeases,
    ] = await Promise.all([
      prisma.stagingTestRun.findUnique({ where: { id: runId } }),
      prisma.user.findMany({
        where: { stagingTestRunId: runId },
        select: { id: true, email: true, role: true, status: true },
      }),
      prisma.professionalProfile.findMany({
        where: { stagingTestRunId: runId },
        select: { userId: true, companyName: true, profession: true },
      }),
      prisma.lead.findMany({
        where: { stagingTestRunId: runId },
        select: { id: true, status: true, title: true },
      }),
      prisma.project.findMany({
        where: { stagingTestRunId: runId },
        select: { id: true, status: true, title: true },
      }),
      prisma.review.findMany({
        where: { stagingTestRunId: runId },
        select: { id: true, rating: true, status: true },
      }),
      prisma.mpesaTransaction.findMany({
        where: { stagingTestRunId: runId },
        select: { id: true, status: true, checkoutRequestId: true },
      }),
      prisma.mpesaCallbackEvent.findMany({
        where: { stagingTestRunId: runId },
        select: { id: true, providerEventKey: true, processingStatus: true },
      }),
      prisma.stagingTestOutboundDelivery.findMany({
        where: { stagingTestRunId: runId },
        select: {
          id: true,
          channel: true,
          recipientHash: true,
          createdAt: true,
        },
      }),
      prisma.marketplaceLead.findMany({
        where: { stagingTestRunId: runId },
        select: {
          id: true,
          status: true,
          routingEvents: { select: { id: true, contactDisclosedAt: true } },
        },
      }),
      prisma.messageThread.findMany({
        where: { stagingTestRunId: runId },
        select: {
          id: true,
          lastMessage: true,
          messages: { select: { id: true, content: true } },
        },
      }),
      prisma.stagingTestIdentityLease.findMany({
        where: { stagingTestRunId: runId },
        select: {
          id: true,
          slot: true,
          role: true,
          state: true,
          leaseExpiresAt: true,
          resetAt: true,
          releasedAt: true,
        },
      }),
    ]);

    return {
      run,
      fixtures: {
        users,
        profiles,
        leads,
        projects,
        reviews,
        mpesaTransactions,
        mpesaCallbackEvents,
        outboundDeliveries,
        marketplaceLeads,
        messageThreads,
        identityLeases,
      },
    };
  }

  async cleanupRun(runId: string) {
    // Assert canonical dependency order before executing queries
    assertStagingCleanupOrder([...STAGING_CLEANUP_DEPENDENCY_ORDER]);

    return prisma.$transaction(async (tx) => {
      // 1. Transition state to CLEANING
      await tx.stagingTestRun.update({
        where: { id: runId },
        data: { state: "CLEANING" },
      });

      // 2. Release active identity leases before marking CLEANED (retained for audit evidence)
      await tx.stagingTestIdentityLease.updateMany({
        where: { stagingTestRunId: runId, state: { not: "RELEASED" } },
        data: { state: "RELEASED", releasedAt: new Date() },
      });

      // 3. Delete owned outbound deliveries
      await tx.messageThread.deleteMany({ where: { stagingTestRunId: runId } });
      await tx.marketplaceLead.deleteMany({
        where: { stagingTestRunId: runId },
      });
      await tx.stagingTestOutboundDelivery.deleteMany({
        where: { stagingTestRunId: runId },
      });

      // 3. Delete owned M-Pesa callback events & transactions
      await tx.mpesaCallbackEvent.deleteMany({
        where: { stagingTestRunId: runId },
      });
      await tx.mpesaTransaction.deleteMany({
        where: { stagingTestRunId: runId },
      });

      // 4. Delete owned reviews
      await tx.review.deleteMany({
        where: { stagingTestRunId: runId },
      });

      // 5. Delete owned leads
      await tx.lead.deleteMany({
        where: { stagingTestRunId: runId },
      });

      // 6. Delete owned projects
      await tx.project.deleteMany({
        where: { stagingTestRunId: runId },
      });

      // 7. Delete owned professional profiles
      await tx.professionalProfile.deleteMany({
        where: { stagingTestRunId: runId },
      });

      // 8. Delete owned users
      await tx.user.deleteMany({
        where: { stagingTestRunId: runId },
      });

      // 9. Verify zero owned records remain
      const [remainingUsers, remainingLeads, remainingTxs] = await Promise.all([
        tx.user.count({ where: { stagingTestRunId: runId } }),
        tx.lead.count({ where: { stagingTestRunId: runId } }),
        tx.mpesaTransaction.count({ where: { stagingTestRunId: runId } }),
      ]);

      if (remainingUsers > 0 || remainingLeads > 0 || remainingTxs > 0) {
        throw new Error(
          `[StagingCleanupFailure] Owned records still remain for run ${runId}`,
        );
      }

      // 10. Mark CLEANED
      return tx.stagingTestRun.update({
        where: { id: runId },
        data: {
          state: "CLEANED",
          cleanedAt: new Date(),
        },
      });
    });
  }
}

export const testControlRepository = new TestControlRepository();

export * from "./identity-repository.js";
