import { describe, expect, it, vi, beforeEach } from "vitest";

const getJob = vi.fn();
const add = vi.fn();
const upsert = vi.fn().mockResolvedValue({});

vi.mock("@build/redis/tcp", () => ({
  createRedisConnection: vi
    .fn()
    .mockReturnValue({ host: "localhost", port: 6379 }),
}));

vi.mock("bullmq", () => ({
  Queue: vi.fn().mockImplementation(function QueueMock(this: any) {
    this.getJob = getJob;
    this.add = add;
    return this;
  }),
}));

vi.mock("@build/db", () => ({
  prisma: { regulatorVerificationCase: { upsert } },
}));

vi.mock("@/app/lib/infrastructure/env", () => ({
  envConfig: {
    redis: { url: "redis://localhost:6379" },
    jobs: { disableBackgroundJobs: false },
  },
  env: { isBuildPhase: false },
}));

vi.mock("@/app/lib/api/resilient-api", () => ({
  getClientLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

vi.mock("@/app/lib/domains/regulator-verification/evidence-store", () => ({
  dedupeKeyFor: (request: any) =>
    `${request.authority}:${request.licenseNumber}:${request.professionalId}`,
}));

const { enqueueLicenseVerification } =
  await import("@/app/lib/domains/regulator-verification/queue");

describe("enqueueLicenseVerification", () => {
  beforeEach(() => {
    getJob.mockReset();
    add.mockReset();
    upsert.mockClear();
  });

  const request = {
    professionalId: "pro_1",
    licenseId: "lic_1",
    authority: "NCA" as const,
    licenseNumber: "NCA-123",
    correlationId: "corr_1",
  };

  it("enqueues a new job keyed by the dedupe key", async () => {
    getJob.mockResolvedValue(null);
    const result = await enqueueLicenseVerification(request);

    expect(result.alreadyQueued).toBe(false);
    expect(add).toHaveBeenCalledWith(
      "verify-license",
      request,
      expect.objectContaining({ jobId: "NCA:NCA-123:pro_1" }),
    );
    expect(upsert).toHaveBeenCalledOnce();
  });

  it("skips re-adding a job that is already queued", async () => {
    getJob.mockResolvedValue({ id: "NCA:NCA-123:pro_1" });
    const result = await enqueueLicenseVerification(request);

    expect(result.alreadyQueued).toBe(true);
    expect(add).not.toHaveBeenCalled();
  });
});
