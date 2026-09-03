import { describe, expect, it, vi } from "vitest";
import {
  checkSimulatedFailure,
  hashRecipient,
  interceptOutboundDelivery,
  redactMetadata,
} from "../staging-test-control.js";
import { prisma } from "@build/db";

vi.mock("@build/db", () => ({
  prisma: {
    stagingTestOutboundDelivery: {
      create: vi.fn().mockResolvedValue({ id: "delivery_mock_123" }),
    },
    stagingTestRun: {
      findUnique: vi.fn().mockResolvedValue({
        state: "ACTIVE",
        expiresAt: new Date(Date.now() + 60_000),
      }),
    },
  },
}));

describe("Staging Test Control Interceptor", () => {
  const stagingEnv = {
    DD_ENV: "staging",
    NODE_ENV: "test",
  } as any;

  const prodEnv = {
    DD_ENV: "production",
    NODE_ENV: "production",
  } as any;

  describe("Recipient Hashing and Redaction", () => {
    it("produces deterministic, non-reversible SHA-256 hashes of recipients", () => {
      const hash1 = hashRecipient("user@example.com");
      const hash2 = hashRecipient("USER@example.COM");
      const hash3 = hashRecipient("other@example.com");

      expect(hash1).toBe(hash2);
      expect(hash1).not.toBe("user@example.com");
      expect(hash1).not.toBe(hash3);
      expect(hash1).toHaveLength(64); // 256-bit hex
    });

    it("redacts sensitive fields in delivery metadata", () => {
      const metadata = {
        recipientPhone: "+254712345678",
        recipientEmail: "test@example.com",
        customerToken: "secret_1234",
        safeNote: "Notice of status change",
      };

      const redacted = redactMetadata(metadata);
      expect(redacted.recipientPhone).toBe("[REDACTED]");
      expect(redacted.recipientEmail).toBe("[REDACTED]");
      expect(redacted.customerToken).toBe("[REDACTED]");
      expect(redacted.safeNote).toBe("Notice of status change");
    });
  });

  describe("Outbound Delivery Interception", () => {
    it("intercepts outbound delivery and logs to test sink in staging environment", async () => {
      const result = await interceptOutboundDelivery(
        {
          stagingTestRunId: "run-uuid-1",
          channel: "SMS",
          recipient: "+254700000001",
          metadata: { phone: "+254700000001", message: "Verification successful" },
        },
        stagingEnv,
      );

      expect(result.intercepted).toBe(true);
      expect(result.deliveryId).toBe("delivery_mock_123");
      expect(prisma.stagingTestOutboundDelivery.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          stagingTestRunId: "run-uuid-1",
          channel: "SMS",
          recipientHash: expect.any(String),
          redactedMetadata: expect.objectContaining({
            phone: "[REDACTED]",
            message: "Verification successful",
          }),
        }),
      });
    });

    it("bypasses interceptor in production environment even if test metadata is present", async () => {
      const result = await interceptOutboundDelivery(
        {
          stagingTestRunId: "run-uuid-1",
          channel: "EMAIL",
          recipient: "user@example.com",
        },
        prodEnv,
      );

      expect(result.intercepted).toBe(false);
    });

    it("does not divert traffic for an expired or inactive run", async () => {
      vi.mocked(prisma.stagingTestRun.findUnique).mockResolvedValueOnce({
        state: "EXPIRED",
        expiresAt: new Date(Date.now() - 1),
      } as any);

      await expect(
        interceptOutboundDelivery(
          {
            stagingTestRunId: "run-expired",
            channel: "EMAIL",
            recipient: "test@example.com",
          },
          stagingEnv,
        ),
      ).resolves.toEqual({ intercepted: false });
    });
  });

  describe("Failure Simulation", () => {
    it("throws simulated errors in staging when explicitly requested", () => {
      expect(() =>
        checkSimulatedFailure(
          { stagingTestRunId: "run-1", simulateFailure: "CRASH" },
          stagingEnv,
        ),
      ).toThrow(/\[SimulatedFailure:CRASH\]/);

      expect(() =>
        checkSimulatedFailure(
          { stagingTestRunId: "run-1", simulateFailure: "TIMEOUT" },
          stagingEnv,
        ),
      ).toThrow(/\[SimulatedFailure:TIMEOUT\]/);

      expect(() =>
        checkSimulatedFailure(
          { stagingTestRunId: "run-1", simulateFailure: "TRANSIENT_ERROR" },
          stagingEnv,
        ),
      ).toThrow(/\[SimulatedFailure:TRANSIENT_ERROR\]/);
    });

    it("never throws simulated errors in production environment", () => {
      expect(() =>
        checkSimulatedFailure(
          { stagingTestRunId: "run-1", simulateFailure: "CRASH" },
          prodEnv,
        ),
      ).not.toThrow();
    });

    it("limits a transient fault to the declared initial attempts", () => {
      expect(() =>
        checkSimulatedFailure(
          { stagingTestRunId: "run-1", simulateFailure: "TRANSIENT_ERROR", failAttempts: 1 },
          stagingEnv,
          0,
        ),
      ).toThrow(/TRANSIENT_ERROR/);
      expect(() =>
        checkSimulatedFailure(
          { stagingTestRunId: "run-1", simulateFailure: "TRANSIENT_ERROR", failAttempts: 1 },
          stagingEnv,
          1,
        ),
      ).not.toThrow();
    });
  });
});
