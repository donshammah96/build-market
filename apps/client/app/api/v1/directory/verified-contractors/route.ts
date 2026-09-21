import { NextRequest, NextResponse } from "next/server";
import {
  prisma,
  TrustTier,
  Profession,
  County,
  VerificationStatus,
} from "@build/db";
import { authenticateEnterpriseClient } from "@/app/api/v1/shared/enterprise-auth";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const auth = await authenticateEnterpriseClient(authHeader, "directory:read");

  if (!auth.authorized) {
    return NextResponse.json(
      { error: auth.errorMessage },
      { status: auth.errorStatus || 401 },
    );
  }

  const { searchParams } = new URL(req.url);
  const professionParam = searchParams.get("profession") as Profession | null;
  const countyParam = searchParams.get("county") as County | null;
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const limit = Math.min(
    100,
    Math.max(1, parseInt(searchParams.get("limit") || "20", 10)),
  );
  const skip = (page - 1) * limit;

  const where: any = {
    trustTier: {
      in: [TrustTier.LICENSE_VERIFIED, TrustTier.ELITE],
    },
    user: {
      status: "ACTIVE",
    },
  };

  if (professionParam && Object.values(Profession).includes(professionParam)) {
    where.profession = professionParam;
  }

  if (countyParam && Object.values(County).includes(countyParam)) {
    where.county = countyParam;
  }

  const [totalCount, professionals] = await Promise.all([
    prisma.professionalProfile.count({ where }),
    prisma.professionalProfile.findMany({
      where,
      skip,
      take: limit,
      select: {
        userId: true,
        companyName: true,
        profession: true,
        county: true,
        trustTier: true,
        rating: true,
        reviewCount: true,
        completedProjects: true,
        responseRate: true,
        badges: {
          where: { revokedAt: null },
          select: {
            type: true,
            awardedAt: true,
          },
        },
        licenses: {
          where: {
            status: VerificationStatus.VERIFIED,
          },
          select: {
            authority: true,
            category: true,
          },
        },
        user: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
    }),
  ]);

  // Privacy & Business Model Invariant: Zero contact PII returned
  const sanitizedResults = professionals.map((p) => ({
    id: p.userId,
    name:
      p.companyName ||
      `${p.user.firstName} ${p.user.lastName ? p.user.lastName.charAt(0) + "." : ""}`.trim(),
    profession: p.profession,
    county: p.county,
    trustTier: p.trustTier,
    rating: Number(p.rating),
    reviewCount: p.reviewCount,
    completedProjects: p.completedProjects ?? 0,
    responseRatePct: p.responseRate,
    badges: p.badges.map((b) => b.type),
    verifiedLicenses: p.licenses.map((l) => ({
      authority: l.authority,
      category: l.category,
    })),
  }));

  return NextResponse.json({
    data: sanitizedResults,
    pagination: {
      page,
      limit,
      totalCount,
      totalPages: Math.ceil(totalCount / limit),
    },
    meta: {
      requestedBy: auth.client.name,
      disclaimer:
        "Public contractor verification signal. Direct contact disclosure is subject to client consent and lead authorization terms.",
    },
  });
}
