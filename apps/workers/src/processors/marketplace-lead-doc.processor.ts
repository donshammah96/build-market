import { prisma } from "@build/db";
import { StructuredLogger } from "@build/resilience";
import type { Job } from "bullmq";
import { getVirusScanner } from "@build/media";

const logger = new StructuredLogger("worker-marketplace-lead-doc-processor");

export interface MarketplaceLeadDocScanJobData {
  documentId: string;
  leadId: string;
  fileKey: string;
  fileBufferBase64?: string;
  mimeType?: string;
  fileSize?: number;
}

export interface MarketplaceLeadDocScanResult {
  status: "clean" | "infected" | "failed";
  documentId: string;
  leadId: string;
  scannedAt: string;
  error?: string;
}

/**
 * BullMQ processor for scanning uploaded marketplace lead verification documents
 * (Title deeds, allotment letters, proof of funds) before review or scoring access.
 */
export async function processMarketplaceLeadDocumentScan(
  job: Job<MarketplaceLeadDocScanJobData>,
): Promise<MarketplaceLeadDocScanResult> {
  const { documentId, leadId, fileKey, fileBufferBase64, mimeType, fileSize } =
    job.data;
  const startedAt = Date.now();

  logger.info("Starting malware scan for marketplace lead document", {
    jobId: job.id,
    documentId,
    leadId,
    fileKey,
  });

  try {
    const scanner = getVirusScanner();

    let isClean = true;

    if (fileBufferBase64) {
      const buffer = Buffer.from(fileBufferBase64, "base64");
      const scanResult = await scanner.scanUpload({
        uploadId: documentId,
        originalName: fileKey,
        mimeType: mimeType || "application/pdf",
        size: fileSize || buffer.length,
        buffer,
      });
      isClean = scanResult.safe && scanResult.status === "CLEAN";
    }

    const scanStatus = isClean ? "clean" : "infected";
    const now = new Date();

    await prisma.marketplaceLeadDocument.update({
      where: { id: documentId },
      data: {
        scanStatus,
        scannedAt: now,
      },
    });

    logger.info("Marketplace lead document scan complete", {
      documentId,
      leadId,
      scanStatus,
      durationMs: Date.now() - startedAt,
    });

    return {
      status: scanStatus,
      documentId,
      leadId,
      scannedAt: now.toISOString(),
    };
  } catch (error) {
    const errObj = error instanceof Error ? error : new Error(String(error));

    logger.error("Failed to scan marketplace lead document", errObj, {
      documentId,
      leadId,
      fileKey,
    });

    await prisma.marketplaceLeadDocument.update({
      where: { id: documentId },
      data: {
        scanStatus: "failed",
        scannedAt: new Date(),
      },
    });

    return {
      status: "failed",
      documentId,
      leadId,
      scannedAt: new Date().toISOString(),
      error: errObj.message,
    };
  }
}
