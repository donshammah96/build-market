/**
 * Notification Service Test Suite
 * Tests for verification notification dispatch
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  notifyVerificationResult,
  publishVerificationEvent,
} from "@/lib/services/verification/notification.service";
import type { VerificationResult } from "@/lib/services/verification/types";

// Mock dependencies
vi.mock("@repo/db", () => ({
  prisma: {
    notification: {
      create: vi.fn(),
    },
  },
}));

global.fetch = vi.fn();

describe("Notification Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.ENABLE_NOTIFICATION_SERVICE;
  });

  describe("notifyVerificationResult", () => {
    it("should create database notification for verified professional", async () => {
      const { prisma } = await import("@repo/db");

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
          title: "Professional Verified",
          type: "success",
          link: "/professional-portal/profile",
        }),
      });
    });

    it("should create notification for rejected store", async () => {
      const { prisma } = await import("@repo/db");

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
          title: "Store Rejected",
          type: "error",
          link: "/professional-portal/inventory",
        }),
      });
    });

    it("should create notification for property needing correction", async () => {
      const { prisma } = await import("@repo/db");

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
          type: "warning",
          link: "/professional-portal/properties",
        }),
      });
    });

    it("should send to external notification service when enabled", async () => {
      const { prisma } = await import("@repo/db");
      process.env.ENABLE_NOTIFICATION_SERVICE = "true";

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
    });

    it("should not throw on notification failure", async () => {
      const { prisma } = await import("@repo/db");

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
