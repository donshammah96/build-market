import { beforeEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { Job } from "bullmq";

// Mock bullmq to prevent Worker/Queue instantiation from connecting to Redis
vi.mock("bullmq", () => {
  return {
    Queue: class MockQueue {
      add = vi.fn().mockResolvedValue({ id: "mock-job-id" });
      on = vi.fn();
      close = vi.fn().mockResolvedValue(undefined);
    },
    Worker: class MockWorker {
      on = vi.fn();
      close = vi.fn().mockResolvedValue(undefined);
    },
  };
});

// Set environment variable immediately
process.env.REDIS_URL = "redis://localhost:6379";

// ---------------------------------------------------------------------------
// Hoisted mock factories
// ---------------------------------------------------------------------------

const {
  mockFindById,
  mockUpdateConfirmationEmailSuccess,
  mockUpdateConfirmationEmailFailure,
  mockUpdateEspSyncSuccess,
  mockUpdateEspSyncFailure,
  mockSyncSubscriberToEsp,
  mockGetConfiguredEspProvider,
} = vi.hoisted(() => ({
  mockFindById: vi.fn(),
  mockUpdateConfirmationEmailSuccess: vi.fn(),
  mockUpdateConfirmationEmailFailure: vi.fn(),
  mockUpdateEspSyncSuccess: vi.fn(),
  mockUpdateEspSyncFailure: vi.fn(),
  mockSyncSubscriberToEsp: vi.fn(),
  mockGetConfiguredEspProvider: vi.fn().mockReturnValue("resend"),
}));

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock("@/app/lib/domains/newsletter/repository", () => ({
  newsletterRepository: {
    findById: mockFindById,
    updateConfirmationEmailSuccess: mockUpdateConfirmationEmailSuccess,
    updateConfirmationEmailFailure: mockUpdateConfirmationEmailFailure,
    updateEspSyncSuccess: mockUpdateEspSyncSuccess,
    updateEspSyncFailure: mockUpdateEspSyncFailure,
  },
}));

vi.mock("@/app/lib/domains/newsletter/esp-sync", () => ({
  syncSubscriberToEsp: mockSyncSubscriberToEsp,
}));

vi.mock("@/app/lib/domains/newsletter/esp-provider", () => ({
  getConfiguredEspProvider: mockGetConfiguredEspProvider,
}));

vi.mock("@/app/lib/infrastructure/env", () => ({
  envConfig: {
    newsletter: {
      resendApiKey: "test-api-key",
      provider: "resend",
    },
    appUrl: "http://localhost:3500",
  },
}));

vi.mock("@/app/lib/api/resilient-api", () => ({
  getClientLogger: vi.fn().mockReturnValue({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

// ---------------------------------------------------------------------------
// SUT placeholders (loaded dynamically to prevent ESM hoisting issues)
// ---------------------------------------------------------------------------

let processConfirmationEmailJob: any;
let processEspSyncJob: any;

beforeAll(async () => {
  const emailWorkerMod =
    await import("@/app/workers/newsletter/confirmation-email.worker");
  const espWorkerMod = await import("@/app/workers/newsletter/esp-sync.worker");
  processConfirmationEmailJob = emailWorkerMod.processConfirmationEmailJob;
  processEspSyncJob = espWorkerMod.processEspSyncJob;
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Newsletter Confirmation Email Worker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(""),
    } as any);
  });

  it("updates confirmation email status to SENT in the database on success", async () => {
    const job = {
      id: "job-1",
      data: {
        subscriberId: "sub-123",
        email: "user@example.com",
        confirmationToken: "token123",
        unsubscribeToken: "unsub123",
      },
    } as unknown as Job;

    await processConfirmationEmailJob(job);

    expect(global.fetch).toHaveBeenCalled();
    expect(mockUpdateConfirmationEmailSuccess).toHaveBeenCalledWith("sub-123");
  });

  it("updates confirmation email status to FAILED in the database when resend request fails", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      text: () => Promise.resolve("Invalid API key"),
    } as any);

    const job = {
      id: "job-1",
      data: {
        subscriberId: "sub-123",
        email: "user@example.com",
        confirmationToken: "token123",
        unsubscribeToken: "unsub123",
      },
    } as unknown as Job;

    await expect(processConfirmationEmailJob(job)).rejects.toThrow();
    expect(mockUpdateConfirmationEmailFailure).toHaveBeenCalledWith(
      "sub-123",
      expect.stringContaining("Resend email send failed"),
    );
  });
});

describe("Newsletter ESP Sync Worker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("updates ESP sync status to SYNCED in the database on successful sync", async () => {
    mockFindById.mockResolvedValue({
      id: "sub-123",
      email: "user@example.com",
      status: "SUBSCRIBED",
      espSyncAttempts: 0,
    });
    mockSyncSubscriberToEsp.mockResolvedValue({
      ok: true,
      data: { espContactId: "contact-123" },
    });

    const job = {
      id: "job-2",
      data: {
        subscriberId: "sub-123",
        action: "subscribe",
      },
    } as unknown as Job;

    await processEspSyncJob(job);

    expect(mockUpdateEspSyncSuccess).toHaveBeenCalledWith(
      "sub-123",
      "resend",
      "contact-123",
    );
  });

  it("updates ESP sync status to FAILED in the database and throws on sync error", async () => {
    mockFindById.mockResolvedValue({
      id: "sub-123",
      email: "user@example.com",
      status: "SUBSCRIBED",
      espSyncAttempts: 0,
    });
    mockSyncSubscriberToEsp.mockResolvedValue({
      ok: false,
      error: "provider_error",
      message: "Rate limit exceeded",
    });

    const job = {
      id: "job-2",
      data: {
        subscriberId: "sub-123",
        action: "subscribe",
      },
    } as unknown as Job;

    await expect(processEspSyncJob(job)).rejects.toThrow();
    expect(mockUpdateEspSyncFailure).toHaveBeenCalledWith(
      "sub-123",
      "provider_error: Rate limit exceeded",
      expect.any(Date),
      "FAILED",
    );
  });

  it("marks as DEAD_LETTER when sync attempts are exhausted", async () => {
    mockFindById.mockResolvedValue({
      id: "sub-123",
      email: "user@example.com",
      status: "SUBSCRIBED",
      espSyncAttempts: 4, // 5th attempt
    });
    mockSyncSubscriberToEsp.mockResolvedValue({
      ok: false,
      error: "provider_error",
      message: "Unrecoverable error",
    });

    const job = {
      id: "job-2",
      data: {
        subscriberId: "sub-123",
        action: "subscribe",
      },
    } as unknown as Job;

    await expect(processEspSyncJob(job)).rejects.toThrow();
    expect(mockUpdateEspSyncFailure).toHaveBeenCalledWith(
      "sub-123",
      "provider_error: Unrecoverable error",
      null, // No next retry time
      "DEAD_LETTER",
    );
  });
});
