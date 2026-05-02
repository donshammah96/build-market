import { prisma } from "@build/db";
import archiver from "archiver";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import fs from "fs";
import path from "path";
import { Upload } from "@aws-sdk/lib-storage";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createReadStream } from "fs";

export class ExportProcessor {
  private s3Client: S3Client | null = null;
  private readonly bucketName: string;
  private readonly exportDir: string;
  private readonly s3Disabled: boolean;

  constructor() {
    this.s3Disabled = process.env.S3_DISABLED === "true";
    this.bucketName =
      process.env.R2_EXPORT_BUCKET ||
      process.env.S3_EXPORT_BUCKET ||
      process.env.EXPORTS_BUCKET_NAME ||
      "buildmarket-exports";
    this.exportDir = path.join(process.cwd(), "exports");

    // Initialize S3 client only if not disabled
    if (!this.s3Disabled) {
      const accessKeyId =
        process.env.R2_ACCESS_KEY_ID ||
        process.env.AWS_ACCESS_KEY_ID ||
        process.env.S3_ACCESS_KEY_ID;
      const secretAccessKey =
        process.env.R2_SECRET_ACCESS_KEY ||
        process.env.AWS_SECRET_ACCESS_KEY ||
        process.env.S3_SECRET_ACCESS_KEY;
      const endpoint = process.env.R2_ENDPOINT || process.env.S3_URL;
      const region =
        process.env.R2_REGION ||
        process.env.AWS_REGION ||
        process.env.S3_REGION ||
        "auto";

      if (!accessKeyId || !secretAccessKey || !endpoint) {
        console.warn(
          "[ExportProcessor] S3-compatible storage configuration missing. " +
            "Set R2_ENDPOINT/R2_ACCESS_KEY_ID/R2_SECRET_ACCESS_KEY (or AWS/S3 aliases), or set S3_DISABLED=true for local storage.",
        );
        // Allow graceful degradation to local storage
        this.s3Disabled = true;
      } else {
        this.s3Client = new S3Client({
          region,
          endpoint,
          credentials: { accessKeyId, secretAccessKey },
        });
      }
    }

    // Ensure temp/export directories exist
    if (!fs.existsSync(this.exportDir)) {
      fs.mkdirSync(this.exportDir, { recursive: true });
    }
    const exportsDir = path.join(process.cwd(), "exports");
    if (!fs.existsSync(exportsDir)) {
      fs.mkdirSync(exportsDir, { recursive: true });
    }
  }

  async processExport(
    exportId: string,
    onProgress?: (percent: number) => Promise<void>,
  ): Promise<{ fileUrl: string; fileSize: number }> {
    await onProgress?.(0);

    // Update status to PROCESSING
    await prisma.dataExport.update({
      where: { id: exportId },
      data: { status: "PROCESSING", requestedAt: new Date() },
    });

    const record = await prisma.dataExport.findUnique({
      where: { id: exportId },
    });

    if (!record) throw new Error("Export record not found");

    const user = await prisma.user.findUnique({
      where: { id: record.userId },
      include: {
        clientProfile: true,
        professionalProfile: {
          include: {
            licenses: true,
            documents: true,
            transactions: {
              take: 10000, // Limit to prevent memory issues
              orderBy: { createdAt: "desc" },
            },
          },
        },
        projects: {
          take: 5000,
          include: {
            milestones: true,
            documents: { include: { asset: true } },
          },
        },
        orders: {
          take: 5000,
          include: { items: true },
        },
        consents: true,
        ideaBooks: {
          include: { savedProducts: true, savedProjects: true },
        },
      },
    });

    if (!user) throw new Error("User not found");

    await onProgress?.(30);

    // Create ZIP archive
    const fileName = `gdpr-export-${exportId}.zip`;
    const tempPath = path.join(this.exportDir, fileName);
    const output = fs.createWriteStream(tempPath);
    const archive = archiver("zip", {
      zlib: { level: 6 }, // Balance between speed and compression
      comment: `Build Market Data Export - ${new Date().toISOString()}`,
    });

    // Handle archive warnings/errors
    archive.on("warning", (err) => {
      if (err.code === "ENOENT") {
        console.warn("Archive warning:", err);
      } else {
        throw err;
      }
    });

    archive.on("error", (err) => {
      throw err;
    });

    archive.pipe(output);

    // 1. Metadata
    const metadata = {
      exportId,
      generatedAt: new Date().toISOString(),
      generatedBy: "Build Market Platform",
      dataRetentionDays: user.dataRetentionDays,
      exportVersion: "1.0",
      consentRecords: user.consents.map((c) => ({
        type: c.type,
        granted: c.granted,
        grantedAt: c.grantedAt,
        withdrawnAt: c.withdrawnAt,
      })),
    };
    archive.append(JSON.stringify(metadata, null, 2), {
      name: "metadata.json",
    });

    await onProgress?.(40);

    // 2. Profile (Sanitized for GDPR - only their own data)
    const profileData = {
      id: user.id,
      email: user.email,
      phone: user.phone,
      role: user.role,
      status: user.status,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      clientProfile: user.clientProfile,
      professionalProfile: user.professionalProfile
        ? {
            ...user.professionalProfile,
            // Exclude internal fields
            verificationNotes: undefined,
            verifiedById: undefined,
          }
        : null,
    };
    archive.append(JSON.stringify(profileData, null, 2), {
      name: "profile.json",
    });

    await onProgress?.(50);

    // 3. Projects
    if (user.projects?.length > 0) {
      archive.append(JSON.stringify(user.projects, null, 2), {
        name: "projects.json",
      });
    }

    // 4. Financial Records
    if ((user.professionalProfile?.transactions?.length ?? 0) > 0) {
      archive.append(
        JSON.stringify(user.professionalProfile?.transactions, null, 2),
        { name: "financial_transactions.json" },
      );
    }

    // 5. Orders (Purchase history)
    if (user.orders?.length > 0) {
      archive.append(JSON.stringify(user.orders, null, 2), {
        name: "orders.json",
      });
    }

    // 6. Idea Books (Saved items)
    if (user.ideaBooks?.length > 0) {
      archive.append(JSON.stringify(user.ideaBooks, null, 2), {
        name: "saved_items.json",
      });
    }

    await onProgress?.(70);

    // 7. Assets Manifest (List of files, actual files served via signed URLs)
    const assets = await prisma.asset.findMany({
      where: { uploaderId: user.id },
      select: {
        id: true,
        originalName: true,
        mimeType: true,
        size: true,
        createdAt: true,
        cdnUrl: true,
      },
      take: 10000,
    });

    if (assets.length > 0) {
      archive.append(
        JSON.stringify(
          {
            count: assets.length,
            assets: assets.map((a) => ({
              ...a,
              // In production, generate signed URLs for actual download
              downloadUrl: `PRESIGNED_URL_PLACEHOLDER_${a.id}`,
            })),
          },
          null,
          2,
        ),
        { name: "assets_manifest.json" },
      );
    }

    await archive.finalize();
    await onProgress?.(80);

    // Wait for write to complete
    await new Promise<void>((resolve, reject) => {
      output.on("close", resolve);
      output.on("error", reject);
    });

    const fileSize = archive.pointer();
    await onProgress?.(90);

    // Upload to S3 (Streaming upload for large files) or store locally
    let fileUrl: string;
    const s3Key = `exports/${user.id}/${fileName}`;

    if (this.s3Disabled || !this.s3Client) {
      // Store locally if S3 is disabled or unavailable
      const localPath = path.join(process.cwd(), "exports", fileName);
      fs.copyFileSync(tempPath, localPath);
      fileUrl = `/exports/${fileName}`;
      fs.unlinkSync(tempPath);

      await prisma.dataExport.update({
        where: { id: exportId },
        data: {
          status: "READY",
          fileUrl,
          fileSize,
          downloadedAt: new Date(),
        },
      });

      await onProgress?.(100);
      return { fileUrl, fileSize };
    }

    const fileStream = createReadStream(tempPath);

    const upload = new Upload({
      client: this.s3Client,
      params: {
        Bucket: this.bucketName,
        Key: s3Key,
        Body: fileStream,
        ContentType: "application/zip",
        Metadata: {
          "export-id": exportId,
          "user-id": user.id,
          "generated-at": new Date().toISOString(),
        },
      },
      queueSize: 4, // concurrent upload parts
      partSize: 5 * 1024 * 1024, // 5MB parts
    });

    upload.on(
      "httpUploadProgress",
      (progress: { loaded?: number; total?: number }) => {
        const percent = Math.round(
          ((progress.loaded || 0) / (progress.total || 1)) * 100,
        );
        console.log(`[ExportProcessor] S3 Upload: ${percent}%`);
      },
    );

    await upload.done();
    await onProgress?.(95);

    // Generate signed URL (valid for 7 days to match expiresAt)
    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: s3Key,
    });

    fileUrl = await getSignedUrl(this.s3Client, command, {
      expiresIn: 7 * 24 * 60 * 60,
    });

    // Cleanup local temp file
    fs.unlinkSync(tempPath);

    // Update database
    await prisma.dataExport.update({
      where: { id: exportId },
      data: {
        status: "READY",
        fileUrl,
        s3Key, // Store key for cleanup
        fileSize,
        downloadedAt: new Date(),
      },
    });

    await onProgress?.(100);

    return { fileUrl, fileSize };
  }

  // Cleanup method for expired exports
  async deleteExportFiles(exportId: string, s3Key: string) {
    if (this.s3Disabled || !this.s3Client) {
      console.warn(`[ExportProcessor] S3 disabled, cannot delete ${s3Key}`);
      return;
    }

    try {
      await this.s3Client.send(
        new DeleteObjectCommand({
          Bucket: this.bucketName,
          Key: s3Key,
        }),
      );

      console.log(`[ExportProcessor] Deleted S3 object ${s3Key}`);
    } catch (error) {
      console.error(
        `[ExportProcessor] Failed to delete S3 object ${s3Key}:`,
        error,
      );
    }
  }
}
