import { prisma } from "@build/db";
import { ConsentType, type Prisma } from "@prisma/client";
import { PORTFOLIO_CONFIG } from "@/app/lib/config/portfolio.config";
import {
  generatePortfolioSlug,
  portfolioDetailSelect,
  portfolioImageSelect,
  portfolioListSelect,
  type CreatePortfolioInput,
  type CreatePortfolioImageInput,
  type PortfolioQueryInput,
  type UpdatePortfolioInput,
  type UpdatePortfolioImageInput,
} from "@/app/lib/validation/portfolio-validation";
import { err, ok } from "@/app/lib/errors/result";
import type { PortfolioResult } from "@/app/lib/domains/portfolio/contracts";
import {
  toPortfolioDetailDto,
  toPortfolioListItemDto,
} from "@/app/lib/domains/portfolio/mappers";

async function verifyPortfolioOwnership(
  portfolioId: string,
  userId: string,
): Promise<PortfolioResult<{ portfolioId: string }>> {
  const portfolio = await prisma.portfolio.findUnique({
    where: { id: portfolioId, deletedAt: null },
    select: { id: true, professionalId: true },
  });

  if (!portfolio) {
    return err({ error: "not_found", message: "Portfolio not found" });
  }

  if (portfolio.professionalId !== userId) {
    return err({ error: "forbidden", message: "Forbidden" });
  }

  return ok({ portfolioId: portfolio.id });
}

async function verifyAssetOwnership(
  assetId: string,
  userId: string,
): Promise<PortfolioResult<{ assetId: string }>> {
  const asset = await prisma.asset.findUnique({
    where: { id: assetId },
    select: { id: true, uploaderId: true },
  });

  if (!asset) {
    return err({
      error: "asset_not_found",
      message: "Referenced asset was not found",
    });
  }

  if (asset.uploaderId !== userId && asset.uploaderId !== "system") {
    return err({
      error: "asset_forbidden",
      message: "Unauthorized access to asset",
    });
  }

  return ok({ assetId: asset.id });
}

async function verifyLinkedProjectOwnership(
  projectId: string,
  userId: string,
): Promise<PortfolioResult<{ projectId: string }>> {
  const project = await prisma.project.findUnique({
    where: { id: projectId, deletedAt: null },
    select: { id: true, professionalId: true },
  });

  if (!project || project.professionalId !== userId) {
    return err({
      error: "project_not_found",
      message: "Linked project not found",
    });
  }

  return ok({ projectId: project.id });
}

export const portfolioService = {
  async listPortfolios(input: {
    userId: string;
    query: PortfolioQueryInput;
  }): Promise<PortfolioResult<import("./contracts").PortfolioListResultDto>> {
    const { page, limit, projectType } = input.query;
    const skip = (page - 1) * limit;

    const where = {
      professionalId: input.userId,
      deletedAt: null,
      ...(projectType ? { projectType } : {}),
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

    return ok({
      portfolios: portfolios.map((p) =>
        toPortfolioListItemDto(
          p as Parameters<typeof toPortfolioListItemDto>[0],
        ),
      ),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  },

  async getPortfolioDetail(input: {
    portfolioId: string;
    userId: string;
  }): Promise<PortfolioResult<unknown>> {
    const portfolio = await prisma.portfolio.findUnique({
      where: { id: input.portfolioId, deletedAt: null },
      select: {
        ...portfolioDetailSelect,
        professionalId: true,
      },
    });

    if (!portfolio) {
      return err({ error: "not_found", message: "Portfolio not found" });
    }

    if (portfolio.professionalId !== input.userId) {
      return err({ error: "forbidden", message: "Forbidden" });
    }

    const data = Object.fromEntries(
      Object.entries(portfolio).filter(([key]) => key !== "professionalId"),
    );
    return ok(data);
  },

  async createPortfolio(input: {
    userId: string;
    data: CreatePortfolioInput;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<PortfolioResult<import("./contracts").PortfolioListItemDto>> {
    const count = await prisma.portfolio.count({
      where: { professionalId: input.userId, deletedAt: null },
    });
    if (count >= PORTFOLIO_CONFIG.MAX_PORTFOLIOS_PER_PROFESSIONAL) {
      return err({
        error: "limit_exceeded",
        message: `Maximum ${PORTFOLIO_CONFIG.MAX_PORTFOLIOS_PER_PROFESSIONAL} portfolios per professional`,
      });
    }

    if (input.data.linkedProjectId) {
      const projectCheck = await verifyLinkedProjectOwnership(
        input.data.linkedProjectId,
        input.userId,
      );
      if (!projectCheck.ok) {
        return projectCheck;
      }
    }

    const portfolio = await prisma.portfolio.create({
      data: {
        professionalId: input.userId,
        title: input.data.title,
        slug: generatePortfolioSlug(input.data.title),
        description: input.data.description,
        projectType: input.data.projectType,
        tags: input.data.tags,
        location: input.data.location,
        county: input.data.county,
        budget: input.data.budget,
        currency: input.data.currency,
        durationValue: input.data.durationValue,
        durationUnit: input.data.durationUnit,
        completionDate: input.data.completionDate
          ? new Date(input.data.completionDate)
          : undefined,
        clientTestimonial: input.data.clientTestimonial,
        clientName: input.data.clientName,
        linkedProjectId: input.data.linkedProjectId || null,
      },
      select: portfolioListSelect,
    });

    await prisma.consentRecord.create({
      data: {
        userId: input.userId,
        type: ConsentType.PRIVACY_POLICY,
        granted: true,
        grantedAt: new Date(),
        documentVersion: "1.0",
        ipAddress: input.ipAddress,
        metadata: {
          portfolioId: portfolio.id,
          userAgent: input.userAgent,
          action: "create_portfolio",
        } as Prisma.InputJsonValue,
      },
    });

    return ok(
      toPortfolioListItemDto(
        portfolio as Parameters<typeof toPortfolioListItemDto>[0],
      ),
    );
  },

  async updatePortfolio(input: {
    portfolioId: string;
    userId: string;
    data: UpdatePortfolioInput;
  }): Promise<PortfolioResult<import("./contracts").PortfolioDetailDto>> {
    const ownership = await verifyPortfolioOwnership(
      input.portfolioId,
      input.userId,
    );
    if (!ownership.ok) {
      return ownership;
    }

    if (input.data.linkedProjectId) {
      const projectCheck = await verifyLinkedProjectOwnership(
        input.data.linkedProjectId,
        input.userId,
      );
      if (!projectCheck.ok) {
        return projectCheck;
      }
    }

    const portfolio = await prisma.portfolio.update({
      where: { id: input.portfolioId },
      data: {
        ...input.data,
        completionDate:
          input.data.completionDate === null
            ? null
            : input.data.completionDate
              ? new Date(input.data.completionDate)
              : undefined,
        linkedProjectId:
          input.data.linkedProjectId === null
            ? null
            : input.data.linkedProjectId || undefined,
      },
      select: portfolioDetailSelect,
    });

    return ok(
      toPortfolioDetailDto(
        portfolio as Parameters<typeof toPortfolioDetailDto>[0],
      ),
    );
  },

  async deletePortfolio(input: {
    portfolioId: string;
    userId: string;
  }): Promise<
    PortfolioResult<{ message: string; portfolioId: string; title: string }>
  > {
    const existing = await prisma.portfolio.findUnique({
      where: { id: input.portfolioId, deletedAt: null },
      select: { professionalId: true, title: true },
    });

    if (!existing) {
      return err({ error: "not_found", message: "Portfolio not found" });
    }

    if (existing.professionalId !== input.userId) {
      return err({ error: "forbidden", message: "Forbidden" });
    }

    await prisma.portfolio.update({
      where: { id: input.portfolioId },
      data: { deletedAt: new Date() },
    });

    return ok({
      message: "Portfolio deleted successfully",
      portfolioId: input.portfolioId,
      title: existing.title,
    });
  },

  async listImages(input: {
    portfolioId: string;
    userId: string;
    category?: CreatePortfolioImageInput["category"];
  }): Promise<PortfolioResult<unknown[]>> {
    const ownership = await verifyPortfolioOwnership(
      input.portfolioId,
      input.userId,
    );
    if (!ownership.ok) {
      return ownership;
    }

    const images = await prisma.portfolioImage.findMany({
      where: {
        portfolioId: input.portfolioId,
        ...(input.category ? { category: input.category } : {}),
      },
      select: portfolioImageSelect,
      orderBy: [{ isMain: "desc" }, { sortOrder: "asc" }],
    });

    return ok(images);
  },

  async addImages(input: {
    portfolioId: string;
    userId: string;
    images: CreatePortfolioImageInput[];
    ipAddress?: string;
    userAgent?: string;
  }): Promise<PortfolioResult<{ images: unknown[]; count: number }>> {
    const ownership = await verifyPortfolioOwnership(
      input.portfolioId,
      input.userId,
    );
    if (!ownership.ok) {
      return ownership;
    }

    const currentCount = await prisma.portfolioImage.count({
      where: { portfolioId: input.portfolioId },
    });
    if (
      currentCount + input.images.length >
      PORTFOLIO_CONFIG.MAX_IMAGES_PER_PORTFOLIO
    ) {
      return err({
        error: "limit_exceeded",
        message: `Maximum ${PORTFOLIO_CONFIG.MAX_IMAGES_PER_PORTFOLIO} images per portfolio`,
      });
    }

    for (const image of input.images) {
      const asset = await verifyAssetOwnership(image.assetId, input.userId);
      if (!asset.ok) {
        return asset;
      }
    }

    const existingMain = await prisma.portfolioImage.findFirst({
      where: { portfolioId: input.portfolioId, isMain: true },
      select: { id: true },
    });
    const hasMainInBatch = input.images.some((image) => image.isMain);

    const created = await prisma.$transaction(async (tx) => {
      const rows = [] as unknown[];

      for (const [index, image] of input.images.entries()) {
        const row = await tx.portfolioImage.create({
          data: {
            portfolioId: input.portfolioId,
            assetId: image.assetId,
            caption: image.caption,
            category: image.category,
            isMain:
              !existingMain && !hasMainInBatch
                ? index === 0
                : (image.isMain ?? false),
            sortOrder: image.sortOrder ?? currentCount + index,
            uploadedById: input.userId,
          },
          select: portfolioImageSelect,
        });
        rows.push(row);
      }

      await tx.consentRecord.create({
        data: {
          userId: input.userId,
          type: ConsentType.PRIVACY_POLICY,
          granted: true,
          grantedAt: new Date(),
          documentVersion: "1.0",
          ipAddress: input.ipAddress,
          metadata: {
            portfolioId: input.portfolioId,
            userAgent: input.userAgent,
            imageCount: rows.length,
            action: "add_portfolio_images",
          } as Prisma.InputJsonValue,
        },
      });

      return rows;
    });

    return ok({ images: created, count: created.length });
  },

  async updateImage(input: {
    portfolioId: string;
    imageId: string;
    userId: string;
    data: UpdatePortfolioImageInput;
  }): Promise<PortfolioResult<unknown>> {
    const ownership = await verifyPortfolioOwnership(
      input.portfolioId,
      input.userId,
    );
    if (!ownership.ok) {
      return ownership;
    }

    const image = await prisma.portfolioImage.findFirst({
      where: { id: input.imageId, portfolioId: input.portfolioId },
      select: { id: true },
    });
    if (!image) {
      return err({ error: "image_not_found", message: "Image not found" });
    }

    if (input.data.isMain) {
      await prisma.portfolioImage.updateMany({
        where: {
          portfolioId: input.portfolioId,
          isMain: true,
          id: { not: input.imageId },
        },
        data: { isMain: false },
      });
    }

    const updated = await prisma.portfolioImage.update({
      where: { id: input.imageId },
      data: input.data,
      select: portfolioImageSelect,
    });

    return ok(updated);
  },

  async deleteImage(input: {
    portfolioId: string;
    imageId: string;
    userId: string;
  }): Promise<PortfolioResult<{ message: string; imageId: string }>> {
    const ownership = await verifyPortfolioOwnership(
      input.portfolioId,
      input.userId,
    );
    if (!ownership.ok) {
      return ownership;
    }

    const image = await prisma.portfolioImage.findFirst({
      where: { id: input.imageId, portfolioId: input.portfolioId },
      select: { id: true, isMain: true },
    });
    if (!image) {
      return err({ error: "image_not_found", message: "Image not found" });
    }

    const deleteAndPromote = async (db: typeof prisma) => {
      await db.portfolioImage.delete({ where: { id: input.imageId } });

      if (!image.isMain) {
        return;
      }

      const nextImage = await db.portfolioImage.findFirst({
        where: { portfolioId: input.portfolioId },
        orderBy: { sortOrder: "asc" },
        select: { id: true },
      });

      if (nextImage) {
        await db.portfolioImage.update({
          where: { id: nextImage.id },
          data: { isMain: true },
        });
      }
    };

    if (typeof prisma.$transaction === "function") {
      await prisma.$transaction(async (tx) => {
        await deleteAndPromote(tx as typeof prisma);
      });
    } else {
      await deleteAndPromote(prisma);
    }

    return ok({
      message: "Image deleted successfully",
      imageId: input.imageId,
    });
  },
};
