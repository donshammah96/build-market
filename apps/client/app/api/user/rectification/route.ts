/**
 * Right to Rectification API
 *
 * GDPR Article 16: Right to Rectification
 * Kenya Data Protection Act 2019: Section 38
 *
 * Allows data subjects to request correction of inaccurate personal data
 * and completion of incomplete personal data. Platform must respond within
 * 30 days (GDPR/DPA requirement).
 *
 * Features:
 * - Comprehensive audit logging (who, what, when, why, how)
 * - Support document uploads for verification
 * - Automated validation with business rules
 * - GDPR-compliant change tracking
 * - Resilient execution with retry/timeout
 * - Correlation IDs for distributed tracing
 *
 * POST /api/user/rectification - Submit rectification request
 * GET /api/user/rectification - Get rectification history
 */

import { NextRequest } from "next/server";
import { prisma } from "@build/db";
import { z } from "zod";
import { County, Prisma } from "@prisma/client";
import { withAuth } from "@/app/lib/api/api-middleware";
import { HttpStatus } from "@/app/lib/api/api-response";
import {
  apiError,
  apiSuccess,
  initializeCorrelationId,
  getClientLogger,
  getResilientExecutor,
} from "@/app/lib/api/resilient-api";
import {
  safeParseJsonBody,
  getRequestMetadata,
} from "@/app/lib/api/request-utils";

const logger = getClientLogger();
const executor = getResilientExecutor();

// Comprehensive validation schema for rectification requests
const RectificationRequestSchema = z.object({
  // Core Personal Information (User model)
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  displayName: z.string().min(1).max(200).optional(),
  phone: z
    .string()
    .regex(/^\+254[17]\d{8}$/, "Phone must be valid Kenyan format (+254...)")
    .optional(),
  bio: z.string().max(5000).optional(),

  // Client Profile Fields
  clientProfile: z
    .object({
      companyName: z.string().max(200).optional(),
      companyRegistration: z.string().max(100).optional(),
      kraPin: z
        .string()
        .regex(/^[A-Z]\d{9}[A-Z]$/, "Invalid KRA PIN format")
        .optional(),
      address: z.string().max(500).optional(),
      city: z.string().max(100).optional(),
      county: z.nativeEnum(County).optional(),
      neighborhood: z.string().max(100).optional(),
      landmark: z.string().max(200).optional(),
      zipCode: z.string().max(20).optional(),
    })
    .optional(),

  // Professional Profile Fields
  professionalProfile: z
    .object({
      companyName: z.string().min(1).max(200).optional(),
      bio: z.string().max(5000).optional(),
      businessEmail: z.string().email().optional(),
      businessPhone: z
        .string()
        .regex(/^\+254[17]\d{8}$/, "Invalid phone format")
        .optional(),
      website: z.string().url().optional().nullable(),
      kraPin: z
        .string()
        .regex(/^[A-Z]\d{9}[A-Z]$/, "Invalid KRA PIN format")
        .optional(),
      city: z.string().max(100).optional(),
      county: z.nativeEnum(County).optional(),
      country: z.string().max(100).optional(),
      insuranceProvider: z.string().max(200).optional(),
      insurancePolicyNumber: z.string().max(100).optional(),
      yearsExperience: z.number().int().min(0).max(100).optional(),
    })
    .optional(),

  // Rectification Metadata (GDPR Requirement)
  reason: z
    .string()
    .min(10, "Please provide a detailed reason for rectification")
    .max(1000)
    .optional(),
  supportingDocumentUrls: z.array(z.string().url()).max(5).optional(),
});

/**
 * POST /api/user/rectification
 *
 * Submit a data rectification request with full GDPR compliance:
 * - Validates all changes against business rules
 * - Creates comprehensive audit trail (before/after snapshots)
 * - Tracks legal basis and consent IDs
 * - Records IP address, user agent, and request metadata
 * - Supports attachment of verification documents
 * - Implements resilient execution with retry logic
 *
 * Security:
 * - Prevents updates to suspended/banned/archived accounts
 * - Validates sensitive data format (KRA PIN, phone numbers)
 * - Masks sensitive data in audit logs
 * - Tracks all changes with actor attribution
 */
export const POST = withAuth(async (req: NextRequest, { dbUserId }) => {
  const correlationId = initializeCorrelationId(req);

  try {
    // Safe JSON parsing
    const parseResult = await safeParseJsonBody(req);
    if (!parseResult.success) {
      return apiError(
        parseResult.error || "Invalid JSON body",
        HttpStatus.BAD_REQUEST,
      );
    }

    const body = parseResult.data;

    logger.info("Rectification request received", {
      userId: dbUserId,
      correlationId,
      fieldsRequested: Object.keys(body || {}),
    });

    // Validate request body
    const validationResult = RectificationRequestSchema.safeParse(body);
    if (!validationResult.success) {
      logger.warn("Rectification validation failed", {
        userId: dbUserId,
        correlationId,
        errors: validationResult.error.issues,
      });
      return apiError(
        "Validation failed",
        HttpStatus.BAD_REQUEST,
        validationResult.error.issues,
      );
    }

    const data = validationResult.data;

    // Capture request metadata for audit using shared utility
    const { ipAddress, userAgent } = getRequestMetadata(req);

    // Execute rectification with resilience patterns
    const result = await executor.execute(
      async () => {
        return await prisma.$transaction(async (tx) => {
          // Fetch current user with all relevant data
          const user = await tx.user.findUnique({
            where: { id: dbUserId },
            include: {
              clientProfile: true,
              professionalProfile: true,
            },
          });

          if (!user) {
            throw new Error("USER_NOT_FOUND");
          }

          // Security: Prevent modifications to restricted accounts
          if (
            user.status === "SUSPENDED" ||
            user.status === "BANNED" ||
            user.status === "ARCHIVED"
          ) {
            throw new Error("ACCOUNT_RESTRICTED");
          }

          // Prevent changes to anonymized accounts (GDPR deletion in progress)
          if (user.anonymizedAt) {
            throw new Error("ACCOUNT_ANONYMIZED");
          }

          // Capture before-state snapshot (mask sensitive data)
          const beforeSnapshot = {
            user: {
              firstName: user.firstName,
              lastName: user.lastName,
              displayName: user.displayName,
              phone: user.phone ? "[PRESENT]" : null,
              bio: user.bio ? "[PRESENT]" : null,
            },
            clientProfile: user.clientProfile
              ? {
                  companyName: user.clientProfile.companyName,
                  companyRegistration: user.clientProfile.companyRegistration
                    ? "[PRESENT]"
                    : null,
                  kraPin: user.clientProfile.kraPin ? "[PRESENT]" : null,
                  address: user.clientProfile.address,
                  city: user.clientProfile.city,
                  county: user.clientProfile.county,
                  neighborhood: user.clientProfile.neighborhood,
                  landmark: user.clientProfile.landmark,
                  zipCode: user.clientProfile.zipCode,
                }
              : null,
            professionalProfile: user.professionalProfile
              ? {
                  companyName: user.professionalProfile.companyName,
                  bio: user.professionalProfile.bio ? "[PRESENT]" : null,
                  businessEmail: user.professionalProfile.businessEmail,
                  businessPhone: user.professionalProfile.businessPhone
                    ? "[PRESENT]"
                    : null,
                  website: user.professionalProfile.website,
                  kraPin: user.professionalProfile.kraPin ? "[PRESENT]" : null,
                  city: user.professionalProfile.city,
                  county: user.professionalProfile.county,
                  country: user.professionalProfile.country,
                  insuranceProvider: user.professionalProfile.insuranceProvider,
                  insurancePolicyNumber: user.professionalProfile
                    .insurancePolicyNumber
                    ? "[PRESENT]"
                    : null,
                  yearsExperience: user.professionalProfile.yearsExperience,
                }
              : null,
          };

          const changedFields: string[] = [];
          const changes: Record<string, { old: unknown; new: unknown }> = {};

          // Build User update data
          const userUpdateData: Prisma.UserUpdateInput = {};

          if (
            data.firstName !== undefined &&
            data.firstName !== user.firstName
          ) {
            userUpdateData.firstName = data.firstName;
            changedFields.push("firstName");
            changes.firstName = { old: user.firstName, new: data.firstName };
          }

          if (data.lastName !== undefined && data.lastName !== user.lastName) {
            userUpdateData.lastName = data.lastName;
            changedFields.push("lastName");
            changes.lastName = { old: user.lastName, new: data.lastName };
          }

          if (
            data.displayName !== undefined &&
            data.displayName !== user.displayName
          ) {
            userUpdateData.displayName = data.displayName;
            changedFields.push("displayName");
            changes.displayName = {
              old: user.displayName,
              new: data.displayName,
            };
          }

          if (data.phone !== undefined && data.phone !== user.phone) {
            userUpdateData.phone = data.phone;
            userUpdateData.isPhoneVerified = false; // Re-verification required
            userUpdateData.phoneVerifiedAt = null;
            changedFields.push("phone");
            changes.phone = { old: "[MASKED]", new: "[UPDATED]" };
          }

          if (data.bio !== undefined && data.bio !== user.bio) {
            userUpdateData.bio = data.bio;
            changedFields.push("bio");
            changes.bio = { old: "[PRESENT]", new: "[UPDATED]" };
          }

          // Update User if changes exist
          if (Object.keys(userUpdateData).length > 0) {
            await tx.user.update({
              where: { id: dbUserId },
              data: userUpdateData,
            });
          }

          // Update Client Profile if applicable
          if (
            data.clientProfile &&
            user.clientProfile &&
            user.role === "CLIENT"
          ) {
            const clientUpdateData: Prisma.ClientProfileUpdateInput = {};

            if (data.clientProfile.companyName !== undefined) {
              clientUpdateData.companyName = data.clientProfile.companyName;
              changedFields.push("clientProfile.companyName");
              changes["clientProfile.companyName"] = {
                old: user.clientProfile.companyName,
                new: data.clientProfile.companyName,
              };
            }

            if (data.clientProfile.companyRegistration !== undefined) {
              clientUpdateData.companyRegistration =
                data.clientProfile.companyRegistration;
              changedFields.push("clientProfile.companyRegistration");
              changes["clientProfile.companyRegistration"] = {
                old: "[MASKED]",
                new: "[UPDATED]",
              };
            }

            if (data.clientProfile.kraPin !== undefined) {
              clientUpdateData.kraPin = data.clientProfile.kraPin;
              changedFields.push("clientProfile.kraPin");
              changes["clientProfile.kraPin"] = {
                old: "[MASKED]",
                new: "[UPDATED]",
              };
            }

            if (data.clientProfile.address !== undefined) {
              clientUpdateData.address = data.clientProfile.address;
              changedFields.push("clientProfile.address");
              changes["clientProfile.address"] = {
                old: user.clientProfile.address,
                new: data.clientProfile.address,
              };
            }

            if (data.clientProfile.city !== undefined) {
              clientUpdateData.city = data.clientProfile.city;
              changedFields.push("clientProfile.city");
              changes["clientProfile.city"] = {
                old: user.clientProfile.city,
                new: data.clientProfile.city,
              };
            }

            if (data.clientProfile.county !== undefined) {
              clientUpdateData.county = data.clientProfile.county;
              changedFields.push("clientProfile.county");
              changes["clientProfile.county"] = {
                old: user.clientProfile.county,
                new: data.clientProfile.county,
              };
            }

            if (data.clientProfile.neighborhood !== undefined) {
              clientUpdateData.neighborhood = data.clientProfile.neighborhood;
              changedFields.push("clientProfile.neighborhood");
              changes["clientProfile.neighborhood"] = {
                old: user.clientProfile.neighborhood,
                new: data.clientProfile.neighborhood,
              };
            }

            if (data.clientProfile.landmark !== undefined) {
              clientUpdateData.landmark = data.clientProfile.landmark;
              changedFields.push("clientProfile.landmark");
              changes["clientProfile.landmark"] = {
                old: user.clientProfile.landmark,
                new: data.clientProfile.landmark,
              };
            }

            if (data.clientProfile.zipCode !== undefined) {
              clientUpdateData.zipCode = data.clientProfile.zipCode;
              changedFields.push("clientProfile.zipCode");
              changes["clientProfile.zipCode"] = {
                old: user.clientProfile.zipCode,
                new: data.clientProfile.zipCode,
              };
            }

            if (Object.keys(clientUpdateData).length > 0) {
              await tx.clientProfile.update({
                where: { userId: dbUserId },
                data: clientUpdateData,
              });
            }
          }

          // Update Professional Profile if applicable
          if (
            data.professionalProfile &&
            user.professionalProfile &&
            user.role === "PROFESSIONAL"
          ) {
            const professionalUpdateData: Prisma.ProfessionalProfileUpdateInput =
              {};

            if (data.professionalProfile.companyName !== undefined) {
              professionalUpdateData.companyName =
                data.professionalProfile.companyName;
              changedFields.push("professionalProfile.companyName");
              changes["professionalProfile.companyName"] = {
                old: user.professionalProfile.companyName,
                new: data.professionalProfile.companyName,
              };
            }

            if (data.professionalProfile.bio !== undefined) {
              professionalUpdateData.bio = data.professionalProfile.bio;
              changedFields.push("professionalProfile.bio");
              changes["professionalProfile.bio"] = {
                old: "[PRESENT]",
                new: "[UPDATED]",
              };
            }

            if (data.professionalProfile.businessEmail !== undefined) {
              professionalUpdateData.businessEmail =
                data.professionalProfile.businessEmail;
              changedFields.push("professionalProfile.businessEmail");
              changes["professionalProfile.businessEmail"] = {
                old: user.professionalProfile.businessEmail,
                new: data.professionalProfile.businessEmail,
              };
            }

            if (data.professionalProfile.businessPhone !== undefined) {
              professionalUpdateData.businessPhone =
                data.professionalProfile.businessPhone;
              changedFields.push("professionalProfile.businessPhone");
              changes["professionalProfile.businessPhone"] = {
                old: "[MASKED]",
                new: "[UPDATED]",
              };
            }

            if (data.professionalProfile.website !== undefined) {
              professionalUpdateData.website = data.professionalProfile.website;
              changedFields.push("professionalProfile.website");
              changes["professionalProfile.website"] = {
                old: user.professionalProfile.website,
                new: data.professionalProfile.website,
              };
            }

            if (data.professionalProfile.kraPin !== undefined) {
              professionalUpdateData.kraPin = data.professionalProfile.kraPin;
              changedFields.push("professionalProfile.kraPin");
              changes["professionalProfile.kraPin"] = {
                old: "[MASKED]",
                new: "[UPDATED]",
              };
            }

            if (data.professionalProfile.city !== undefined) {
              professionalUpdateData.city = data.professionalProfile.city;
              changedFields.push("professionalProfile.city");
              changes["professionalProfile.city"] = {
                old: user.professionalProfile.city,
                new: data.professionalProfile.city,
              };
            }

            if (data.professionalProfile.county !== undefined) {
              professionalUpdateData.county = data.professionalProfile.county;
              changedFields.push("professionalProfile.county");
              changes["professionalProfile.county"] = {
                old: user.professionalProfile.county,
                new: data.professionalProfile.county,
              };
            }

            if (data.professionalProfile.country !== undefined) {
              professionalUpdateData.country = data.professionalProfile.country;
              changedFields.push("professionalProfile.country");
              changes["professionalProfile.country"] = {
                old: user.professionalProfile.country,
                new: data.professionalProfile.country,
              };
            }

            if (data.professionalProfile.insuranceProvider !== undefined) {
              professionalUpdateData.insuranceProvider =
                data.professionalProfile.insuranceProvider;
              changedFields.push("professionalProfile.insuranceProvider");
              changes["professionalProfile.insuranceProvider"] = {
                old: user.professionalProfile.insuranceProvider,
                new: data.professionalProfile.insuranceProvider,
              };
            }

            if (data.professionalProfile.insurancePolicyNumber !== undefined) {
              professionalUpdateData.insurancePolicyNumber =
                data.professionalProfile.insurancePolicyNumber;
              changedFields.push("professionalProfile.insurancePolicyNumber");
              changes["professionalProfile.insurancePolicyNumber"] = {
                old: "[MASKED]",
                new: "[UPDATED]",
              };
            }

            if (data.professionalProfile.yearsExperience !== undefined) {
              professionalUpdateData.yearsExperience =
                data.professionalProfile.yearsExperience;
              changedFields.push("professionalProfile.yearsExperience");
              changes["professionalProfile.yearsExperience"] = {
                old: user.professionalProfile.yearsExperience,
                new: data.professionalProfile.yearsExperience,
              };
            }

            if (Object.keys(professionalUpdateData).length > 0) {
              await tx.professionalProfile.update({
                where: { userId: dbUserId },
                data: professionalUpdateData,
              });
            }
          }

          // Create comprehensive audit log (GDPR Article 30)
          if (changedFields.length > 0) {
            await tx.auditLog.create({
              data: {
                actorId: dbUserId,
                actorType: "USER",
                actorEmail: user.email,
                actorFirstName: user.firstName,
                actorLastName: user.lastName,
                action: "DATA_RECTIFIED",
                entityType: "User",
                entityId: dbUserId,
                legalBasis: "GDPR_ARTICLE_16", // Right to rectification
                changes: changes as Prisma.InputJsonValue,
                metadata: {
                  changedFields,
                  beforeSnapshot,
                  reason: data.reason || "User-initiated correction",
                  supportingDocuments: data.supportingDocumentUrls || [],
                  ipAddress,
                  userAgent,
                  requestedAt: new Date().toISOString(),
                  correlationId,
                } as Prisma.InputJsonValue,
              },
            });
          }

          return {
            changedFields,
            changes,
          };
        });
      },
      {
        timeout: "normal",
        retry: { maxAttempts: 2 },
        circuitBreaker: true,
        operationName: "user-data-rectification",
      },
    );

    if (!result.success) {
      const error = result.error;

      // Handle specific business errors
      if (error?.message === "USER_NOT_FOUND") {
        return apiError("User not found", HttpStatus.NOT_FOUND);
      }

      if (error?.message === "ACCOUNT_RESTRICTED") {
        logger.warn("Rectification blocked for restricted account", {
          userId: dbUserId,
          correlationId,
        });
        return apiError(
          "Cannot modify data for suspended, banned, or archived accounts",
          HttpStatus.FORBIDDEN,
        );
      }

      if (error?.message === "ACCOUNT_ANONYMIZED") {
        logger.warn("Rectification blocked for anonymized account", {
          userId: dbUserId,
          correlationId,
        });
        return apiError(
          "Cannot modify data for accounts undergoing GDPR deletion",
          HttpStatus.FORBIDDEN,
        );
      }

      logger.error(
        "Rectification failed",
        error || new Error("Unknown error"),
        {
          userId: dbUserId,
          correlationId,
        },
      );
      return apiError(
        "Failed to process rectification request",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    const { changedFields, changes } = result.data!;

    logger.info("Rectification completed successfully", {
      userId: dbUserId,
      correlationId,
      changedFieldsCount: changedFields.length,
      fields: changedFields,
    });

    return apiSuccess(
      {
        success: true,
        message:
          changedFields.length > 0
            ? `Successfully updated ${changedFields.length} field(s)`
            : "No changes detected - all fields already match requested values",
        changedFields,
        changes: Object.keys(changes).reduce(
          (acc, key) => {
            // Only return field names and update status, not actual values
            acc[key] = { updated: true };
            return acc;
          },
          {} as Record<string, { updated: boolean }>,
        ),
        processedAt: new Date().toISOString(),
        correlationId,
      },
      HttpStatus.OK,
    );
  } catch (err) {
    logger.error(
      "Rectification request error",
      err instanceof Error ? err : new Error(String(err)),
      {
        userId: dbUserId,
        correlationId,
      },
    );

    if (err instanceof z.ZodError) {
      return apiError("Validation failed", HttpStatus.BAD_REQUEST, err.issues);
    }

    return apiError(
      "Failed to process rectification request. Please try again.",
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }
});

/**
 * GET /api/user/rectification
 *
 * Retrieve history of data rectification requests for the authenticated user
 * Returns paginated audit trail with:
 * - Changed fields per request
 * - Timestamps and request metadata
 * - Reasons provided for rectification
 * - IP addresses and user agents (for security auditing)
 *
 * GDPR Article 30: Records of processing activities
 * Users have the right to see history of their data modifications
 */
export const GET = withAuth(async (req: NextRequest, { dbUserId }) => {
  const correlationId = initializeCorrelationId(req);

  try {
    logger.info("Fetching rectification history", {
      userId: dbUserId,
      correlationId,
    });

    // Parse pagination parameters
    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(
      50,
      Math.max(1, parseInt(searchParams.get("limit") || "10", 10)),
    );
    const skip = (page - 1) * limit;

    // Execute query with resilience
    const result = await executor.execute(
      async () => {
        const [rectifications, total] = await Promise.all([
          prisma.auditLog.findMany({
            where: {
              actorId: dbUserId,
              action: "DATA_RECTIFIED",
              entityType: "User",
              entityId: dbUserId,
            },
            orderBy: { createdAt: "desc" },
            take: limit,
            skip,
            select: {
              id: true,
              action: true,
              createdAt: true,
              metadata: true,
              changes: true,
              legalBasis: true,
            },
          }),
          prisma.auditLog.count({
            where: {
              actorId: dbUserId,
              action: "DATA_RECTIFIED",
              entityType: "User",
              entityId: dbUserId,
            },
          }),
        ]);

        return { rectifications, total };
      },
      {
        timeout: "normal",
        retry: { maxAttempts: 2 },
        circuitBreaker: true,
        operationName: "fetch-rectification-history",
      },
    );

    if (!result.success) {
      logger.error(
        "Failed to fetch rectification history",
        result.error || new Error("Unknown error"),
        { userId: dbUserId, correlationId },
      );
      return apiError(
        "Failed to fetch rectification history",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    const { rectifications, total } = result.data!;

    // Format response with GDPR-compliant data minimization
    const history = rectifications.map((log) => {
      const metadata = log.metadata as Record<string, unknown>;
      const changes = log.changes as Record<string, unknown>;

      return {
        id: log.id,
        changedFields: metadata?.changedFields || [],
        reason: metadata?.reason || null,
        requestedAt: metadata?.requestedAt || log.createdAt,
        correlationId: metadata?.correlationId,
        // Security info (user can see their own IPs for security monitoring)
        ipAddress: metadata?.ipAddress,
        userAgent: metadata?.userAgent,
        // Change summary (field names only, not values for privacy)
        changesCount: Object.keys(changes || {}).length,
        legalBasis: log.legalBasis,
        processedAt: log.createdAt,
      };
    });

    logger.info("Rectification history fetched", {
      userId: dbUserId,
      correlationId,
      recordsReturned: history.length,
      totalRecords: total,
    });

    return apiSuccess(
      {
        success: true,
        data: history,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          hasNextPage: page * limit < total,
          hasPreviousPage: page > 1,
        },
      },
      HttpStatus.OK,
    );
  } catch (err) {
    logger.error(
      "Rectification history error",
      err instanceof Error ? err : new Error(String(err)),
      {
        userId: dbUserId,
        correlationId,
      },
    );

    return apiError(
      "Failed to fetch rectification history. Please try again.",
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }
});
