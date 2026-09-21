import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Hoisted mock factories
// ---------------------------------------------------------------------------

const {
  mockNewsletterRepository,
  mockNewsletterEspSyncQueue,
  mockNewsletterEmailQueue,
} = vi.hoisted(() => ({
  mockNewsletterRepository: {
    findByEmail: vi.fn(),
    findById: vi.fn(),
    findByConfirmationTokenHash: vi.fn(),
    findByUnsubscribeTokenHash: vi.fn(),
    findUserIdByEmail: vi.fn(),
    createPendingSubscriber: vi.fn(),
    resetForResubscribe: vi.fn(),
    markConfirmed: vi.fn(),
    markUnsubscribed: vi.fn(),
    markSuppressed: vi.fn(),
    updateEspSyncSuccess: vi.fn(),
    updateEspSyncFailure: vi.fn(),
    findDueForEspSync: vi.fn(),
  },
  mockNewsletterEspSyncQueue: {
    add: vi.fn(),
  },
  mockNewsletterEmailQueue: {
    add: vi.fn(),
  },
}));

// ---------------------------------------------------------------------------
// Module Mocks
// ---------------------------------------------------------------------------

vi.mock("@/app/lib/domains/newsletter/repository", () => ({
  newsletterRepository: mockNewsletterRepository,
}));

vi.mock("@/app/lib/queues/newsletter.queue", () => ({
  newsletterEspSyncQueue: mockNewsletterEspSyncQueue,
  newsletterEmailQueue: mockNewsletterEmailQueue,
}));

// ---------------------------------------------------------------------------
// SUT Imports
// ---------------------------------------------------------------------------

import {
  subscribe,
  confirmSubscription,
  unsubscribe,
} from "@/app/lib/domains/newsletter/service";

describe("newsletterService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("subscribe", () => {
    it("creates a new pending subscriber and enqueues a confirmation email", async () => {
      mockNewsletterRepository.findByEmail.mockResolvedValue(null);
      mockNewsletterRepository.findUserIdByEmail.mockResolvedValue(null);
      mockNewsletterRepository.createPendingSubscriber.mockResolvedValue({
        id: "sub-123",
        email: "user@example.com",
      });

      const result = await subscribe({
        email: "user@example.com",
        ipAddress: "127.0.0.1",
        userAgent: "test-agent",
        source: "footer",
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.status).toBe("pending_confirmation");
      }
      expect(
        mockNewsletterRepository.createPendingSubscriber,
      ).toHaveBeenCalled();
      expect(mockNewsletterEmailQueue.add).toHaveBeenCalledWith(
        "send-confirmation",
        expect.objectContaining({
          subscriberId: "sub-123",
          email: "user@example.com",
          confirmationToken: expect.any(String),
          unsubscribeToken: expect.any(String),
        }),
      );
    });

    it("returns already_subscribed for an already confirmed subscriber", async () => {
      mockNewsletterRepository.findByEmail.mockResolvedValue({
        id: "sub-123",
        status: "SUBSCRIBED",
      });

      const result = await subscribe({
        email: "already@example.com",
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.status).toBe("already_subscribed");
      }
      expect(
        mockNewsletterRepository.createPendingSubscriber,
      ).not.toHaveBeenCalled();
      expect(mockNewsletterEmailQueue.add).not.toHaveBeenCalled();
    });

    it("fails when attempting to subscribe a suppressed (bounced/complained) address", async () => {
      mockNewsletterRepository.findByEmail.mockResolvedValue({
        id: "sub-123",
        status: "BOUNCED",
      });

      const result = await subscribe({
        email: "bounced@example.com",
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe("suppressed");
      }
    });

    it("triggers resubscription and resets state if the cooldown has elapsed", async () => {
      // Last update was 10 minutes ago (more than 5 min cooldown)
      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
      mockNewsletterRepository.findByEmail.mockResolvedValue({
        id: "sub-123",
        email: "resub@example.com",
        status: "UNSUBSCRIBED",
        lastConfirmationSentAt: tenMinutesAgo,
      });
      mockNewsletterRepository.resetForResubscribe.mockResolvedValue({
        id: "sub-123",
        email: "resub@example.com",
      });

      const result = await subscribe({
        email: "resub@example.com",
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.status).toBe("resubscribe_pending");
      }
      expect(mockNewsletterRepository.resetForResubscribe).toHaveBeenCalled();
      expect(mockNewsletterEmailQueue.add).toHaveBeenCalled();
    });

    it("rejects resubscription attempts during the cooldown window", async () => {
      // Last update was 1 minute ago (inside 5 min cooldown)
      const oneMinuteAgo = new Date(Date.now() - 1 * 60 * 1000);
      mockNewsletterRepository.findByEmail.mockResolvedValue({
        id: "sub-123",
        email: "resub@example.com",
        status: "UNSUBSCRIBED",
        lastConfirmationSentAt: oneMinuteAgo,
      });

      const result = await subscribe({
        email: "resub@example.com",
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe("resubscribe_cooldown");
      }
      expect(
        mockNewsletterRepository.resetForResubscribe,
      ).not.toHaveBeenCalled();
    });
  });

  describe("confirmSubscription", () => {
    it("marks subscriber as SUBSCRIBED and enqueues the ESP sync job on success", async () => {
      mockNewsletterRepository.findByConfirmationTokenHash.mockResolvedValue({
        id: "sub-123",
        status: "PENDING_CONFIRMATION",
        confirmationTokenExpiresAt: new Date(Date.now() + 3600_000), // active
      });
      mockNewsletterRepository.markConfirmed.mockResolvedValue({
        id: "sub-123",
        status: "SUBSCRIBED",
      });

      const result = await confirmSubscription({
        token: "token-abc123xyz789",
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.status).toBe("SUBSCRIBED");
      }
      expect(mockNewsletterRepository.markConfirmed).toHaveBeenCalledWith(
        "sub-123",
      );
      expect(mockNewsletterEspSyncQueue.add).toHaveBeenCalledWith("esp-sync", {
        subscriberId: "sub-123",
        action: "subscribe",
      });
    });

    it("fails confirmation if the token is not found", async () => {
      mockNewsletterRepository.findByConfirmationTokenHash.mockResolvedValue(
        null,
      );

      const result = await confirmSubscription({
        token: "unknown-token",
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe("invalid_token");
      }
    });

    it("fails confirmation if the token has expired", async () => {
      const oneHourAgo = new Date(Date.now() - 3600_000);
      mockNewsletterRepository.findByConfirmationTokenHash.mockResolvedValue({
        id: "sub-123",
        status: "PENDING_CONFIRMATION",
        confirmationTokenExpiresAt: oneHourAgo,
      });

      const result = await confirmSubscription({
        token: "expired-token",
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe("token_expired");
      }
    });
  });

  describe("unsubscribe", () => {
    it("marks subscriber as UNSUBSCRIBED and enqueues the ESP sync job", async () => {
      mockNewsletterRepository.findByUnsubscribeTokenHash.mockResolvedValue({
        id: "sub-123",
        status: "SUBSCRIBED",
      });

      const result = await unsubscribe({
        token: "unsub-token-123",
        reason: "too many emails",
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.status).toBe("UNSUBSCRIBED");
      }
      expect(mockNewsletterRepository.markUnsubscribed).toHaveBeenCalledWith(
        "sub-123",
        "too many emails",
      );
      expect(mockNewsletterEspSyncQueue.add).toHaveBeenCalledWith("esp-sync", {
        subscriberId: "sub-123",
        action: "unsubscribe",
      });
    });

    it("is idempotent and returns success immediately if already unsubscribed", async () => {
      mockNewsletterRepository.findByUnsubscribeTokenHash.mockResolvedValue({
        id: "sub-123",
        status: "UNSUBSCRIBED",
      });

      const result = await unsubscribe({
        token: "unsub-token-123",
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.status).toBe("UNSUBSCRIBED");
      }
      expect(mockNewsletterRepository.markUnsubscribed).not.toHaveBeenCalled();
      expect(mockNewsletterEspSyncQueue.add).not.toHaveBeenCalled();
    });

    it("fails if unsubscribe token is not found", async () => {
      mockNewsletterRepository.findByUnsubscribeTokenHash.mockResolvedValue(
        null,
      );

      const result = await unsubscribe({
        token: "invalid-unsub",
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe("invalid_token");
      }
    });
  });
});
