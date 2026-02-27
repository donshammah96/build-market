import { NextRequest } from "next/server";
import { prisma } from "@build/db";
import { withAuth } from "@/app/lib/api/api-middleware";
import { apiError, apiSuccess, HttpStatus } from "@/app/lib/api/api-response";
import {
  initializeCorrelationId,
  getClientLogger,
} from "@/app/lib/api/resilient-api";
import {
  checkRateLimit,
  getRateLimitIdentifier,
  RateLimits,
} from "@/app/lib/api/rate-limit";
import { checkBodySize } from "@/app/lib/api/api-guards";
import { completeProfileSchema } from "@/app/lib/validation/profile-validation";
import { IdempotencyService } from "@/app/lib/services/idempotency.service";
import { createStoresBatch, CreateStoreInput } from "@/lib/services/stores";
import {
  createPropertiesBatch,
  CreatePropertyInput,
} from "@/lib/services/properties";

const logger = getClientLogger();

/**
 * POST /api/professional-portal/profile/complete
 * Completes the professional onboarding profile.
 * Handles Profile, Licenses, Documents, Stores, and Properties in one go.
 */
export const POST = withAuth(async (req: NextRequest, { dbUserId }) => {
  const correlationId = initializeCorrelationId(req);

  const sizeError = checkBodySize(req);
  if (sizeError) return sizeError;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("Invalid JSON body", HttpStatus.BAD_REQUEST);
  }

  const validation = completeProfileSchema.safeParse(body);
  if (!validation.success) {
    logger.warn("Profile completion validation failed", {
      correlationId,
      userId: dbUserId,
      errors: validation.error.issues,
    });
    return apiError(
      "Invalid input",
      HttpStatus.BAD_REQUEST,
      validation.error.issues,
    );
  }

  // Idempotency
  const idempotencyKey =
    req.headers.get("Idempotency-Key") ||
    IdempotencyService.generateKey(dbUserId, "POST", {
      scope: "complete-profile",
      ...validation.data,
    });

  const idempotencyCheck = await IdempotencyService.checkOrCreate(
    idempotencyKey,
    "complete-profile",
    dbUserId,
    "POST",
  );

  if (!idempotencyCheck) {
    return apiError(
      "Failed to process idempotency key",
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }

  if (idempotencyCheck.status === "completed") {
    return apiSuccess(idempotencyCheck.response, HttpStatus.OK);
  }

  if (idempotencyCheck.status === "pending") {
    return apiError(
      "Request is being processed. Please wait.",
      HttpStatus.CONFLICT,
    );
  }

  const identifier = getRateLimitIdentifier(req);
  const rateLimitResult = await checkRateLimit(
    `profile-write:${identifier}`,
    RateLimits.WRITE.limit,
    RateLimits.WRITE.window,
  );

  if (!rateLimitResult.success) {
    await IdempotencyService.fail(idempotencyKey);
    return apiError(
      "Too many requests. Please try again later.",
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }

  const {
    profession,
    companyName,
    yearsExperience,
    website,
    bio,
    certificatesUrls,
    idDocumentsUrls,
    storeData,
    propertyData,
    license,
  } = validation.data;

  try {
    await prisma.$transaction(async (tx) => {
      // 1. Update Professional Profile
      await tx.professionalProfile.update({
        where: { userId: dbUserId },
        data: {
          companyName,
          bio,
          website,
          yearsExperience,
          profession: profession ?? "OTHER",
          verified: false,
          verificationStatus: "PENDING",
        },
      });

      // 2. Handle License
      if (license && license.licenseNumber) {
        await tx.professionalLicense.upsert({
          where: {
            professionalId_authority_licenseNumber: {
              professionalId: dbUserId,
              authority: license.authority,
              licenseNumber: license.licenseNumber,
            },
          },
          update: { validFrom: new Date(), status: "PENDING" },
          create: {
            professionalId: dbUserId,
            authority: license.authority,
            licenseNumber: license.licenseNumber,
            validFrom: new Date(),
            status: "PENDING",
          },
        });
      }

      // 3. Handle Documents - Certificates
      if (certificatesUrls && certificatesUrls.length > 0) {
        for (let i = 0; i < certificatesUrls.length; i++) {
          await tx.professionalDocument.create({
            data: {
              professionalId: dbUserId,
              category: "EDUCATION_CERT",
              title: `Professional Certificate ${i + 1}`,
              issuer: "Self-reported",
              fileUrl: certificatesUrls[i],
              status: "PENDING",
            },
          });
        }
      }

      // 4. Handle Documents - ID
      if (idDocumentsUrls && idDocumentsUrls.length > 0) {
        for (let i = 0; i < idDocumentsUrls.length; i++) {
          await tx.professionalDocument.create({
            data: {
              professionalId: dbUserId,
              category: "ID_OR_PASSPORT",
              title: `ID Document ${i + 1}`,
              issuer: "Government/Official",
              fileUrl: idDocumentsUrls[i],
              status: "PENDING",
            },
          });
        }
      }
    });

    // 5. Create stores outside transaction (manager controls its own TX)
    if (storeData && storeData.length > 0) {
      await createStoresBatch(dbUserId, storeData as CreateStoreInput[]);
    }

    // 6. Create properties outside transaction
    if (propertyData && propertyData.length > 0) {
      await createPropertiesBatch(
        dbUserId,
        propertyData as CreatePropertyInput[],
      );
    }

    await IdempotencyService.complete(idempotencyKey, { success: true });

    logger.info("Professional profile completed successfully", {
      correlationId,
      userId: dbUserId,
    });

    return apiSuccess({ success: true }, HttpStatus.OK);
  } catch (error) {
    logger.error(
      "Failed to complete professional profile",
      error instanceof Error
        ? error
        : new Error(String(error) || "Unknown error"),
      {
        correlationId,
        userId: dbUserId,
      },
    );
    await IdempotencyService.fail(idempotencyKey);
    return apiError(
      "Failed to complete profile",
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }
});
