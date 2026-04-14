import { prisma, Prisma } from "@build/db";
import { ConsentType, County } from "@prisma/client";
import { ConsentService } from "@/app/lib/gdpr/services/consent.service";
import { ExportService } from "@/app/lib/gdpr/services/export.service";
import { AnonymizationService } from "@/app/lib/gdpr/services/anonymization.service";
import {
  err,
  ok,
  type DomainError,
  type Result,
} from "@/app/lib/errors/result";
import type { UserProfileActor } from "./service";

/**
 * ADR-005 observable operationName inventory (user-rights adapters):
 * - update_user_consent (POST /api/user/consent)
 * - fetch_user_consents (GET /api/user/consent)
 * - bulk_update_user_consents (PUT /api/user/consent)
 * - request_data_export (POST /api/user/export)
 * - fetch_export_status (GET /api/user/export?id=...)
 * - list_user_exports (GET /api/user/export)
 * - request_account_deletion (POST /api/user/deletion)
 * - fetch_deletion_status (GET /api/user/deletion)
 * - cancel_account_deletion (PATCH /api/user/deletion)
 * - user_data_rectification (POST /api/user/rectification)
 * - fetch_rectification_history (GET /api/user/rectification)
 */

export type UserProfileComplianceErrorCode =
  | "not_found"
  | "forbidden"
  | "bad_request"
  | "conflict"
  | "gone"
  | "internal";

export type UserProfileComplianceResult<T> = Result<
  T,
  DomainError<UserProfileComplianceErrorCode>
>;

export type ConsentUpdateInput = {
  type: ConsentType;
  granted: boolean;
  documentVersion?: string;
};

export type RectificationRequestInput = {
  firstName?: string;
  lastName?: string;
  displayName?: string;
  phone?: string;
  bio?: string;
  clientProfile?: {
    companyName?: string;
    companyRegistration?: string;
    kraPin?: string;
    address?: string;
    city?: string;
    county?: County;
    neighborhood?: string;
    landmark?: string;
    zipCode?: string;
  };
  professionalProfile?: {
    companyName?: string;
    bio?: string;
    businessEmail?: string;
    businessPhone?: string;
    website?: string | null;
    kraPin?: string;
    city?: string;
    county?: County;
    country?: string;
    insuranceProvider?: string;
    insurancePolicyNumber?: string;
    yearsExperience?: number;
  };
  reason?: string;
  supportingDocumentUrls?: string[];
};

function domainError(
  error: UserProfileComplianceErrorCode,
  message: string,
  status: number,
) {
  return err({ error, message, status });
}

export const userProfileComplianceService = {
  async updateConsent(input: {
    actor: UserProfileActor;
    consent: ConsentUpdateInput;
    ipAddress?: string;
  }): Promise<
    UserProfileComplianceResult<{
      success: true;
      consent: Awaited<ReturnType<typeof ConsentService.updateConsent>>;
      message: string;
      effectiveImmediately: true;
      documentVersion: string | null;
    }>
  > {
    const consent = await ConsentService.updateConsent(
      input.actor.userId,
      input.consent.type,
      input.consent.granted,
      input.ipAddress,
      input.consent.documentVersion,
    );

    return ok({
      success: true,
      consent,
      message: input.consent.granted
        ? `Consent granted for ${input.consent.type}`
        : `Consent withdrawn for ${input.consent.type}`,
      effectiveImmediately: true,
      documentVersion: input.consent.documentVersion || null,
    });
  },

  async getConsents(actor: UserProfileActor): Promise<
    UserProfileComplianceResult<{
      success: true;
      consents: Awaited<ReturnType<typeof ConsentService.getUserConsents>>;
      total: number;
    }>
  > {
    const consents = await ConsentService.getUserConsents(actor.userId);
    return ok({
      success: true,
      consents,
      total: Array.isArray(consents) ? consents.length : 0,
    });
  },

  async bulkUpdateConsents(input: {
    actor: UserProfileActor;
    consents: ConsentUpdateInput[];
    ipAddress?: string;
  }): Promise<
    UserProfileComplianceResult<{
      success: boolean;
      message: string;
      results: Array<{
        type: ConsentType;
        granted: boolean;
        success: boolean;
      }>;
    }>
  > {
    try {
      const results = await prisma.$transaction(
        async (tx) => {
          const actor = await tx.user.findUnique({
            where: { id: input.actor.userId },
            select: {
              email: true,
              firstName: true,
              lastName: true,
            },
          });

          if (!actor) {
            throw new Error("USER_NOT_FOUND");
          }

          const transactionResults: Array<{
            type: ConsentType;
            granted: boolean;
            success: boolean;
          }> = [];

          for (const consent of input.consents) {
            try {
              const consentRecord = await tx.consentRecord.upsert({
                where: {
                  userId_type: {
                    userId: input.actor.userId,
                    type: consent.type,
                  },
                },
                update: {
                  granted: consent.granted,
                  withdrawnAt: consent.granted ? null : new Date(),
                  grantedAt: consent.granted ? new Date() : undefined,
                  ipAddress: input.ipAddress,
                  documentVersion: consent.documentVersion ?? "v1.0",
                },
                create: {
                  userId: input.actor.userId,
                  type: consent.type,
                  granted: consent.granted,
                  grantedAt: new Date(),
                  withdrawnAt: consent.granted ? null : new Date(),
                  ipAddress: input.ipAddress,
                  documentVersion: consent.documentVersion ?? "v1.0",
                },
              });

              const userUpdates: Prisma.UserUpdateInput = {};
              if (consent.type === "MARKETING_EMAIL") {
                userUpdates.emailMarketingConsent = consent.granted;
                userUpdates.marketingConsent = consent.granted;
              }
              if (consent.type === "MARKETING_SMS") {
                userUpdates.smsMarketingConsent = consent.granted;
              }
              if (consent.type === "ANALYTICS_COOKIES") {
                userUpdates.analyticsConsent = consent.granted;
              }

              if (Object.keys(userUpdates).length > 0) {
                if (
                  !consent.granted &&
                  (consent.type === "MARKETING_EMAIL" ||
                    consent.type === "MARKETING_SMS")
                ) {
                  userUpdates.marketingConsentWithdrawnAt = new Date();
                }

                await tx.user.update({
                  where: { id: input.actor.userId },
                  data: userUpdates,
                });
              }

              await tx.auditLog.create({
                data: {
                  actorId: input.actor.userId,
                  actorType: "USER",
                  actorEmail: actor.email,
                  actorFirstName: actor.firstName,
                  actorLastName: actor.lastName,
                  action: consent.granted
                    ? "CONSENT_GRANTED"
                    : "CONSENT_WITHDRAWN",
                  entityType: "ConsentRecord",
                  entityId: consentRecord.id,
                  legalBasis: "CONSENT",
                  consentId: consentRecord.id,
                  metadata: {
                    type: consent.type,
                    ipAddress: input.ipAddress,
                    documentVersion: consent.documentVersion ?? "v1.0",
                    correlationId: input.actor.correlationId,
                    source: "bulk_update_consents",
                  },
                },
              });

              transactionResults.push({
                type: consent.type,
                granted: consent.granted,
                success: true,
              });
            } catch {
              throw new Error(`CONSENT_UPDATE_FAILED:${consent.type}`);
            }
          }

          return transactionResults;
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        },
      );

      return ok({
        success: true,
        message: `All ${results.length} consent preferences have been saved`,
        results,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";

      if (message === "USER_NOT_FOUND") {
        return domainError("not_found", "User not found", 404);
      }

      if (message.startsWith("CONSENT_UPDATE_FAILED:")) {
        const failedType = message.split(":")[1] ?? "UNKNOWN";
        return domainError(
          "internal",
          `Failed to update consent preferences atomically (failed at ${failedType})`,
          500,
        );
      }

      return domainError(
        "internal",
        "Failed to update consent preferences atomically",
        500,
      );
    }
  },

  async requestExport(input: {
    actor: UserProfileActor;
    ipAddress: string;
    userAgent: string;
  }): Promise<
    UserProfileComplianceResult<{
      success: true;
      exportId: string;
      status: string;
      message: string;
      jobId: string | number | undefined;
    }>
  > {
    const exportResult = await ExportService.requestExport(
      input.actor.userId,
      input.ipAddress,
      input.userAgent,
    );

    if (!exportResult.success) {
      const status = exportResult.message.includes("one export per day")
        ? 429
        : exportResult.message.includes("in progress")
          ? 409
          : 400;
      return domainError("conflict", exportResult.message, status);
    }

    const exportStatus: string = exportResult.status ?? "PENDING";

    return ok({
      success: true,
      exportId: exportResult.exportId,
      status: exportStatus,
      message: exportResult.message,
      jobId: exportResult.jobId,
    });
  },

  async getExportStatus(input: {
    actor: UserProfileActor;
    exportId?: string;
  }): Promise<UserProfileComplianceResult<Record<string, unknown>>> {
    if (!input.exportId) {
      const exports = await ExportService.listUserExports(input.actor.userId);
      return ok({
        success: true,
        exports,
        total: Array.isArray(exports) ? exports.length : 0,
      });
    }

    const exportData = await ExportService.getExportStatus(
      input.exportId,
      input.actor.userId,
    );

    if (!exportData) {
      return domainError(
        "not_found",
        "Export not found or you don't have permission to access it",
        404,
      );
    }

    const response: Record<string, unknown> = {
      success: true,
      exportId: exportData.id,
      status: exportData.status,
      requestedAt: exportData.requestedAt,
      expiresAt: exportData.expiresAt,
      downloadedAt: exportData.downloadedAt,
    };

    if (
      exportData.status === "READY" &&
      exportData.fileUrl &&
      exportData.expiresAt &&
      new Date(exportData.expiresAt) > new Date()
    ) {
      response.downloadUrl = exportData.fileUrl;
      response.fileSizeBytes = exportData.fileSize;
      response.message = "Your export is ready for download.";
      response.expiresInHours = Math.max(
        0,
        Math.floor(
          (new Date(exportData.expiresAt).getTime() - Date.now()) /
            1000 /
            60 /
            60,
        ),
      );
    } else if (exportData.status === "PENDING") {
      response.message =
        "Your export is queued and will begin processing soon.";
      response.estimatedCompletionMinutes = 15;
    } else if (exportData.status === "PROCESSING") {
      response.message =
        "Your export is being processed. Please check back in a few minutes.";
      response.estimatedCompletionMinutes = 10;
    } else if (exportData.status === "FAILED") {
      response.message =
        "Your export failed to process. Please request a new export.";
    } else if (exportData.status === "EXPIRED") {
      response.message =
        "Your export link has expired. Please request a new export.";
    } else if (exportData.status === "CANCELLED") {
      response.message = "Your export request was cancelled.";
    }

    return ok(response);
  },

  async submitRectification(input: {
    actor: UserProfileActor;
    data: RectificationRequestInput;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<
    UserProfileComplianceResult<{
      success: true;
      message: string;
      changedFields: string[];
      changes: Record<string, { updated: boolean }>;
      processedAt: string;
      correlationId?: string;
    }>
  > {
    try {
      const result = await prisma.$transaction(async (tx) => {
        const user = await tx.user.findUnique({
          where: { id: input.actor.userId },
          include: {
            clientProfile: true,
            professionalProfile: true,
          },
        });

        if (!user) {
          throw new Error("USER_NOT_FOUND");
        }

        if (
          user.status === "SUSPENDED" ||
          user.status === "BANNED" ||
          user.status === "ARCHIVED"
        ) {
          throw new Error("ACCOUNT_RESTRICTED");
        }

        if (user.anonymizedAt) {
          throw new Error("ACCOUNT_ANONYMIZED");
        }

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
        const userUpdateData: Prisma.UserUpdateInput = {};

        if (
          input.data.firstName !== undefined &&
          input.data.firstName !== user.firstName
        ) {
          userUpdateData.firstName = input.data.firstName;
          changedFields.push("firstName");
          changes.firstName = {
            old: user.firstName,
            new: input.data.firstName,
          };
        }
        if (
          input.data.lastName !== undefined &&
          input.data.lastName !== user.lastName
        ) {
          userUpdateData.lastName = input.data.lastName;
          changedFields.push("lastName");
          changes.lastName = { old: user.lastName, new: input.data.lastName };
        }
        if (
          input.data.displayName !== undefined &&
          input.data.displayName !== user.displayName
        ) {
          userUpdateData.displayName = input.data.displayName;
          changedFields.push("displayName");
          changes.displayName = {
            old: user.displayName,
            new: input.data.displayName,
          };
        }
        if (input.data.phone !== undefined && input.data.phone !== user.phone) {
          userUpdateData.phone = input.data.phone;
          userUpdateData.isPhoneVerified = false;
          userUpdateData.phoneVerifiedAt = null;
          changedFields.push("phone");
          changes.phone = { old: "[MASKED]", new: "[UPDATED]" };
        }
        if (input.data.bio !== undefined && input.data.bio !== user.bio) {
          userUpdateData.bio = input.data.bio;
          changedFields.push("bio");
          changes.bio = { old: "[PRESENT]", new: "[UPDATED]" };
        }

        if (Object.keys(userUpdateData).length > 0) {
          await tx.user.update({
            where: { id: input.actor.userId },
            data: userUpdateData,
          });
        }

        if (
          input.data.clientProfile &&
          user.clientProfile &&
          user.role === "CLIENT"
        ) {
          const clientUpdateData: Prisma.ClientProfileUpdateInput = {};
          const clientData = input.data.clientProfile;
          const assignClient = <K extends keyof typeof clientData>(
            key: K,
            field: string,
            masked = false,
          ) => {
            const value = clientData[key];
            if (value !== undefined) {
              (clientUpdateData as Record<string, unknown>)[key as string] =
                value;
              changedFields.push(field);
              changes[field] = {
                old: masked
                  ? "[MASKED]"
                  : (user.clientProfile as Record<string, unknown>)[
                      key as string
                    ],
                new: masked ? "[UPDATED]" : value,
              };
            }
          };
          assignClient("companyName", "clientProfile.companyName");
          assignClient(
            "companyRegistration",
            "clientProfile.companyRegistration",
            true,
          );
          assignClient("kraPin", "clientProfile.kraPin", true);
          assignClient("address", "clientProfile.address");
          assignClient("city", "clientProfile.city");
          assignClient("county", "clientProfile.county");
          assignClient("neighborhood", "clientProfile.neighborhood");
          assignClient("landmark", "clientProfile.landmark");
          assignClient("zipCode", "clientProfile.zipCode");

          if (Object.keys(clientUpdateData).length > 0) {
            await tx.clientProfile.update({
              where: { userId: input.actor.userId },
              data: clientUpdateData,
            });
          }
        }

        if (
          input.data.professionalProfile &&
          user.professionalProfile &&
          user.role === "PROFESSIONAL"
        ) {
          const professionalUpdateData: Prisma.ProfessionalProfileUpdateInput =
            {};
          const professionalData = input.data.professionalProfile;
          const assignProfessional = <K extends keyof typeof professionalData>(
            key: K,
            field: string,
            masked = false,
          ) => {
            const value = professionalData[key];
            if (value !== undefined) {
              (professionalUpdateData as Record<string, unknown>)[
                key as string
              ] = value;
              changedFields.push(field);
              changes[field] = {
                old: masked
                  ? "[MASKED]"
                  : (user.professionalProfile as Record<string, unknown>)[
                      key as string
                    ],
                new: masked ? "[UPDATED]" : value,
              };
            }
          };
          assignProfessional("companyName", "professionalProfile.companyName");
          assignProfessional("bio", "professionalProfile.bio", true);
          assignProfessional(
            "businessEmail",
            "professionalProfile.businessEmail",
          );
          assignProfessional(
            "businessPhone",
            "professionalProfile.businessPhone",
            true,
          );
          assignProfessional("website", "professionalProfile.website");
          assignProfessional("kraPin", "professionalProfile.kraPin", true);
          assignProfessional("city", "professionalProfile.city");
          assignProfessional("county", "professionalProfile.county");
          assignProfessional("country", "professionalProfile.country");
          assignProfessional(
            "insuranceProvider",
            "professionalProfile.insuranceProvider",
          );
          assignProfessional(
            "insurancePolicyNumber",
            "professionalProfile.insurancePolicyNumber",
            true,
          );
          assignProfessional(
            "yearsExperience",
            "professionalProfile.yearsExperience",
          );

          if (Object.keys(professionalUpdateData).length > 0) {
            await tx.professionalProfile.update({
              where: { userId: input.actor.userId },
              data: professionalUpdateData,
            });
          }
        }

        if (changedFields.length > 0) {
          await tx.auditLog.create({
            data: {
              actorId: input.actor.userId,
              actorType: "USER",
              actorEmail: user.email,
              actorFirstName: user.firstName,
              actorLastName: user.lastName,
              action: "DATA_RECTIFIED",
              entityType: "User",
              entityId: input.actor.userId,
              legalBasis: "GDPR_ARTICLE_16",
              changes: changes as Prisma.InputJsonValue,
              metadata: {
                changedFields,
                beforeSnapshot,
                reason: input.data.reason || "User-initiated correction",
                supportingDocuments: input.data.supportingDocumentUrls || [],
                ipAddress: input.ipAddress,
                userAgent: input.userAgent,
                requestedAt: new Date().toISOString(),
                correlationId: input.actor.correlationId,
              } as Prisma.InputJsonValue,
            },
          });
        }

        return { changedFields, changes };
      });

      return ok({
        success: true,
        message:
          result.changedFields.length > 0
            ? `Successfully updated ${result.changedFields.length} field(s)`
            : "No changes detected - all fields already match requested values",
        changedFields: result.changedFields,
        changes: Object.keys(result.changes).reduce(
          (acc, key) => {
            acc[key] = { updated: true };
            return acc;
          },
          {} as Record<string, { updated: boolean }>,
        ),
        processedAt: new Date().toISOString(),
        correlationId: input.actor.correlationId,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      if (message === "USER_NOT_FOUND") {
        return domainError("not_found", "User not found", 404);
      }
      if (message === "ACCOUNT_RESTRICTED") {
        return domainError(
          "forbidden",
          "Cannot modify data for suspended, banned, or archived accounts",
          403,
        );
      }
      if (message === "ACCOUNT_ANONYMIZED") {
        return domainError(
          "forbidden",
          "Cannot modify data for accounts undergoing GDPR deletion",
          403,
        );
      }
      return domainError(
        "internal",
        "Failed to process rectification request",
        500,
      );
    }
  },

  async getRectificationHistory(input: {
    actor: UserProfileActor;
    page: number;
    limit: number;
  }): Promise<
    UserProfileComplianceResult<{
      success: true;
      data: Array<Record<string, unknown>>;
      pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
        hasNextPage: boolean;
        hasPreviousPage: boolean;
      };
    }>
  > {
    const skip = (input.page - 1) * input.limit;
    const [rectifications, total] = await Promise.all([
      prisma.auditLog.findMany({
        where: {
          actorId: input.actor.userId,
          action: "DATA_RECTIFIED",
          entityType: "User",
          entityId: input.actor.userId,
        },
        orderBy: { createdAt: "desc" },
        take: input.limit,
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
          actorId: input.actor.userId,
          action: "DATA_RECTIFIED",
          entityType: "User",
          entityId: input.actor.userId,
        },
      }),
    ]);

    const history = rectifications.map((log) => {
      const metadata = log.metadata as Record<string, unknown>;
      const changes = log.changes as Record<string, unknown>;
      return {
        id: log.id,
        changedFields: metadata?.changedFields || [],
        reason: metadata?.reason || null,
        requestedAt: metadata?.requestedAt || log.createdAt,
        correlationId: metadata?.correlationId,
        ipAddress: metadata?.ipAddress,
        userAgent: metadata?.userAgent,
        changesCount: Object.keys(changes || {}).length,
        legalBasis: log.legalBasis,
        processedAt: log.createdAt,
      };
    });

    return ok({
      success: true,
      data: history,
      pagination: {
        page: input.page,
        limit: input.limit,
        total,
        totalPages: Math.ceil(total / input.limit),
        hasNextPage: input.page * input.limit < total,
        hasPreviousPage: input.page > 1,
      },
    });
  },

  async requestDeletion(input: {
    actor: UserProfileActor;
    reason?: string;
    confirmEmail?: string;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<UserProfileComplianceResult<Record<string, unknown>>> {
    if (input.confirmEmail) {
      const user = await prisma.user.findUnique({
        where: { id: input.actor.userId },
        select: { email: true },
      });

      if (!user) {
        return domainError("not_found", "User not found", 404);
      }

      if (user.email.toLowerCase() !== input.confirmEmail.toLowerCase()) {
        return domainError(
          "bad_request",
          "Email confirmation does not match your account email",
          400,
        );
      }
    }

    try {
      const deletionData = await AnonymizationService.deactivateUser(
        input.actor.userId,
        input.reason,
        input.ipAddress,
        input.userAgent,
      );

      return ok({
        success: true,
        message:
          "Your account has been deactivated and will be permanently deleted in 30 days.",
        scheduledDeletionAt: deletionData.scheduledDeletionAt,
        gracePeriodDays: 30,
        canCancelUntil: deletionData.scheduledDeletionAt,
        nextSteps: [
          "Your account is now deactivated",
          "You can still log in to cancel deletion within 30 days",
          "After 30 days, your personal data will be permanently anonymized",
          "Transaction history will be retained for 7 years (legal requirement)",
        ],
        supportEmail: "privacy/buildmarket.co.ke",
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      if (
        message.includes("active projects") ||
        message.includes("active escrow")
      ) {
        return domainError("conflict", message, 409);
      }
      return domainError("internal", "Failed to process deletion request", 500);
    }
  },

  async getDeletionStatus(
    actor: UserProfileActor,
  ): Promise<
    UserProfileComplianceResult<
      { success: true } & Awaited<
        ReturnType<typeof AnonymizationService.getDeletionStatus>
      >
    >
  > {
    try {
      const status = await AnonymizationService.getDeletionStatus(actor.userId);
      return ok({ success: true, ...status });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      if (message === "User not found") {
        return domainError("not_found", "User not found", 404);
      }
      return domainError("internal", "Failed to fetch deletion status", 500);
    }
  },

  async cancelDeletion(input: {
    actor: UserProfileActor;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<
    UserProfileComplianceResult<{
      success: true;
      message: string;
      status: "ACTIVE";
    }>
  > {
    const user = await prisma.user.findUnique({
      where: { id: input.actor.userId },
      select: {
        status: true,
        scheduledDeletionAt: true,
      },
    });

    if (!user) {
      return domainError("not_found", "User not found", 404);
    }
    if (user.status !== "DEACTIVATED" || !user.scheduledDeletionAt) {
      return domainError("bad_request", "No scheduled deletion to cancel", 400);
    }
    if (new Date() > user.scheduledDeletionAt) {
      return domainError(
        "gone",
        "Grace period has expired. Account deletion cannot be cancelled.",
        410,
      );
    }

    await AnonymizationService.reactivateUser(input.actor.userId);
    await prisma.auditLog.create({
      data: {
        actorId: input.actor.userId,
        actorType: "USER",
        action: "PROFILE_UPDATED",
        entityType: "User",
        entityId: input.actor.userId,
        metadata: {
          ipAddress: input.ipAddress,
          userAgent: input.userAgent,
          actionType: "DELETION_CANCELLED",
          description: "User cancelled scheduled account deletion",
        },
      },
    });

    return ok({
      success: true,
      message:
        "Account deletion has been cancelled. Your account is now active.",
      status: "ACTIVE",
    });
  },
};
