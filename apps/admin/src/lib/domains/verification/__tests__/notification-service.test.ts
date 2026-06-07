/**
 * Notification Service Test Suite
 * Tests for verification notification dispatch
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  notifyVerificationResult,
  publishVerificationEvent,
} from "../internal/notification.service";
import type { VerificationResult } from "../internal/types";

vi.mock("@build/nats", () => ({
  createProducer: vi.fn(() => ({
    connect: vi.fn(),
    disconnect: vi.fn(),
    publishWithRetry: vi.fn(),
  })),
}));

vi.mock("@/lib/domains/verification/internal/notification-queue", () => ({
  queueFailedNotification: vi.fn(),
}));

// Mock dependencies
vi.mock("@build/db", () => ({
  prisma: {
    professionalProfile: {
      findUnique: vi.fn(),
    },
    store: {
      findUnique: vi.fn(),
    },
    property: {
      findUnique: vi.fn(),
    },
    professionalDocument: {
      findUnique: vi.fn(),
    },
    notification: {
      create: vi.fn(),
    },
  },
}));

global.fetch = vi.fn();

describe("Notification Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.ENABLE_NOTIFICATION_SERVICE; // bootstrap-only: test environment mock override
  });

  describe("notifyVerificationResult", () => {
    it("should create database notification for verified professional", async () => {
      const { prisma } = await import("@build/db");

      vi.mocked(prisma.professionalProfile.findUnique).mockResolvedValue({
        companyName: "Test Company",
      } as any);
      vi.mocked(prisma.notification.create).mockResolvedValue({
        id: "notif_123",
      } as any);

      const result: VerificationResult = {
        success: true,
        entityType: "professional",
        entityId: "prof_123",
        previousStatus: "PENDING",
        newStatus: "VERIFIED",
        verifiedAt: new Date(),
        message: "Professional verified",
      };

      await notifyVerificationResult(result, "user_123");

      expect(prisma.notification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: "user_123",
          title: "Professional Verified Successfully",
          type: "SUCCESS",
        }),
      });
    });

    it("should create notification for rejected store", async () => {
      const { prisma } = await import("@build/db");

      vi.mocked(prisma.store.findUnique).mockResolvedValue({
        name: "My Store",
      } as any);
      vi.mocked(prisma.notification.create).mockResolvedValue({
        id: "notif_123",
      } as any);

      const result: VerificationResult = {
        success: true,
        entityType: "store",
        entityId: "store_123",
        previousStatus: "PENDING",
        newStatus: "REJECTED",
        message: "Store rejected",
      };

      await notifyVerificationResult(result, "user_123");

      expect(prisma.notification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: "user_123",
          title: "Store Verification Rejected",
          type: "ERROR",
        }),
      });
    });

    it("should create notification for property needing correction", async () => {
      const { prisma } = await import("@build/db");

      vi.mocked(prisma.property.findUnique).mockResolvedValue({
        title: "My Property",
      } as any);
      vi.mocked(prisma.notification.create).mockResolvedValue({
        id: "notif_123",
      } as any);

      const result: VerificationResult = {
        success: true,
        entityType: "property",
        entityId: "prop_123",
        previousStatus: "PENDING",
        newStatus: "NEEDS_CORRECTION",
        message: "Property needs correction",
      };

      await notifyVerificationResult(result, "user_123");

      expect(prisma.notification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: "user_123",
          title: "Property Needs Correction",
          type: "WARNING",
        }),
      });
    });

    it("should send to external notification service when enabled", async () => {
      const { prisma } = await import("@build/db");
      const { adminEnvConfig } = await import("@/lib/infrastructure/env");
      process.env.ENABLE_NOTIFICATION_SERVICE = "true"; // bootstrap-only: test environment mock override
      adminEnvConfig.ENABLE_NOTIFICATION_SERVICE = true;

      vi.mocked(prisma.professionalProfile.findUnique).mockResolvedValue({
        companyName: "Test Company",
      } as any);
      vi.mocked(prisma.notification.create).mockResolvedValue({
        id: "notif_123",
      } as any);

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ success: true }),
      } as any);

      const result: VerificationResult = {
        success: true,
        entityType: "professional",
        entityId: "prof_123",
        previousStatus: "PENDING",
        newStatus: "VERIFIED",
        message: "Professional verified",
      };

      await notifyVerificationResult(result, "user_123");

      expect(fetch).toHaveBeenCalledWith(
        "http://localhost:3011/api/notifications",
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining("user_123"),
        }),
      );

      adminEnvConfig.ENABLE_NOTIFICATION_SERVICE = false;
    });

    it("should not throw on notification failure", async () => {
      const { prisma } = await import("@build/db");

      vi.mocked(prisma.notification.create).mockRejectedValue(
        new Error("Database error"),
      );

      const result: VerificationResult = {
        success: true,
        entityType: "professional",
        entityId: "prof_123",
        previousStatus: "PENDING",
        newStatus: "VERIFIED",
        message: "Professional verified",
      };

      // Should not throw
      await expect(
        notifyVerificationResult(result, "user_123"),
      ).resolves.not.toThrow();
    });
  });

  describe("publishVerificationEvent", () => {
    it("should log Kafka event intent", async () => {
      const result: VerificationResult = {
        success: true,
        entityType: "professional",
        entityId: "prof_123",
        previousStatus: "PENDING",
        newStatus: "VERIFIED",
        verifiedAt: new Date(),
        message: "Professional verified",
      };

      // Should not throw - just logs for now
      await expect(
        publishVerificationEvent(result, "user@example.com", "John Doe"),
      ).resolves.not.toThrow();
    });
  });
});
