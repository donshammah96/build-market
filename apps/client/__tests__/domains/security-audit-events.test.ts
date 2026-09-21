import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  recordSecurityAuditEvent,
  sanitizeAuditEventDetails,
} from "@/app/lib/domains/user-profile/audit-events";
import {
  formatRecentAuthRequiredNotice,
  formatRetryAfterMessage,
  mapActionErrorCodeToUserMessage,
  sanitizeDetailsForUserFacingError,
} from "@/app/lib/auth/remediation-helpers";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({
  loggerInfo: vi.fn(),
  loggerWarn: vi.fn(),
  loggerError: vi.fn(),
}));

const mockAuditLogger = {
  info: mocks.loggerInfo,
  warn: mocks.loggerWarn,
  error: mocks.loggerError,
};

describe("Security Audit Events & Remediation Helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Audit Events & PII Sanitization", () => {
    it("sanitizes Class A and Class B restricted PII fields from audit details", () => {
      const rawDetails = {
        password: "secretpassword123",
        email: "user@test.com",
        phone: "+254712345678",
        nationalId: "12345678",
        kraPin: "A000111222Z",
        attempts: 3,
        stepName: "profile_data",
        isSuccessful: true,
      };

      const sanitized = sanitizeAuditEventDetails(rawDetails);

      expect(sanitized).toBeDefined();
      expect(sanitized?.password).toBeUndefined();
      expect(sanitized?.email).toBeUndefined();
      expect(sanitized?.phone).toBeUndefined();
      expect(sanitized?.nationalId).toBeUndefined();
      expect(sanitized?.kraPin).toBeUndefined();
      expect(sanitized?.attempts).toBe(3);
      expect(sanitized?.stepName).toBe("profile_data");
      expect(sanitized?.isSuccessful).toBe(true);
    });

    it("records security audit event and invokes logger with sanitized metadata", () => {
      const event = recordSecurityAuditEvent({
        eventType: "ONBOARDING_COMPLETED",
        userId: "user_db_123",
        clerkId: "clerk_123",
        role: "CLIENT",
        correlationId: "corr_456",
        details: {
          step: "final",
          email: "should_be_stripped@test.com",
        },
        logger: mockAuditLogger,
      });

      expect(event.eventType).toBe("ONBOARDING_COMPLETED");
      expect(mocks.loggerInfo).toHaveBeenCalledWith(
        "Security Audit: ONBOARDING_COMPLETED",
        expect.objectContaining({
          event: "security_audit",
          eventType: "ONBOARDING_COMPLETED",
          hasUserId: true,
          hasClerkId: true,
          role: "CLIENT",
          correlationId: "corr_456",
        }),
      );
    });

    it("logs errors when metadata sync fails", () => {
      recordSecurityAuditEvent({
        eventType: "CLERK_METADATA_SYNC_FAILED",
        clerkId: "clerk_123",
        reason: "Network timeout",
        logger: mockAuditLogger,
      });

      expect(mocks.loggerError).toHaveBeenCalledWith(
        "Security Audit: CLERK_METADATA_SYNC_FAILED",
        expect.any(Error),
        expect.objectContaining({
          eventType: "CLERK_METADATA_SYNC_FAILED",
          reason: "Network timeout",
        }),
      );
    });
  });

  describe("Remediation Helpers", () => {
    it("formats retry-after seconds into human readable messages", () => {
      expect(formatRetryAfterMessage(45)).toBe(
        "Too many attempts. Please try again in 45 seconds.",
      );
      expect(formatRetryAfterMessage(120)).toBe(
        "Too many attempts. Please try again in 2 minutes.",
      );
      expect(formatRetryAfterMessage(90)).toBe(
        "Too many attempts. Please try again in 1m 30s.",
      );
    });

    it("formats recent-auth required notice with maxAgeSeconds context", () => {
      const notice = formatRecentAuthRequiredNotice(300);

      expect(notice.requiresReauth).toBe(true);
      expect(notice.maxAgeSeconds).toBe(300);
      expect(notice.message).toContain("last 5 minutes");
    });

    it("maps action error codes to actionable user messages", () => {
      expect(
        mapActionErrorCodeToUserMessage("limit_exceeded", {
          retryAfterSeconds: 30,
        }),
      ).toContain("30 seconds");

      expect(mapActionErrorCodeToUserMessage("unauthorized")).toContain(
        "Please sign in",
      );

      expect(mapActionErrorCodeToUserMessage("conflict")).toContain(
        "already changed",
      );
    });

    it("sanitizes error details for user-facing envelopes", () => {
      const details = {
        password: "secret",
        retryAfterSeconds: 45,
        limit: 8,
      };

      const sanitized = sanitizeDetailsForUserFacingError(details);
      expect(sanitized).toEqual({
        retryAfterSeconds: 45,
        limit: 8,
      });
    });
  });
});
