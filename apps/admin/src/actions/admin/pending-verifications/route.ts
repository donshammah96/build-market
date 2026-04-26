// @ts-nocheck
/**
 * GET /api/admin/pending-verifications
 * Get list of pending verifications with filters
 * Requires admin role
 */

import { NextRequest } from "next/server";
import { AdminRole, prisma } from "@build/db";
import { AuthContext, withAdminRole } from "@/lib/api/api-middleware";
import { apiSuccess, HttpStatus } from "@/lib/api/api-response";
import {
  initializeCorrelationId,
  executeResilient,
  getClientLogger,
} from "@/lib/api/resilient-api";
import {
  checkRateLimit,
  RateLimits,
  getRateLimitIdentifier,
} from "@/lib/api/rate-limit";

const logger = getClientLogger();

/**
 * GET handler for pending verifications
 * Query params:
 * - entityType: professional | store | property | all (default: all)
 * - status: UNVERIFIED | PENDING | NEEDS_CORRECTION (default: PENDING)
 * - page: number (default: 1)
 * - limit: number (default: 20, max: 100)
 * - sortBy: submittedAt | createdAt (default: submittedAt)
 * - sortOrder: asc | desc (default: desc)
 */
export const GET = withAdminRole([AdminRole.SUPER_ADMIN])(async (
  req: NextRequest,
  context: AuthContext,
) => {
  const correlationId = initializeCorrelationId(req);
  const { dbUserId } = context;
  const identifier = getRateLimitIdentifier(req);
  const { success } = await checkRateLimit(
    identifier,
    RateLimits.READ.limit,
    RateLimits.READ.window,
  );

  if (!success) {
    return apiSuccess({ data: [] }, HttpStatus.TOO_MANY_REQUESTS);
  }

  logger.info("Fetching pending verifications", {
    correlationId,
    adminId: context.dbUserId,
  });

  return executeResilient(
    async () => {
      const searchParams = req.nextUrl.searchParams;
      const entityType = searchParams.get("entityType") || "all";
      const status = searchParams.get("status") || "PENDING";
      const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
      const limit = Math.min(
        100,
        Math.max(1, parseInt(searchParams.get("limit") || "20")),
      );
      const sortBy = searchParams.get("sortBy") || "submittedAt";
      const sortOrder = (searchParams.get("sortOrder") || "desc") as
        | "asc"
        | "desc";

      const skip = (page - 1) * limit;
      interface ProfessionalVerification {
        entityType: "professional";
        entityId: string;
        companyName: string;
        profession: string | null;
        verificationStatus: string | null;
        submittedAt: Date | null;
        createdAt: Date;
        user: {
          id: string;
          email: string;
          firstName: string | null;
          lastName: string | null;
          phone: string | null;
        };
        documentCount: number;
        certificateCount: number;
      }

      interface StoreVerification {
        entityType: "store";
        entityId: string;
        name: string;
        storeType: string;
        verificationStatus: string | null;
        submittedAt: Date | null;
        createdAt: Date;
        owner: {
          id: string;
          email: string;
          firstName: string | null;
          lastName: string | null;
          phone: string | null;
        };
        productCount: number;
        city: string | null;
        county: string | null;
      }

      interface PropertyVerification {
        entityType: "property";
        entityId: string;
        title: string;
        type: string;
        category: string;
        price: number;
        verificationStatus: string | null;
        submittedAt: Date | null;
        createdAt: Date;
        agent: {
          id: string;
          email: string;
          firstName: string | null;
          lastName: string | null;
          phone: string | null;
        };
        attachmentCount: number;
        imageCount: number;
        location: string | null;
        county: string | null;
      }

      type VerificationResult =
        | ProfessionalVerification
        | StoreVerification
        | PropertyVerification;

      let professionals: ProfessionalVerification[] = [];
      let stores: StoreVerification[] = [];
      let properties: PropertyVerification[] = [];
      let totalCount = 0;

      // Fetch based on entity type filter
      if (entityType === "all" || entityType === "professional") {
        const profWhere = {
          verificationStatus: status as any,
          ...(status === "PENDING" && { submittedAt: { not: null } }),
        };

        const [profData, profCount] = await Promise.all([
          prisma.professionalProfile.findMany({
            where: profWhere,
            include: {
              user: {
                select: {
                  id: true,
                  email: true,
                  firstName: true,
                  lastName: true,
                  phone: true,
                },
              },
              _count: {
                select: {
                  documents: true,
                  certificates: true,
                },
              },
            },
            orderBy: {
              [sortBy === "submittedAt" ? "submittedAt" : "createdAt"]:
                sortOrder,
            },
            skip: entityType === "professional" ? skip : 0,
            take: entityType === "professional" ? limit : undefined,
          }),
          prisma.professionalProfile.count({ where: profWhere }),
        ]);

        professionals = profData.map((p) => ({
          entityType: "professional",
          entityId: p.userId,
          companyName: p.companyName,
          profession: p.profession || "Unspecified",
          verificationStatus: p.verificationStatus || "UNVERIFIED",
          submittedAt: p.submittedAt,
          createdAt: p.createdAt,
          user: p.user,
          documentCount: p._count.documents,
          certificateCount: p._count.certificates,
        }));

        if (entityType === "professional") {
          totalCount = profCount;
        }
      }

      if (entityType === "all" || entityType === "store") {
        const storeWhere = {
          verificationStatus: status as any,
          ...(status === "PENDING" && { submittedAt: { not: null } }),
        };

        const [storeData, storeCount] = await Promise.all([
          prisma.store.findMany({
            where: storeWhere,
            include: {
              professional: {
                include: {
                  user: {
                    select: {
                      id: true,
                      email: true,
                      firstName: true,
                      lastName: true,
                      phone: true,
                    },
                  },
                },
              },
              _count: {
                select: {
                  products: true,
                },
              },
            },
            orderBy: {
              [sortBy === "submittedAt" ? "submittedAt" : "createdAt"]:
                sortOrder,
            },
            skip: entityType === "store" ? skip : 0,
            take: entityType === "store" ? limit : undefined,
          }),
          prisma.store.count({ where: storeWhere }),
        ]);

        stores = storeData.map((s) => ({
          entityType: "store",
          entityId: s.id,
          name: s.name,
          storeType: s.storeType,
          verificationStatus: s.verificationStatus,
          submittedAt: s.submittedAt,
          createdAt: s.createdAt,
          owner: s.professional.user,
          productCount: s._count.products,
          city: s.city,
          county: s.county,
        }));

        if (entityType === "store") {
          totalCount = storeCount;
        }
      }

      if (entityType === "all" || entityType === "property") {
        const propertyWhere = {
          verificationStatus: status as any,
          ...(status === "PENDING" && { submittedAt: { not: null } }),
        };

        const [propertyData, propertyCount] = await Promise.all([
          prisma.property.findMany({
            where: propertyWhere,
            include: {
              agent: {
                include: {
                  user: {
                    select: {
                      id: true,
                      email: true,
                      firstName: true,
                      lastName: true,
                      phone: true,
                    },
                  },
                },
              },
              _count: {
                select: {
                  attachments: true,
                  images: true,
                },
              },
            },
            orderBy: {
              [sortBy === "submittedAt" ? "submittedAt" : "createdAt"]:
                sortOrder,
            },
            skip: entityType === "property" ? skip : 0,
            take: entityType === "property" ? limit : undefined,
          }),
          prisma.property.count({ where: propertyWhere }),
        ]);

        properties = propertyData.map((p) => ({
          entityType: "property",
          entityId: p.id,
          title: p.title,
          type: p.type,
          category: p.category,
          price: p.price.toNumber(),
          verificationStatus: p.verificationStatus,
          submittedAt: p.submittedAt,
          createdAt: p.createdAt,
          agent: p.agent.user,
          attachmentCount: p._count.attachments,
          imageCount: p._count.images,
          location: p.location,
          county: p.county,
        }));

        if (entityType === "property") {
          totalCount = propertyCount;
        }
      }

      // Combine and sort if fetching all types
      let results: any[] = [];
      if (entityType === "all") {
        results = [...professionals, ...stores, ...properties];
        totalCount = results.length;

        // Sort combined results
        results.sort((a, b) => {
          const aDate = new Date(
            a[sortBy === "submittedAt" ? "submittedAt" : "createdAt"] || 0,
          );
          const bDate = new Date(
            b[sortBy === "submittedAt" ? "submittedAt" : "createdAt"] || 0,
          );
          return sortOrder === "desc"
            ? bDate.getTime() - aDate.getTime()
            : aDate.getTime() - bDate.getTime();
        });

        // Paginate combined results
        results = results.slice(skip, skip + limit);
      } else {
        results =
          entityType === "professional"
            ? professionals
            : entityType === "store"
              ? stores
              : properties;
      }

      logger.info("Pending verifications fetched successfully", {
        correlationId,
        adminId: dbUserId,
        entityType,
        status,
        count: results.length,
      });

      return {
        data: results,
        pagination: {
          page,
          limit,
          total: totalCount,
          totalPages: Math.ceil(totalCount / limit),
        },
        filters: {
          entityType,
          status,
          sortBy,
          sortOrder,
        },
      };
    },
    {
      operationName: "get_pending_verifications",
      successStatus: HttpStatus.OK,
    },
  );
});
