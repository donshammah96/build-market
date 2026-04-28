import { prisma } from "@build/db";
import {
  addExportJob,
  getExportQueue, // FIX: Changed from direct exportQueue import to lazy getter
} from "@/app/jobs/export-queue";
import { StructuredLogger, CorrelationIdManager } from "@build/resilience";
import path from "path";
import fs from "fs";

const logger = new StructuredLogger("export-service");
const OPERATION_NAME = "data_export_service";

export class ExportService {
  static async requestExport(
    userId: string,
    ipAddress: string,
    userAgent: string,
  ) {
    const correlationId =
      CorrelationIdManager.get() || CorrelationIdManager.generate();

    logger.info("Processing data export request", {
      correlationId,
      operationName: OPERATION_NAME,
    });

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
      logger.warn("Export request rejected: existing export in progress", {
        correlationId,
        operationName: OPERATION_NAME,
        existingExportId: existing.id,
      });

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
      logger.warn("Export request rejected: rate limited (1 per day)", {
        correlationId,
        operationName: OPERATION_NAME,
        recentExportId: recentCompleted.id,
      });

      return {
        success: false,
        message:
          "You can only request one export per day. Please download your previous export.",
        exportId: recentCompleted.id,
        downloadUrl: recentCompleted.fileUrl,
        expiresAt: recentCompleted.expiresAt,
      };
    }

    try {
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

      logger.info("Data export queued successfully", {
        correlationId,
        operationName: OPERATION_NAME,
        exportId: exportRecord.id,
        jobId: job?.id,
      });

      return {
        success: true,
        exportId: exportRecord.id,
        status: "PENDING",
        message:
          "Your data export is being prepared. You will receive an email when ready.",
        jobId: job?.id ?? undefined,
      };
    } catch (error) {
      logger.error(
        "Failed to enqueue data export request",
        error instanceof Error ? error : new Error(String(error)),
        {
          correlationId,
          operationName: OPERATION_NAME,
        },
      );
      throw error;
    }
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

    // If expired, update status lazily on read
    if (
      new Date() > exportRecord.expiresAt &&
      exportRecord.status === "READY"
    ) {
      await prisma.dataExport.update({
        where: { id: exportId },
        data: { status: "EXPIRED" },
      });
      exportRecord.status = "EXPIRED";

      logger.info("Lazy-expired data export on status check", {
        operationName: OPERATION_NAME,
        exportId,
      });
    }

    return exportRecord;
  }

  static async cancelExport(exportId: string, userId: string) {
    const correlationId =
      CorrelationIdManager.get() || CorrelationIdManager.generate();

    const exportRecord = await prisma.dataExport.findFirst({
      where: { id: exportId, userId },
    });

    if (!exportRecord) {
      throw new Error("Export not found");
    }

    if (["PENDING", "PROCESSING"].includes(exportRecord.status)) {
      try {
        // Always call getJob for test coverage and contract
        const queue = getExportQueue();
        const job = await queue.getJob(exportId);

        // Also check isDelayed in case the queue is backed off
        if (job && ((await job.isWaiting()) || (await job.isDelayed()))) {
          await job.remove();
          logger.info("Removed pending export job from queue", {
            correlationId,
            operationName: OPERATION_NAME,
            exportId,
            jobId: job.id,
          });
        }
      } catch (queueError) {
        // We log but do not throw here; we still want to mark the DB record cancelled
        logger.warn(
          "Failed to remove export job from queue during cancellation",
          {
            correlationId,
            operationName: OPERATION_NAME,
            exportId,
            error:
              queueError instanceof Error
                ? queueError.message
                : String(queueError),
          },
        );
      }

      await prisma.dataExport.update({
        where: { id: exportId },
        data: { status: "CANCELLED" },
      });

      logger.info("Export cancelled successfully", {
        correlationId,
        operationName: OPERATION_NAME,
        exportId,
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

    logger.info("Data export downloaded", {
      operationName: OPERATION_NAME,
      exportId,
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
