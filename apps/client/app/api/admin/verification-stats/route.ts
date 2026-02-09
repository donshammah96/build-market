/**
 * GET /api/admin/verification-stats
 * Get verification statistics and metrics
 * Requires admin role
 */

import { NextRequest } from "next/server";
import { prisma } from "@build/db";
import { withRole } from "@/app/lib/api-middleware";
import { apiSuccess, HttpStatus } from "@/app/lib/api-response";
import {
  initializeCorrelationId,
  executeResilient,
  getClientLogger,
} from "@/app/lib/resilient-api";
import {
  checkRateLimit,
  RateLimits,
  getRateLimitIdentifier,
} from "@/app/lib/rate-limit";

const logger = getClientLogger();

/**
 * GET handler for verification statistics
 * Query params:
 * - period: today | week | month | all (default: all)
 */
export const GET = withRole(["admin"])(
  async (req: NextRequest, { dbUserId }) => {
    const correlationId = initializeCorrelationId(req);

    const identifier = getRateLimitIdentifier(req);
    const { success } = await checkRateLimit(
      identifier,
      RateLimits.READ.limit,
      RateLimits.READ.window
    );

    if (!success) {
      return apiSuccess({ data: {} }, HttpStatus.TOO_MANY_REQUESTS);
    }

    logger.info("Fetching verification statistics", {
      correlationId,
      adminId: dbUserId,
    });

    return executeResilient(
      async () => {
        const period = req.nextUrl.searchParams.get("period") || "all";

        // Calculate date filter
        let dateFilter: Date | undefined;
        const now = new Date();

        switch (period) {
          case "today":
            dateFilter = new Date(now.setHours(0, 0, 0, 0));
            break;
          case "week":
            dateFilter = new Date(now.setDate(now.getDate() - 7));
            break;
          case "month":
            dateFilter = new Date(now.setDate(now.getDate() - 30));
            break;
          default:
            dateFilter = undefined;
        }

        const whereClause = dateFilter
          ? { createdAt: { gte: dateFilter } }
          : {};

        // Fetch professional stats
        const [
          totalProfessionals,
          verifiedProfessionals,
          pendingProfessionals,
          rejectedProfessionals,
          needsCorrectionProfessionals,
        ] = await Promise.all([
          prisma.professionalProfile.count({ where: whereClause }),
          prisma.professionalProfile.count({
            where: { ...whereClause, verificationStatus: "VERIFIED" },
          }),
          prisma.professionalProfile.count({
            where: { ...whereClause, verificationStatus: "PENDING" },
          }),
          prisma.professionalProfile.count({
            where: { ...whereClause, verificationStatus: "REJECTED" },
          }),
          prisma.professionalProfile.count({
            where: { ...whereClause, verificationStatus: "NEEDS_CORRECTION" },
          }),
          prisma.professionalProfile.count({
            where: { ...whereClause, verificationStatus: "REJECTED"}
          })
        ]);

        // Fetch store stats
        const [
          totalStores,
          verifiedStores,
          pendingStores,
          rejectedStores,
          needsCorrectionStores,
        ] = await Promise.all([
          prisma.store.count({ where: whereClause }),
          prisma.store.count({
            where: { ...whereClause, verificationStatus: "VERIFIED" },
          }),
          prisma.store.count({
            where: { ...whereClause, verificationStatus: "PENDING" },
          }),
          prisma.store.count({
            where: { ...whereClause, verificationStatus: "REJECTED" },
          }),
          prisma.store.count({
            where: { ...whereClause, verificationStatus: "NEEDS_CORRECTION" },
          }),
          prisma.store.count({
            where: { ...whereClause, verificationStatus: "UNVERIFIED"}
          }),
        ]);

        // Fetch property stats
        const [
          totalProperties,
          verifiedProperties,
          pendingProperties,
          rejectedProperties,
          needsCorrectionProperties,
        ] = await Promise.all([
          prisma.property.count({ where: whereClause }),
          prisma.property.count({
            where: { ...whereClause, verificationStatus: "VERIFIED" },
          }),
          prisma.property.count({
            where: { ...whereClause, verificationStatus: "PENDING" },
          }),
          prisma.property.count({
            where: { ...whereClause, verificationStatus: "REJECTED" },
          }),
          prisma.property.count({
            where: { ...whereClause, verificationStatus: "NEEDS_CORRECTION" },
          }),
          prisma.property.count({
            where: { ...whereClause, verificationStatus: "UNVERIFIED"}
          }),
        ]);

        // Fetch document stats
        const [
          totalProfessionalDocs,
          verifiedProfessionalDocs,
          totalCertificates,
          verifiedCertificates,
          totalPropertyAttachments,
          verifiedPropertyAttachments,
        ] = await Promise.all([
          prisma.professionalDocument.count({ where: whereClause }),
          prisma.professionalDocument.count({
            where: { ...whereClause, verified: true },
          }),
          prisma.certificate.count({ where: whereClause }),
          prisma.certificate.count({
            where: { ...whereClause, verificationStatus: "verified" },
          }),
          prisma.propertyAttachment.count({ where: whereClause }),
          prisma.propertyAttachment.count({
            where: { ...whereClause, isVerified: true },
          }),
        ]);

        // Fetch recent admin activity
        const recentActivity = await prisma.adminAuditLog.findMany({
          where: dateFilter ? { createdAt: { gte: dateFilter } } : {},
          include: {
            admin: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
          orderBy: { createdAt: "desc" },
          take: 10,
        });

        // Calculate pending items needing immediate attention
        const urgentPending = await prisma.professionalProfile.count({
          where: {
            verificationStatus: "PENDING",
            submittedAt: {
              lte: new Date(Date.now() - 48 * 60 * 60 * 1000), // Older than 48 hours
            },
          },
        });

        // Calculate average verification time (verified items only)
        const verifiedWithSubmission = await prisma.professionalProfile.findMany(
          {
            where: {
              verificationStatus: "VERIFIED",
              submittedAt: { not: null },
              verifiedAt: { not: null },
            },
            select: {
              submittedAt: true,
              verifiedAt: true,
            },
            take: 100, // Sample last 100
          }
        );

        const avgVerificationTimeMs =
          verifiedWithSubmission.length > 0
            ? verifiedWithSubmission.reduce((sum, item) => {
                const diff =
                  new Date(item.verifiedAt!).getTime() -
                  new Date(item.submittedAt!).getTime();
                return sum + diff;
              }, 0) / verifiedWithSubmission.length
            : 0;

        const avgVerificationTimeHours = avgVerificationTimeMs / (1000 * 60 * 60);

        const stats = {
          overview: {
            totalPending:
              pendingProfessionals + pendingStores + pendingProperties,
            totalVerified:
              verifiedProfessionals + verifiedStores + verifiedProperties,
            totalRejected:
              rejectedProfessionals + rejectedStores + rejectedProperties,
            totalNeedsCorrection:
              needsCorrectionProfessionals +
              needsCorrectionStores +
              needsCorrectionProperties,
            urgentPending,
            avgVerificationTimeHours: Math.round(avgVerificationTimeHours * 10) / 10,
          },
          professionals: {
            total: totalProfessionals,
            verified: verifiedProfessionals,
            pending: pendingProfessionals,
            rejected: rejectedProfessionals,
            needsCorrection: needsCorrectionProfessionals,
            verificationRate:
              totalProfessionals > 0
                ? Math.round((verifiedProfessionals / totalProfessionals) * 100)
                : 0,
          },
          stores: {
            total: totalStores,
            verified: verifiedStores,
            pending: pendingStores,
            rejected: rejectedStores,
            needsCorrection: needsCorrectionStores,
            verificationRate:
              totalStores > 0
                ? Math.round((verifiedStores / totalStores) * 100)
                : 0,
          },
          properties: {
            total: totalProperties,
            verified: verifiedProperties,
            pending: pendingProperties,
            rejected: rejectedProperties,
            needsCorrection: needsCorrectionProperties,
            verificationRate:
              totalProperties > 0
                ? Math.round((verifiedProperties / totalProperties) * 100)
                : 0,
          },
          documents: {
            professionalDocuments: {
              total: totalProfessionalDocs,
              verified: verifiedProfessionalDocs,
            },
            certificates: {
              total: totalCertificates,
              verified: verifiedCertificates,
            },
            propertyAttachments: {
              total: totalPropertyAttachments,
              verified: verifiedPropertyAttachments,
            },
          },
          recentActivity: recentActivity.map((log) => ({
            id: log.id,
            action: log.action,
            entityType: log.entityType,
            entityId: log.entityId,
            admin: log.admin,
            createdAt: log.createdAt,
          })),
          period,
        };

        logger.info("Verification statistics fetched successfully", {
          correlationId,
          adminId: dbUserId,
          period,
        });

        return { data: stats };
      },
      {
        operationName: "get_verification_stats",
        successStatus: HttpStatus.OK,
      }
    );
  }
);
