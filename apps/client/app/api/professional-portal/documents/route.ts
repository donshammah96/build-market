import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@build/db";
import { z } from "zod";
import { withAuth } from "@/app/lib/api-middleware";
import { generateFileKey } from "@/app/lib/file-keys";
import { apiError, HttpStatus } from "@/app/lib/api-response";
import {
  initializeCorrelationId,
  executeResilient,
  getClientLogger,
} from "@/app/lib/resilient-api";
import {
  checkRateLimit,
  getRateLimitIdentifier,
  RateLimits,
} from "@/app/lib/rate-limit";

const logger = getClientLogger();

const STORAGE_BASE_URL = process.env.STORAGE_BASE_URL || "https://bucket-url.com";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/gif",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]

const AttachmentTypeEnum = z.enum([
  "TITLE_DEED",
  "OFFICIAL_SEARCH",
  "MANDATE_LETTER",
  "NATIONAL_ID",
  "KRA_PIN",
  "EARB_CERTIFICATE",
  "PRACTICING_LICENCE",
  "NCA CERTIFICATE",
  "OTHER",
]);

const createDocumentSchema = z.object({
  originalFileName: z.string().min(1, "File nameis required"),
  mimeType: z.string().refine(
    (type) => ALLOWED_MIME_TYPES.includes(type),
    {
      message: `Invalid file type. Allowed types: ${ALLOWED_MIME_TYPES.join(", ")}`,
    }
  ),

  size: z.number().max(MAX_FILE_SIZE, `File size exceeds the limit of ${MAX_FILE_SIZE / (1024 * 1024)} MB`),

  type: AttachmentTypeEnum,
});

/**
 * GET /api/professional-portal/documents
 * Get all documents for the authenticated professional
 */
export const GET = withAuth(async (req: NextRequest, { dbUserId }) => {
  const correlationId = initializeCorrelationId(req);

  const identifier = getRateLimitIdentifier(req);
  const { success } = await checkRateLimit(
    identifier,
    RateLimits.READ.limit,
    RateLimits.READ.window
  );

  if (!success) {
    return apiError("Too many requests", HttpStatus.TOO_MANY_REQUESTS);
  }

  logger.info("Fetching professional documents", {
    correlationId,
    userId: dbUserId,
  });

  return executeResilient(
    async () => {
      const documents = await prisma.professionalDocument.findMany({
        where: { professionalId: dbUserId },
        orderBy: { createdAt: "desc" },
      });

      logger.info("Professional documents fetched successfully", {
        correlationId,
        userId: dbUserId,
        count: documents.length,
      });

      return { data: documents };
    },
    {
      operationName: "get_professional_documents",
      successStatus: HttpStatus.OK,
    }
  );
});

/**
 * POST /api/professional-portal/documents
 * Create a new document for the authenticated professional
 */
export const POST = withAuth(async (req: NextRequest, { dbUserId }) => {
  const correlationId = initializeCorrelationId(req);

  const identifier = getRateLimitIdentifier(req);
  const { success } = await checkRateLimit(
    identifier,
    RateLimits.WRITE.limit,
    RateLimits.WRITE.window
  );

  if (!success) {
    return apiError("Too many requests", HttpStatus.TOO_MANY_REQUESTS);
  }

  const body = await req.json();
  const validation = createDocumentSchema.safeParse(body);

  if (!validation.success) {
    logger.warn("Document creation validation failed", {
      correlationId,
      userId: dbUserId,
      errors: validation.error.issues,
    });
    return apiError(
      "Invalid input",
      HttpStatus.BAD_REQUEST,
      validation.error.issues
    );
  }

  const { originalFileName, mimeType, size, type } = validation.data;

  // Generate a unique file key
  // Format: "documents/{userId}/{uuid}-{sanitizedFilename}.ext"
  const fileKey = generateFileKey("documents", originalFileName, dbUserId);
  const fileUrl = `${STORAGE_BASE_URL}/${fileKey}`;

  logger.info("Creating professional document", {
    correlationId,
    userId: dbUserId,
    type,
  });

  return executeResilient(
    async () => {
      // Update professional status to PENDING when documents are submitted
      await prisma.professionalProfile.update({
        where: { userId: dbUserId },
        data: {
          verificationStatus: "PENDING",
          submittedAt: new Date(),
        },
      });

      const document = await prisma.professionalDocument.create({
        data: {
          professionalId: dbUserId,
          url: fileUrl,
          fileKey: fileKey || "",
          type,
          verified: false,
          mimeType: mimeType,
          size: size,
        },
      });

      logger.info("Professional document created successfully", {
        correlationId,
        userId: dbUserId,
        documentId: document.id,
      });

      return { 
        data: document,
        meta: {
          uploadKey: fileKey,
          uploadUrl: fileUrl,
        } 
      };
    },
    {
      operationName: "create_professional_document",
      successStatus: HttpStatus.CREATED,
    }
  );
});
