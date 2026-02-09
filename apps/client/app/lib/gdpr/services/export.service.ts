// src/services/export.service.ts
import { prisma } from "@build/db";
import { addExportJob, ExportJobData } from "@/app/lib/queues/export.queue";
import { ExportStatus } from "@prisma/client";
import path from "path";
import fs from "fs";

export class ExportService {
  static async requestExport(
    userId: string,
    ipAddress: string,
    userAgent: string,
  ) {
    // Check for existing pending/processing exports
    const existing = await prisma.dataExport.findFirst({
      where: {
        userId,
        status: { in: ["PENDING", "PROCESSING"] },
        // Ignore old stuck exports (>24 hours)
        requestedAt: { gt: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
    });

    if (existing) {
      return {
        success: false,
        message: "Export already in progress",
        exportId: existing.id,
        status: existing.status,
        requestedAt: existing.requestedAt,
      };
    }

    // Check for recent completed export (rate limiting - 1 per day)
    const recentCompleted = await prisma.dataExport.findFirst({
      where: {
        userId,
        status: "READY",
        requestedAt: { gt: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
    });

    if (recentCompleted) {
      return {
        success: false,
        message:
          "You can only request one export per day. Please download your previous export.",
        exportId: recentCompleted.id,
        downloadUrl: recentCompleted.fileUrl,
        expiresAt: recentCompleted.expiresAt,
      };
    }

    // Create export record
    const exportRecord = await prisma.dataExport.create({
      data: {
        userId,
        status: "PENDING",
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        ipAddress,
        userAgent,
      },
    });

    // Add to BullMQ queue
    const job = await addExportJob({
      exportId: exportRecord.id,
      userId,
      ipAddress,
      userAgent,
    });

    return {
      success: true,
      exportId: exportRecord.id,
      status: "PENDING",
      message:
        "Your data export is being prepared. You will receive an email when ready.",
      jobId: job.id,
    };
  }

  static async getExportStatus(exportId: string, userId: string) {
    const exportRecord = await prisma.dataExport.findFirst({
      where: { id: exportId, userId },
      select: {
        id: true,
        status: true,
        fileUrl: true,
        fileSize: true,
        requestedAt: true,
        expiresAt: true,
        downloadedAt: true,
        metadata: true,
      },
    });

    if (!exportRecord) {
      return null;
    }

    // If expired, update status
    if (
      new Date() > exportRecord.expiresAt &&
      exportRecord.status === "READY"
    ) {
      await prisma.dataExport.update({
        where: { id: exportId },
        data: { status: "EXPIRED" },
      });
      exportRecord.status = "EXPIRED";
    }

    return exportRecord;
  }

  static async cancelExport(exportId: string, userId: string) {
    const exportRecord = await prisma.dataExport.findFirst({
      where: { id: exportId, userId },
    });

    if (!exportRecord) {
      throw new Error("Export not found");
    }

    if (exportRecord.status === "PROCESSING") {
      // Attempt to remove from queue if not started
      const { exportQueue } = await import("@/app/lib/queues/export.queue");
      const job = await exportQueue.getJob(exportId);
      if (job && (await job.isWaiting())) {
        await job.remove();
      }
    }

    if (["PENDING", "PROCESSING"].includes(exportRecord.status)) {
      await prisma.dataExport.update({
        where: { id: exportId },
        data: { status: "CANCELLED" },
      });

      return { success: true, message: "Export cancelled" };
    }

    return {
      success: false,
      message: `Cannot cancel export with status: ${exportRecord.status}`,
    };
  }

  // Local file serving (for development or small-scale)
  static async getLocalExportFile(exportId: string) {
    // Validate exportId format (UUID only) - prevents path traversal attacks
    const UUID_REGEX =
      /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
    if (!UUID_REGEX.test(exportId)) {
      throw new Error("Invalid export ID format");
    }

    const fileName = `export-${exportId}.zip`;
    const baseDir = path.resolve(process.cwd(), "exports");
    const filePath = path.resolve(baseDir, fileName);

    // Verify the resolved path is within exports directory (defense in depth)
    if (!filePath.startsWith(baseDir + path.sep)) {
      throw new Error("Invalid export path");
    }

    if (!fs.existsSync(filePath)) {
      throw new Error("File not found");
    }

    return filePath;
  }

  /**
   * Records a download event for tracking purposes
   */
  static async recordDownload(exportId: string, userId: string) {
    const exportRecord = await prisma.dataExport.findFirst({
      where: { id: exportId, userId },
    });

    if (!exportRecord) {
      throw new Error("Export not found");
    }

    if (exportRecord.status !== "READY") {
      throw new Error(
        `Cannot download export with status: ${exportRecord.status}`,
      );
    }

    await prisma.dataExport.update({
      where: { id: exportId },
      data: {
        downloadedAt: new Date(),
        downloadCount: { increment: 1 },
      },
    });

    return { success: true };
  }

  /**
   * List all exports for a user (history)
   * Returns recent exports within the last 90 days
   */
  static async listUserExports(userId: string) {
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

    const exports = await prisma.dataExport.findMany({
      where: {
        userId,
        requestedAt: { gte: ninetyDaysAgo },
      },
      select: {
        id: true,
        status: true,
        requestedAt: true,
        expiresAt: true,
        downloadedAt: true,
        fileSize: true,
      },
      orderBy: { requestedAt: "desc" },
      take: 20, // Limit to recent 20 exports
    });

    return exports;
  }
}
