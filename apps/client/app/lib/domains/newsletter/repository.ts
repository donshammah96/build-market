import { prisma } from "@build/db";
import type { NewsletterEspSyncStatus } from "@prisma/client";
import { newsletterSubscriberInternalSelect } from "@/app/lib/domains/newsletter/contracts";

export const newsletterRepository = {
  async findByEmail(email: string) {
    return prisma.newsletterSubscriber.findUnique({
      where: { email },
      select: newsletterSubscriberInternalSelect,
    });
  },

  async findById(id: string) {
    return prisma.newsletterSubscriber.findUnique({
      where: { id },
      select: newsletterSubscriberInternalSelect,
    });
  },

  async findByConfirmationTokenHash(tokenHash: string) {
    return prisma.newsletterSubscriber.findUnique({
      where: { confirmationTokenHash: tokenHash },
      select: newsletterSubscriberInternalSelect,
    });
  },

  async findByUnsubscribeTokenHash(tokenHash: string) {
    return prisma.newsletterSubscriber.findUnique({
      where: { unsubscribeTokenHash: tokenHash },
      select: newsletterSubscriberInternalSelect,
    });
  },

  /** Best-effort link to an existing account; subscribing must not fail if this misses. */
  async findUserIdByEmail(email: string) {
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
    return user?.id ?? null;
  },

  async createPendingSubscriber(data: {
    email: string;
    userId: string | null;
    source: string;
    ipAddress?: string;
    userAgent?: string;
    confirmationTokenHash: string;
    confirmationTokenExpiresAt: Date;
    unsubscribeTokenHash: string;
  }) {
    return prisma.newsletterSubscriber.create({
      data: {
        email: data.email,
        userId: data.userId,
        source: data.source,
        consentIpAddress: data.ipAddress,
        consentUserAgent: data.userAgent,
        confirmationTokenHash: data.confirmationTokenHash,
        confirmationTokenExpiresAt: data.confirmationTokenExpiresAt,
        unsubscribeTokenHash: data.unsubscribeTokenHash,
        // Drives the resubscribe cooldown — see service.ts STAFF AUDIT
        // NOTES. Must be a dedicated column, never derived from
        // `updatedAt`, which other flows (ESP sync bookkeeping) also
        // bump.
        lastConfirmationSentAt: new Date(),
        confirmationEmailStatus: "PENDING",
      },
      select: newsletterSubscriberInternalSelect,
    });
  },

  /** Re-arm an UNSUBSCRIBED/BOUNCED row for a fresh double-opt-in cycle. */
  async resetForResubscribe(
    id: string,
    data: {
      confirmationTokenHash: string;
      confirmationTokenExpiresAt: Date;
      unsubscribeTokenHash: string;
      ipAddress?: string;
      userAgent?: string;
    },
  ) {
    return prisma.newsletterSubscriber.update({
      where: { id },
      data: {
        status: "PENDING_CONFIRMATION",
        confirmationTokenHash: data.confirmationTokenHash,
        confirmationTokenExpiresAt: data.confirmationTokenExpiresAt,
        unsubscribeTokenHash: data.unsubscribeTokenHash,
        unsubscribedAt: null,
        unsubscribeReason: null,
        consentIpAddress: data.ipAddress,
        consentUserAgent: data.userAgent,
        espSyncStatus: "PENDING",
        espSyncAttempts: 0,
        espLastSyncError: null,
        espNextRetryAt: null,
        lastConfirmationSentAt: new Date(),
        confirmationEmailStatus: "PENDING",
        confirmationEmailLastError: null,
      },
      select: newsletterSubscriberInternalSelect,
    });
  },

  /**
   * Intentionally does NOT null confirmationTokenHash. Doing so made
   * confirmSubscription() non-idempotent: a repeat hit on the same token
   * (email-security-gateway link prefetch, a double click, a client
   * retrying a timed-out request) would find no row and surface
   * "invalid confirmation link" to a user who, from their perspective,
   * clicked the link exactly once. service.ts now decides idempotency by
   * checking `status`, so the hash can safely stay in place — it is
   * meaningless as a replay vector since re-confirming an already-
   * SUBSCRIBED row is a deliberate no-op, not a privilege escalation.
   */
  async markConfirmed(id: string) {
    return prisma.newsletterSubscriber.update({
      where: { id },
      data: {
        status: "SUBSCRIBED",
        confirmedAt: new Date(),
        confirmationTokenExpiresAt: null,
      },
      select: newsletterSubscriberInternalSelect,
    });
  },

  async markUnsubscribed(id: string, reason: string | undefined) {
    return prisma.newsletterSubscriber.update({
      where: { id },
      data: {
        status: "UNSUBSCRIBED",
        unsubscribedAt: new Date(),
        unsubscribeReason: reason,
      },
      select: newsletterSubscriberInternalSelect,
    });
  },

  /** Called from the Resend webhook handler when the ESP reports a bounce/complaint. */
  async markSuppressed(email: string, status: "BOUNCED" | "COMPLAINED") {
    return prisma.newsletterSubscriber.updateMany({
      where: { email },
      data: { status },
    });
  },

  async updateEspSyncSuccess(
    id: string,
    espProvider: string,
    espContactId?: string,
  ) {
    return prisma.newsletterSubscriber.update({
      where: { id },
      data: {
        espProvider,
        espContactId,
        espSyncStatus: "SYNCED",
        espSyncAttempts: { increment: 1 },
        espLastSyncError: null,
        espLastSyncAt: new Date(),
        espNextRetryAt: null,
      },
      select: newsletterSubscriberInternalSelect,
    });
  },

  async updateEspSyncFailure(
    id: string,
    error: string,
    nextRetryAt: Date | null,
    finalStatus: NewsletterEspSyncStatus,
  ) {
    return prisma.newsletterSubscriber.update({
      where: { id },
      data: {
        espSyncStatus: finalStatus,
        espSyncAttempts: { increment: 1 },
        espLastSyncError: error.slice(0, 2000),
        espLastSyncAt: new Date(),
        espNextRetryAt: nextRetryAt,
      },
      select: newsletterSubscriberInternalSelect,
    });
  },

  /** Rows the BullMQ worker should pick up: never synced, or a retry is due. */
  async findDueForEspSync(limit: number) {
    return prisma.newsletterSubscriber.findMany({
      where: {
        deletedAt: null,
        status: { in: ["SUBSCRIBED", "UNSUBSCRIBED"] },
        espSyncStatus: { in: ["PENDING", "FAILED"] },
        OR: [{ espNextRetryAt: null }, { espNextRetryAt: { lte: new Date() } }],
      },
      select: newsletterSubscriberInternalSelect,
      take: limit,
      orderBy: { updatedAt: "asc" },
    });
  },

  async updateConfirmationEmailSuccess(id: string) {
    return prisma.newsletterSubscriber.update({
      where: { id },
      data: {
        confirmationEmailStatus: "SENT",
        confirmationEmailLastError: null,
      },
      select: newsletterSubscriberInternalSelect,
    });
  },

  async updateConfirmationEmailFailure(id: string, error: string) {
    return prisma.newsletterSubscriber.update({
      where: { id },
      data: {
        confirmationEmailStatus: "FAILED",
        confirmationEmailLastError: error.slice(0, 2000),
      },
      select: newsletterSubscriberInternalSelect,
    });
  },

  /**
   * GDPR/CCPA right-to-erasure support. Aligned with GDPR soft-delete and anonymization semantics.
   * Wipes PII (email, consent details, token hashes) and replaces the unique email index with
   * a randomized anonymized email address, while setting `deletedAt` to the current date and time.
   * This frees the original email address to sign up again while preserving schema unique index
   * invariants and non-PII audit trail metadata.
   */
  async eraseSubscriberByEmail(email: string) {
    const subscribers = await prisma.newsletterSubscriber.findMany({
      where: { email, deletedAt: null },
    });
    for (const sub of subscribers) {
      await prisma.newsletterSubscriber.update({
        where: { id: sub.id },
        data: {
          email: `anonymized-${sub.id}@deleted.local`,
          consentIpAddress: null,
          consentUserAgent: null,
          confirmationTokenHash: null,
          unsubscribeTokenHash: null,
          deletedAt: new Date(),
        },
      });
    }
  },
};
