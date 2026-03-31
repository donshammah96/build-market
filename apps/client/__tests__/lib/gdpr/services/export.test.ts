/**
 * Export Service Tests
 *
 * Tests for GDPR data export request orchestration service.
 * Coverage targets: happy paths, rate limiting, duplicate requests, expired sessions.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  mockPrismaSuccess,
  generateMockExport,
  generateTestDate,
  generateTestUUID,
  mockBullMQQueueSuccess,
} from "@/__tests__/mocks";

describe("ExportService", () => {
  let ExportService: any;
  let mockPrisma: ReturnType<typeof mockPrismaSuccess>;
  let addExportJobMock: ReturnType<typeof vi.fn>;
  let exportQueueMock: ReturnType<typeof mockBullMQQueueSuccess>;

  beforeEach(async () => {
    vi.resetModules();
    mockPrisma = mockPrismaSuccess();
    addExportJobMock = vi.fn();
    exportQueueMock = mockBullMQQueueSuccess();

    vi.doMock("@build/db", () => ({
      prisma: mockPrisma,
    }));

    vi.doMock("@build/queue-server", () => ({
      addExportJob: addExportJobMock,
      exportQueue: exportQueueMock,
    }));

    const serviceModule =
      await import("@/app/lib/gdpr/services/export.service");
    ExportService = serviceModule.ExportService;
  });

  describe("requestExport", () => {
    it("should successfully create export request", async () => {
      const userId = generateTestUUID("user", 1);

      vi.mocked(mockPrisma.dataExport.findFirst)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);
      addExportJobMock.mockResolvedValue({ id: "job-123" } as any);

      vi.mocked(mockPrisma.dataExport.create).mockResolvedValue(
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
      expect(addExportJobMock).toHaveBeenCalledWith({
        exportId: expect.any(String),
        userId,
        ipAddress: "192.168.1.1",
        userAgent: "Mozilla/5.0",
      });
    });

    it("should reject duplicate export request", async () => {
      const userId = generateTestUUID("user", 1);
      const existingExport = generateMockExport({
        userId,
        status: "PENDING",
        requestedAt: generateTestDate(0),
      });

      vi.mocked(mockPrisma.dataExport.findFirst).mockResolvedValue(
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

    it("should enforce rate limiting (1 per day)", async () => {
      const userId = generateTestUUID("user", 1);
      const recentExport = generateMockExport({
        userId,
        status: "READY",
        requestedAt: generateTestDate(-1), // 1 day ago
        fileUrl: "https://s3.amazonaws.com/exports/test.zip",
        expiresAt: generateTestDate(6), // 6 days from now
      });

      vi.mocked(mockPrisma.dataExport.findFirst)
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

    it("should handle database errors gracefully", async () => {
      const userId = generateTestUUID("user", 1);

      vi.mocked(mockPrisma.dataExport.findFirst).mockRejectedValue(
        new Error("Connection timeout"),
      );

      await expect(
        ExportService.requestExport(userId, "192.168.1.1", "Mozilla/5.0"),
      ).rejects.toThrow("Connection timeout");
    });
  });

  describe("getExportStatus", () => {
    it("should return export status", async () => {
      const exportId = generateTestUUID("export", 1);
      const userId = generateTestUUID("user", 1);
      const futureExpiry = new Date();
      futureExpiry.setDate(futureExpiry.getDate() + 5);
      const mockExport = generateMockExport({
        id: exportId,
        userId,
        status: "READY",
        fileUrl: "https://s3.amazonaws.com/exports/test.zip",
        expiresAt: futureExpiry,
      });

      vi.mocked(mockPrisma.dataExport.findFirst).mockResolvedValue(
        mockExport as any,
      );

      const result = await ExportService.getExportStatus(exportId, userId);

      expect(result).toBeDefined();
      expect(result!.status).toBe("READY");
      expect(result!.fileUrl).toBe(mockExport.fileUrl);
    });

    it("should mark expired exports", async () => {
      const exportId = generateTestUUID("export", 1);
      const userId = generateTestUUID("user", 1);
      const pastExpiry = new Date();
      pastExpiry.setDate(pastExpiry.getDate() - 1);
      const expiredExport = generateMockExport({
        id: exportId,
        userId,
        status: "READY",
        expiresAt: pastExpiry,
      });

      vi.mocked(mockPrisma.dataExport.findFirst).mockResolvedValue(
        expiredExport as any,
      );
      vi.mocked(mockPrisma.dataExport.update).mockResolvedValue({
        ...expiredExport,
        status: "EXPIRED",
      } as any);

      const result = await ExportService.getExportStatus(exportId, userId);

      expect(result!.status).toBe("EXPIRED");
      expect(mockPrisma.dataExport.update).toHaveBeenCalledWith({
        where: { id: exportId },
        data: { status: "EXPIRED" },
      });
    });

    it("should return null for non-existent export", async () => {
      vi.mocked(mockPrisma.dataExport.findFirst).mockResolvedValue(null);

      const result = await ExportService.getExportStatus(
        generateTestUUID("export", 999),
        generateTestUUID("user", 999),
      );

      expect(result).toBeNull();
    });
  });

  describe("cancelExport", () => {
    it("should cancel processing export", async () => {
      const exportId = generateTestUUID("export", 1);
      const userId = generateTestUUID("user", 1);
      const pendingExport = generateMockExport({
        id: exportId,
        userId,
        status: "PROCESSING",
      });

      vi.mocked(mockPrisma.dataExport.findFirst).mockResolvedValue(
        pendingExport as any,
      );
      vi.mocked(mockPrisma.dataExport.update).mockResolvedValue({
        ...pendingExport,
        status: "CANCELLED",
      } as any);

      const mockJob = {
        isWaiting: vi.fn().mockResolvedValue(true),
        remove: vi.fn().mockResolvedValue(undefined),
      };
      vi.mocked(exportQueueMock.getJob).mockResolvedValue(mockJob as any);

      const result = await ExportService.cancelExport(exportId, userId);

      expect(result.success).toBe(true);
      expect(result.message).toContain("cancelled");
      expect(mockPrisma.dataExport.update).toHaveBeenCalledWith({
        where: { id: exportId },
        data: { status: "CANCELLED" },
      });
      expect(exportQueueMock.getJob).toHaveBeenCalledWith(exportId);
    });

    it("should not cancel completed export", async () => {
      const exportId = generateTestUUID("export", 1);
      const userId = generateTestUUID("user", 1);
      const completedExport = generateMockExport({
        id: exportId,
        userId,
        status: "READY",
      });

      vi.mocked(mockPrisma.dataExport.findFirst).mockResolvedValue(
        completedExport as any,
      );

      const result = await ExportService.cancelExport(exportId, userId);

      expect(result.success).toBe(false);
      expect(result.message).toContain("Cannot cancel");
    });

    it("should throw error for non-existent export", async () => {
      vi.mocked(mockPrisma.dataExport.findFirst).mockResolvedValue(null);

      await expect(
        ExportService.cancelExport(
          generateTestUUID("export", 999),
          generateTestUUID("user", 999),
        ),
      ).rejects.toThrow("Export not found");
    });
  });
});
