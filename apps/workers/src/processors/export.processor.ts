import { prisma } from "@build/db";
import archiver from "archiver";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import fs from "node:fs";
import path from "node:path";
import { Upload } from "@aws-sdk/lib-storage";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createReadStream } from "node:fs";
import { StructuredLogger, CorrelationIdManager } from "@build/resilience";
import { sendEmail } from "@build/mail-server";
import type { Job } from "bullmq";
import type { ExportJobData } from "@build/queue-server";
import { validateWorkerEnv } from "../env.js";

const logger = new StructuredLogger("worker-export-processor");

type S3Sender = {
  send(command: DeleteObjectCommand | GetObjectCommand): Promise<unknown>;
};

export interface ExportJobResult {
  status: "completed" | "cancelled" | "failed";
  exportId: string;
  fileUrl?: string;
  fileSize?: number;
  error?: string;
}

export class ExportServiceProcessor {
  private s3Client: S3Sender | null = null;
  private readonly bucketName: string;
  private readonly exportDir: string;
  private s3Disabled: boolean;

  constructor() {
    const env = validateWorkerEnv();
    this.s3Disabled = env.S3_DISABLED ?? false;
    this.bucketName =
      env.R2_EXPORT_BUCKET ??
      env.S3_EXPORT_BUCKET ??
      env.EXPORTS_BUCKET_NAME ??
      "buildmarket-exports";
    this.exportDir = path.join(process.cwd(), "exports");

    if (!this.s3Disabled) {
      const accessKeyId =
        env.R2_ACCESS_KEY_ID ?? env.AWS_ACCESS_KEY_ID ?? env.S3_ACCESS_KEY_ID;
      const secretAccessKey =
        env.R2_SECRET_ACCESS_KEY ??
        env.AWS_SECRET_ACCESS_KEY ??
        env.S3_SECRET_ACCESS_KEY;
      const endpoint = env.R2_ENDPOINT ?? env.S3_URL;
      const region = env.R2_REGION ?? env.AWS_REGION ?? env.S3_REGION ?? "auto";

      if (!accessKeyId || !secretAccessKey || !endpoint) {
        logger.warn(
          "S3-compatible storage configuration missing. Set R2_ENDPOINT/R2_ACCESS_KEY_ID/R2_SECRET_ACCESS_KEY, or set S3_DISABLED=true for local storage.",
        );
        this.s3Disabled = true;
      } else {
        this.s3Client = new S3Client({
          region,
          endpoint,
          credentials: { accessKeyId, secretAccessKey },
        }) as unknown as S3Sender;
      }
    }

    if (!fs.existsSync(this.exportDir)) {
      fs.mkdirSync(this.exportDir, { recursive: true });
    }
  }

  async processExport(
    exportId: string,
    onProgress?: (percent: number) => Promise<void>,
  ): Promise<{ fileUrl: string; fileSize: number; s3Key?: string }> {
    await onProgress?.(0);

    await prisma.dataExport.update({
      where: { id: exportId },
      data: { status: "PROCESSING", requestedAt: new Date() },
    });

    const record = await prisma.dataExport.findUnique({
      where: { id: exportId },
    });

    if (!record) {
      throw new Error(`DataExport record ${exportId} not found`);
    }

    await onProgress?.(10);

    const userData = await this.gatherUserData(record.userId);
    await onProgress?.(40);

    const zipPath = await this.createZipArchive(exportId, userData);
    const stats = fs.statSync(zipPath);
    await onProgress?.(70);

    let fileUrl: string;
    let s3Key: string | undefined;

    if (this.s3Disabled || !this.s3Client) {
      fileUrl = `/api/exports/download/${exportId}`;
    } else {
      s3Key = `exports/${record.userId}/${exportId}.zip`;
      fileUrl = await this.uploadToS3(zipPath, s3Key);

      try {
        fs.unlinkSync(zipPath);
      } catch (unlinkError) {
        logger.warn("Failed to delete local temporary export archive", {
          error:
            unlinkError instanceof Error
              ? unlinkError.message
              : String(unlinkError),
        });
      }
    }

    await onProgress?.(90);

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
    await prisma.dataExport.update({
      where: { id: exportId },
      data: {
        status: "READY",
        fileUrl,
        fileSize: stats.size,
        expiresAt,
        ...(s3Key ? { s3Key } : {}),
      },
    });

    await onProgress?.(100);

    return { fileUrl, fileSize: stats.size, s3Key };
  }

  private async gatherUserData(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        projects: true,
        orders: true,
        auditLogs: true,
      },
    });

    return {
      userProfile: user,
      exportedAt: new Date().toISOString(),
    };
  }

  private async createZipArchive(
    exportId: string,
    data: Record<string, unknown>,
  ): Promise<string> {
    const outputPath = path.join(this.exportDir, `${exportId}.zip`);
    const output = fs.createWriteStream(outputPath);
    const archive = archiver("zip", { zlib: { level: 9 } });

    return new Promise((resolve, reject) => {
      output.on("close", () => resolve(outputPath));
      archive.on("error", (err) => reject(err));

      archive.pipe(output);
      archive.append(JSON.stringify(data, null, 2), {
        name: "user_data_export.json",
      });
      archive.finalize();
    });
  }

  private async uploadToS3(filePath: string, s3Key: string): Promise<string> {
    if (!this.s3Client) throw new Error("S3 client not initialized");

    const fileStream = createReadStream(filePath);
    const parallelUploads3 = new Upload({
      client: this.s3Client as unknown as S3Client,
      params: {
        Bucket: this.bucketName,
        Key: s3Key,
        Body: fileStream,
        ContentType: "application/zip",
      },
    });

    await parallelUploads3.done();

    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: s3Key,
    });

    return await getSignedUrl(this.s3Client as unknown as S3Client, command, {
      expiresIn: 7 * 24 * 3600,
    });
  }
}

let exportProcessorInstance: ExportServiceProcessor | null = null;

export function getExportProcessor(): ExportServiceProcessor {
  if (!exportProcessorInstance) {
    exportProcessorInstance = new ExportServiceProcessor();
  }
  return exportProcessorInstance;
}

/**
 * Executes a GDPR data export BullMQ job.
 */
export async function processDataExportJob(
  job: Job<ExportJobData>,
): Promise<ExportJobResult> {
  const { exportId, userId } = job.data;
  const correlationId = CorrelationIdManager.generate();
  CorrelationIdManager.set(correlationId);

  logger.info("[ExportProcessor] Starting data export processing", {
    correlationId,
    exportId,
    jobId: job.id,
  });

  try {
    await job.updateProgress(10);

    const exportRecord = await prisma.dataExport.findUnique({
      where: { id: exportId },
    });

    if (!exportRecord) {
      throw new Error(`Export record ${exportId} not found`);
    }

    if (exportRecord.status === "CANCELLED") {
      logger.info("[ExportProcessor] Export was cancelled, skipping", {
        correlationId,
        exportId,
      });
      return { status: "cancelled", exportId };
    }

    await job.updateProgress(20);

    const processor = getExportProcessor();
    const result = await processor.processExport(exportId, async (progress) => {
      const scaledProgress = 20 + progress * 0.7;
      await job.updateProgress(Math.round(scaledProgress));
    });

    await job.updateProgress(90);

    // Send email notification to user
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { email: true, firstName: true },
      });

      if (user?.email) {
        const downloadUrl = result.fileUrl;
        const expiresDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        await sendEmail({
          to: user.email,
          subject: "Your Data Export is Ready",
          html: `
            <div style="font-family: Arial, sans-serif; padding: 20px;">
              <h2>Your Data Export is Ready</h2>
              <p>Hi ${user.firstName || "User"},</p>
              <p>Your requested data export has been prepared successfully.</p>
              <p><a href="${downloadUrl}" style="background-color: #059669; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px; display: inline-block;">Download Data Archive</a></p>
              <p><small>This download link will expire on ${expiresDate.toISOString()}</small></p>
            </div>
          `,
        });

        logger.info("[ExportProcessor] Export ready email sent", {
          correlationId,
          exportId,
        });
      }
    } catch (emailError) {
      logger.error(
        "[ExportProcessor] Failed to send export ready notification email",
        emailError instanceof Error
          ? emailError
          : new Error(String(emailError)),
        { correlationId, exportId },
      );
    }

    await job.updateProgress(100);

    return {
      status: "completed",
      exportId,
      fileUrl: result.fileUrl,
      fileSize: result.fileSize,
    };
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    logger.error("[ExportProcessor] Data export processing failed", error, {
      correlationId,
      exportId,
    });

    try {
      await prisma.dataExport.update({
        where: { id: exportId },
        data: { status: "FAILED" },
      });
    } catch {
      // Non-fatal if status update fails
    }

    throw error;
  }
}
