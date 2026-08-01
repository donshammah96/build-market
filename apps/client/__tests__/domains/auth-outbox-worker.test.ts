import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  enqueueClerkMetadataSyncEvent,
  processPendingAuthOutboxEvents,
} from "@/app/lib/domains/user-profile/outbox-worker";
import { updateClerkOnboardingMetadata } from "@/app/lib/domains/user-profile/clerk-metadata";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({
  authOutboxEventCreate: vi.fn(),
  authOutboxEventFindMany: vi.fn(),
  authOutboxEventUpdate: vi.fn(),
  updateClerkOnboardingMetadata: vi.fn(),
}));

vi.mock("@build/db", () => ({
  prisma: {
    authOutboxEvent: {
      create: mocks.authOutboxEventCreate,
      findMany: mocks.authOutboxEventFindMany,
      update: mocks.authOutboxEventUpdate,
    },
  },
}));

vi.mock("@/app/lib/domains/user-profile/clerk-metadata", () => ({
  updateClerkOnboardingMetadata: mocks.updateClerkOnboardingMetadata,
}));

describe("Auth Outbox Worker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("enqueues a pending Clerk metadata sync outbox event", async () => {
    mocks.authOutboxEventCreate.mockResolvedValue({ id: "outbox_event_123" });

    const result = await enqueueClerkMetadataSyncEvent({
      userId: "user_db_123",
      clerkId: "clerk_123",
      role: "CLIENT",
      status: "ACTIVE",
      correlationId: "corr_123",
    });

    expect(result.id).toBe("outbox_event_123");
    expect(mocks.authOutboxEventCreate).toHaveBeenCalledWith({
      data: {
        aggregateType: "User",
        aggregateId: "user_db_123",
        eventType: "CLERK_ONBOARDING_METADATA_SYNC_REQUESTED",
        payload: {
          clerkId: "clerk_123",
          role: "CLIENT",
          isOnboarded: true,
          status: "ACTIVE",
          correlationId: "corr_123",
        },
        status: "PENDING",
      },
      select: { id: true },
    });
  });

  it("processes pending outbox events and marks them COMPLETED on success", async () => {
    const pendingEvent = {
      id: "evt_1",
      attempts: 0,
      payload: {
        clerkId: "clerk_123",
        role: "CLIENT",
        isOnboarded: true,
        status: "ACTIVE",
        correlationId: "corr_123",
      },
      createdAt: new Date(),
    };

    mocks.authOutboxEventFindMany.mockResolvedValue([pendingEvent]);
    mocks.updateClerkOnboardingMetadata.mockResolvedValue(undefined);
    mocks.authOutboxEventUpdate.mockResolvedValue({});

    const summary = await processPendingAuthOutboxEvents({ batchSize: 5 });

    expect(summary.processed).toBe(1);
    expect(summary.succeeded).toBe(1);
    expect(summary.failed).toBe(0);

    expect(mocks.updateClerkOnboardingMetadata).toHaveBeenCalledWith(
      "clerk_123",
      {
        role: "CLIENT",
        isOnboarded: true,
        status: "ACTIVE",
      },
      {
        correlationId: "corr_123",
        operation: "auth_outbox_clerk_metadata_sync",
      },
    );

    expect(mocks.authOutboxEventUpdate).toHaveBeenCalledWith({
      where: { id: "evt_1" },
      data: {
        status: "COMPLETED",
        attempts: 1,
      },
    });
  });

  it("schedules exponential backoff on transient failure and marks FAILED on max attempts", async () => {
    const failingEvent = {
      id: "evt_retry",
      attempts: 4, // 5th attempt will fail
      payload: {
        clerkId: "clerk_123",
        role: "CLIENT",
        isOnboarded: true,
      },
      createdAt: new Date(),
      nextAttemptAt: new Date(),
    };

    mocks.authOutboxEventFindMany.mockResolvedValue([failingEvent]);
    mocks.updateClerkOnboardingMetadata.mockRejectedValue(
      new Error("Clerk API rate limit"),
    );
    mocks.authOutboxEventUpdate.mockResolvedValue({});

    const summary = await processPendingAuthOutboxEvents({ batchSize: 5 });

    expect(summary.processed).toBe(1);
    expect(summary.succeeded).toBe(0);
    expect(summary.failed).toBe(1);

    expect(mocks.authOutboxEventUpdate).toHaveBeenCalledWith({
      where: { id: "evt_retry" },
      data: {
        status: "FAILED",
        attempts: 5,
        nextAttemptAt: failingEvent.nextAttemptAt,
      },
    });
  });
});
