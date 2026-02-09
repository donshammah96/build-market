import { NextRequest } from "next/server";
import { prisma } from "@build/db";
import { z } from "zod";
import { withAuth } from "@/app/lib/api-middleware";
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

const createCertificateSchema = z.object({
  name: z.string().min(1, "Certificate name is required"),
  issuer: z.string().min(1, "Issuer is required"),
  issueDate: z.string().datetime().optional().nullable(),
  expiryDate: z.string().datetime().optional().nullable(),
  fileUrl: z.string().url("Invalid file URL"),
  fileKey: z.string().optional(),
});

/**
 * GET /api/professional-portal/certificates
 * Get all certificates for the authenticated professional
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

  logger.info("Fetching professional certificates", {
    correlationId,
    userId: dbUserId,
  });

  return executeResilient(
    async () => {
      const certificates = await prisma.certificate.findMany({
        where: { professionalId: dbUserId },
        orderBy: { createdAt: "desc" },
      });

      logger.info("Professional certificates fetched successfully", {
        correlationId,
        userId: dbUserId,
        count: certificates.length,
      });

      return { data: certificates };
    },
    {
      operationName: "get_professional_certificates",
      successStatus: HttpStatus.OK,
    }
  );
});

/**
 * POST /api/professional-portal/certificates
 * Create a new certificate for the authenticated professional
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
  const validation = createCertificateSchema.safeParse(body);

  if (!validation.success) {
    logger.warn("Certificate creation validation failed", {
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

  const { name, issuer, issueDate, expiryDate, fileUrl, fileKey } =
    validation.data;

  logger.info("Creating professional certificate", {
    correlationId,
    userId: dbUserId,
    name,
  });

  return executeResilient(
    async () => {
      const certificate = await prisma.certificate.create({
        data: {
          professionalId: dbUserId,
          name,
          issuer,
          issueDate: issueDate ? new Date(issueDate) : null,
          expiryDate: expiryDate ? new Date(expiryDate) : null,
          fileUrl,
          fileKey: fileKey || "",
          verificationStatus: "pending",
        },
      });

      logger.info("Professional certificate created successfully", {
        correlationId,
        userId: dbUserId,
        certificateId: certificate.id,
      });

      return { data: certificate };
    },
    {
      operationName: "create_professional_certificate",
      successStatus: HttpStatus.CREATED,
    }
  );
});
