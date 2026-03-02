/**
 * Export Service Tests
 *
 * Tests for GDPR data export request orchestration service.
 * Coverage targets: happy paths, rate limiting, duplicate requests, expired sessions.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { ExportService } from "@/app/lib/gdpr/services/export.service";
import {
  mockPrismaSuccess,
  mockPrismaWithDBError,
  generateMockUser,
  generateMockExport,
  generateTestDate,
  generateTestUUID,
  mockBullMQQueueSuccess,
} from "@/__tests__/mocks";

// Mock dependencies
vi.mock("@build/db", () => ({
  prisma: mockPrismaSuccess(),
}));

vi.mock("@/app/lib/queues/export.queue", () => ({
  addExportJob: vi.fn(),
  exportQueue: mockBullMQQueueSuccess(),
}));

describe("ExportService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("requestExport", () => {
    it.concurrent("should successfully create export request", async () => {
      const { prisma } = await import("@build/db");
      const { addExportJob } = await import("@/app/lib/queues/export.queue");

      const userId = generateTestUUID("user", 1);
      const mockUser = generateMockUser({ id: userId });

      vi.mocked(prisma.dataExport.findFirst).mockResolvedValue(null);
      vi.mocked(addExportJob).mockResolvedValue({ id: "job-123" } as any);

      vi.mocked(prisma.dataExport.create).mockResolvedValue(
        generateMockExport({
          id: generateTestUUID("export", 1),
          userId,
          status: "PENDING",
        }) as any,
      );

      const result = await ExportService.requestExport(
        userId,
        "192.168.1.1",
        "Mozilla/5.0",
      );

      expect(result.success).toBe(true);
      expect(result.status).toBe("PENDING");
      expect(result.exportId).toBeDefined();
      expect(result.jobId).toBe("job-123");
      expect(addExportJob).toHaveBeenCalledWith({
        exportId: expect.any(String),
        userId,
        ipAddress: "192.168.1.1",
        userAgent: "Mozilla/5.0",
      });
    });

    it.concurrent("should reject duplicate export request", async () => {
      const { prisma } = await import("@build/db");

      const userId = generateTestUUID("user", 1);
      const existingExport = generateMockExport({
        userId,
        status: "PENDING",
        requestedAt: generateTestDate(0),
      });

      vi.mocked(prisma.dataExport.findFirst).mockResolvedValue(
        existingExport as any,
      );

      const result = await ExportService.requestExport(
        userId,
        "192.168.1.1",
        "Mozilla/5.0",
      );

      expect(result.success).toBe(false);
      expect(result.message).toContain("already in progress");
      expect(result.exportId).toBe(existingExport.id);
    });

    it.concurrent("should enforce rate limiting (1 per day)", async () => {
      const { prisma } = await import("@build/db");

      const userId = generateTestUUID("user", 1);
      const recentExport = generateMockExport({
        userId,
        status: "READY",
        requestedAt: generateTestDate(-1), // 1 day ago
        fileUrl: "https://s3.amazonaws.com/exports/test.zip",
        expiresAt: generateTestDate(6), // 6 days from now
      });

      vi.mocked(prisma.dataExport.findFirst)
        .mockResolvedValueOnce(null) // No pending
        .mockResolvedValueOnce(recentExport as any); // Recent completed

      const result = await ExportService.requestExport(
        userId,
        "192.168.1.1",
        "Mozilla/5.0",
      );

      expect(result.success).toBe(false);
      expect(result.message).toContain("one export per day");
      expect(result.downloadUrl).toBe(recentExport.fileUrl);
    });

    it.concurrent("should handle database errors gracefully", async () => {
      vi.resetModules();
      vi.mock("@build/db", () => ({
        prisma: mockPrismaWithDBError("Connection timeout"),
      }));

      const { prisma } = await import("@build/db");
      const userId = generateTestUUID("user", 1);

      await expect(
        ExportService.requestExport(userId, "192.168.1.1", "Mozilla/5.0"),
      ).rejects.toThrow("Connection timeout");

      vi.resetModules();
    });
  });

  describe("getExportStatus", () => {
    it.concurrent("should return export status", async () => {
      const { prisma } = await import("@build/db");

      const exportId = generateTestUUID("export", 1);
      const userId = generateTestUUID("user", 1);
      const mockExport = generateMockExport({
        id: exportId,
        userId,
        status: "READY",
        fileUrl: "https://s3.amazonaws.com/exports/test.zip",
        expiresAt: generateTestDate(5),
      });

      vi.mocked(prisma.dataExport.findFirst).mockResolvedValue(
        mockExport as any,
      );

      const result = await ExportService.getExportStatus(exportId, userId);

      expect(result).toBeDefined();
      expect(result!.status).toBe("READY");
      expect(result!.fileUrl).toBe(mockExport.fileUrl);
    });

    it.concurrent("should mark expired exports", async () => {
      const { prisma } = await import("@build/db");

      const exportId = generateTestUUID("export", 1);
      const userId = generateTestUUID("user", 1);
      const expiredExport = generateMockExport({
        id: exportId,
        userId,
        status: "READY",
        expiresAt: generateTestDate(-1), // Expired yesterday
      });

      vi.mocked(prisma.dataExport.findFirst).mockResolvedValue(
        expiredExport as any,
      );
      vi.mocked(prisma.dataExport.update).mockResolvedValue({
        ...expiredExport,
        status: "EXPIRED",
      } as any);

      const result = await ExportService.getExportStatus(exportId, userId);

      expect(result!.status).toBe("EXPIRED");
      expect(prisma.dataExport.update).toHaveBeenCalledWith({
        where: { id: exportId },
        data: { status: "EXPIRED" },
      });
    });

    it.concurrent("should return null for non-existent export", async () => {
      const { prisma } = await import("@build/db");

      vi.mocked(prisma.dataExport.findFirst).mockResolvedValue(null);

      const result = await ExportService.getExportStatus(
        generateTestUUID("export", 999),
        generateTestUUID("user", 999),
      );

      expect(result).toBeNull();
    });
  });

  describe("cancelExport", () => {
    it.concurrent("should cancel pending export", async () => {
      const { prisma } = await import("@build/db");
      const { exportQueue } = await import("@/app/lib/queues/export.queue");

      const exportId = generateTestUUID("export", 1);
      const userId = generateTestUUID("user", 1);
      const pendingExport = generateMockExport({
        id: exportId,
        userId,
        status: "PENDING",
      });

      vi.mocked(prisma.dataExport.findFirst).mockResolvedValue(
        pendingExport as any,
      );
      vi.mocked(prisma.dataExport.update).mockResolvedValue({
        ...pendingExport,
        status: "CANCELLED",
      } as any);

      const mockJob = {
        isWaiting: vi.fn().mockResolvedValue(true),
        remove: vi.fn().mockResolvedValue(undefined),
      };
      vi.mocked(exportQueue.getJob).mockResolvedValue(mockJob as any);

      const result = await ExportService.cancelExport(exportId, userId);

      expect(result.success).toBe(true);
      expect(result.message).toContain("cancelled");
      expect(prisma.dataExport.update).toHaveBeenCalledWith({
        where: { id: exportId },
        data: { status: "CANCELLED" },
      });
    });

    it.concurrent("should not cancel completed export", async () => {
      const { prisma } = await import("@build/db");

      const exportId = generateTestUUID("export", 1);
      const userId = generateTestUUID("user", 1);
      const completedExport = generateMockExport({
        id: exportId,
        userId,
        status: "READY",
      });

      vi.mocked(prisma.dataExport.findFirst).mockResolvedValue(
        completedExport as any,
      );

      const result = await ExportService.cancelExport(exportId, userId);

      expect(result.success).toBe(false);
      expect(result.message).toContain("Cannot cancel");
    });

    it.concurrent("should throw error for non-existent export", async () => {
      const { prisma } = await import("@build/db");

      vi.mocked(prisma.dataExport.findFirst).mockResolvedValue(null);

      await expect(
        ExportService.cancelExport(
          generateTestUUID("export", 999),
          generateTestUUID("user", 999),
        ),
      ).rejects.toThrow("Export not found");
    });
  });
});
