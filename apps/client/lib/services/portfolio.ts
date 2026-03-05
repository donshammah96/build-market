/**
 * Portfolio Service Layer
 *
 * Core business logic for professional-portal portfolio operations.
 * Used by both API routes and Server Actions.
 */
import { prisma } from "../db";
import { ConsentType, Prisma } from "@prisma/client";
import {
  portfolioListSelect,
  portfolioDetailSelect,
  generatePortfolioSlug,
} from "@/lib/validation/portfolio-validation";
import { PORTFOLIO_CONFIG } from "@/lib/config/portfolio.config";
import type {
  PortfolioQueryInput,
  CreatePortfolioInput,
  UpdatePortfolioInput,
} from "@/lib/validation/portfolio-validation";

export type { PortfolioQueryInput, CreatePortfolioInput, UpdatePortfolioInput };

export type PortfolioListResult = {
  portfolios: unknown[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export async function getProfessionalPortfolios(
  dbUserId: string,
  query: PortfolioQueryInput,
): Promise<PortfolioListResult> {
  const { page, limit, projectType } = query;
  const skip = (page - 1) * limit;

  const where = {
    professionalId: dbUserId,
    deletedAt: null,
    ...(projectType && { projectType }),
  };

  const [portfolios, total] = await Promise.all([
    prisma.portfolio.findMany({
      where,
      select: portfolioListSelect,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.portfolio.count({ where }),
  ]);

  return {
    portfolios,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export type GetPortfolioResult =
  | { success: true; data: unknown }
  | { success: false; error: "not_found" | "forbidden" };

export async function getProfessionalPortfolioById(
  dbUserId: string,
  portfolioId: string,
): Promise<GetPortfolioResult> {
  const portfolio = await prisma.portfolio.findUnique({
    where: { id: portfolioId, deletedAt: null },
    select: {
      ...portfolioDetailSelect,
      professionalId: true,
    },
  });

  if (!portfolio) return { success: false, error: "not_found" };
  if (portfolio.professionalId !== dbUserId) {
    return { success: false, error: "forbidden" };
  }

  const { professionalId: _pid, ...data } = portfolio;
  return { success: true, data };
}

export type CreatePortfolioResult =
  | { success: true; data: unknown }
  | { success: false; error: "limit_exceeded" | "project_not_found" };

export async function createProfessionalPortfolio(
  dbUserId: string,
  data: CreatePortfolioInput,
  metadata?: { ipAddress?: string; userAgent?: string },
): Promise<CreatePortfolioResult> {
  const count = await prisma.portfolio.count({
    where: { professionalId: dbUserId, deletedAt: null },
  });
  if (count >= PORTFOLIO_CONFIG.MAX_PORTFOLIOS_PER_PROFESSIONAL) {
    return { success: false, error: "limit_exceeded" };
  }

  if (data.linkedProjectId) {
    const project = await prisma.project.findUnique({
      where: {
        id: data.linkedProjectId,
        deletedAt: null,
      },
      select: { professionalId: true },
    });
    if (!project || project.professionalId !== dbUserId) {
      return { success: false, error: "project_not_found" };
    }
  }

  const slug = generatePortfolioSlug(data.title);

  const portfolio = await prisma.portfolio.create({
    data: {
      professionalId: dbUserId,
      title: data.title,
      slug,
      description: data.description,
      projectType: data.projectType,
      tags: data.tags,
      location: data.location,
      county: data.county,
      budget: data.budget,
      currency: data.currency,
      durationValue: data.durationValue,
      durationUnit: data.durationUnit,
      completionDate: data.completionDate
        ? new Date(data.completionDate)
        : undefined,
      clientTestimonial: data.clientTestimonial,
      clientName: data.clientName,
      linkedProjectId: data.linkedProjectId || null,
    },
    select: portfolioListSelect,
  });

  await prisma.consentRecord.create({
    data: {
      userId: dbUserId,
      type: ConsentType.PRIVACY_POLICY,
      granted: true,
      grantedAt: new Date(),
      documentVersion: "1.0",
      ipAddress: metadata?.ipAddress,
      metadata: {
        portfolioId: portfolio.id,
        userAgent: metadata?.userAgent,
        action: "create_portfolio",
      } as Prisma.InputJsonValue,
    },
  });

  return { success: true, data: portfolio };
}

export type UpdatePortfolioResult =
  | { data: unknown }
  | { error: "not_found" | "forbidden" | "project_not_found" };

export async function updateProfessionalPortfolio(
  dbUserId: string,
  portfolioId: string,
  updateData: UpdatePortfolioInput,
): Promise<UpdatePortfolioResult> {
  const existing = await prisma.portfolio.findUnique({
    where: { id: portfolioId, deletedAt: null },
    select: { professionalId: true },
  });

  if (!existing) return { error: "not_found" };
  if (existing.professionalId !== dbUserId) return { error: "forbidden" };

  if (updateData.linkedProjectId) {
    const project = await prisma.project.findUnique({
      where: { id: updateData.linkedProjectId, deletedAt: null },
      select: { professionalId: true },
    });
    if (!project || project.professionalId !== dbUserId) {
      return { error: "project_not_found" };
    }
  }

  const portfolio = await prisma.portfolio.update({
    where: { id: portfolioId },
    data: {
      ...updateData,
      completionDate:
        updateData.completionDate === null
          ? null
          : updateData.completionDate
            ? new Date(updateData.completionDate)
            : undefined,
      linkedProjectId:
        updateData.linkedProjectId === null
          ? null
          : updateData.linkedProjectId || undefined,
    },
    select: portfolioDetailSelect,
  });

  return { data: portfolio };
}

export type DeletePortfolioResult =
  | { data: { message: string; portfolioId: string; title: string } }
  | { error: "not_found" | "forbidden" };

export async function deleteProfessionalPortfolio(
  dbUserId: string,
  portfolioId: string,
): Promise<DeletePortfolioResult> {
  const existing = await prisma.portfolio.findUnique({
    where: { id: portfolioId, deletedAt: null },
    select: { professionalId: true, title: true },
  });

  if (!existing) return { error: "not_found" };
  if (existing.professionalId !== dbUserId) return { error: "forbidden" };

  await prisma.portfolio.update({
    where: { id: portfolioId },
    data: { deletedAt: new Date() },
  });

  return {
    data: {
      message: "Portfolio deleted successfully",
      portfolioId,
      title: existing.title,
    },
  };
}
