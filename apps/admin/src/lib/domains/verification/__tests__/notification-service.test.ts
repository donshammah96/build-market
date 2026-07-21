import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  notifyVerificationResult,
  publishVerificationEvent,
  publishLicenseVerificationEvent,
} from "../internal/notification.service";
import type { VerificationResult } from "../internal/types";
import type { LicenseVerificationResult } from "../internal/license-verification.service";

const producerMock = vi.hoisted(() => ({
  connect: vi.fn(),
  disconnect: vi.fn(),
  publishWithRetry: vi.fn(),
}));

vi.mock("@/lib/infrastructure/nats-client", () => ({
  getAdminNatsProducer: vi.fn(() => Promise.resolve(producerMock)),
  shutdownAdminNatsProducer: vi.fn(() => Promise.resolve()),
}));

vi.mock("@build/nats", () => ({
  createProducer: vi.fn(() => producerMock),
}));

vi.mock("@/lib/domains/verification/internal/notification-queue", () => ({
  queueFailedNotification: vi.fn(),
}));

// Mock dependencies
vi.mock("@build/db", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
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
    it("should publish NATS event for non-license entities", async () => {
      const result: VerificationResult = {
        success: true,
        entityType: "professional",
        entityId: "prof_123",
        previousStatus: "PENDING",
        newStatus: "VERIFIED",
        verifiedAt: new Date(),
        message: "Professional verified",
      };

      await publishVerificationEvent(result, "user@example.com", "John Doe");

      expect(producerMock.publishWithRetry).toHaveBeenCalledWith(
        "verification.professional.verified",
        expect.objectContaining({
          entityType: "professional",
          entityId: "prof_123",
          newStatus: "VERIFIED",
        }),
        expect.any(Object),
      );
    });

    it("should early return for license entityType in publishVerificationEvent", async () => {
      const result: VerificationResult = {
        success: true,
        entityType: "license",
        entityId: "lic_123",
        previousStatus: "PENDING",
        newStatus: "VERIFIED",
        message: "License verified",
      };

      await publishVerificationEvent(result, "user@example.com", "John Doe");

      expect(producerMock.publishWithRetry).not.toHaveBeenCalled();
    });
  });

  describe("publishLicenseVerificationEvent", () => {
    it("should publish license verification event to NATS", async () => {
      const result: LicenseVerificationResult = {
        success: true,
        entityType: "license",
        entityId: "lic_123",
        licenseId: "lic_123",
        authority: "NCA",
        licenseNumber: "NCA-001",
        professionalId: "prof_456",
        verificationMethod: "MANUAL",
        previousStatus: "PENDING",
        newStatus: "VERIFIED",
        message: "License verified",
      };

      await publishLicenseVerificationEvent(result, "admin_1", "corr_123");

      expect(producerMock.publishWithRetry).toHaveBeenCalledWith(
        "license.verified",
        expect.objectContaining({
          licenseId: "lic_123",
          professionalId: "prof_456",
          authority: "NCA",
          licenseNumber: "NCA-001",
          action: "verified",
          adminId: "admin_1",
          correlationId: "corr_123",
        }),
        expect.objectContaining({
          maxRetries: 3,
        }),
      );
    });
  });
});
