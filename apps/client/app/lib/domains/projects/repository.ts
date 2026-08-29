import { prisma } from "@build/db";
import {
  ApprovalStatus,
  EscrowStatus,
  MilestoneStatus,
  ProjectStatus,
  Prisma,
  ProjectDocumentType,
  ProjectImageCategory,
  TransactionCategory,
  TransactionStatus,
  TransactionType,
} from "@prisma/client";
import {
  milestoneDetailSelect,
  escrowDetailSelect,
  escrowListSelect,
  projectDetailSelect,
  projectDocumentListSelect,
  projectImageListSelect,
  projectListSelect,
} from "@/app/lib/validation/projects-validation";
import { PROJECT_PAYMENT_METHOD } from "@/app/lib/domains/projects/contracts";

type RepositoryResult<T> =
  | { success: true; data: T }
  | {
      success: false;
      error:
        "not_found" | "forbidden" | "invalid_transition" | "limit_exceeded";
      message?: string;
    };

export type Participant = {
  id: string;
  professionalId: string | null;
  clientId: string;
  title: string;
  role: "PROFESSIONAL" | "CLIENT";
};

export const projectsRepository = {
  async verifyOwnership(
    projectId: string,
    userId: string,
    tx: Prisma.TransactionClient = prisma,
  ): Promise<
    RepositoryResult<{
      id: string;
      professionalId: string | null;
      clientId: string;
      title: string;
    }>
  > {
    const project = await tx.project.findFirst({
      where: { id: projectId, deletedAt: null },
      select: {
        id: true,
        professionalId: true,
        clientId: true,
        title: true,
      },
    });

    if (!project) {
      return {
        success: false,
        error: "not_found",
        message: "Project not found",
      };
    }

    if (project.professionalId !== userId) {
      return {
        success: false,
        error: "forbidden",
        message: "You do not have permission to access this project",
      };
    }

    return { success: true, data: project };
  },

  async verifyAsset(
    assetId: string,
    userId: string,
    tx: Prisma.TransactionClient = prisma,
  ): Promise<RepositoryResult<{ id: string; uploaderId: string }>> {
    const asset = await tx.asset.findUnique({
      where: { id: assetId },
      select: { id: true, uploaderId: true },
    });

    if (!asset) {
      return { success: false, error: "not_found", message: "Asset not found" };
    }

    if (asset.uploaderId !== userId && asset.uploaderId !== "system") {
      return {
        success: false,
        error: "forbidden",
        message: "Unauthorized access to asset",
      };
    }

    return { success: true, data: asset };
  },

  async verifyParticipant(
    projectId: string,
    userId: string,
    tx: Prisma.TransactionClient = prisma,
  ): Promise<RepositoryResult<Participant>> {
    const project = await tx.project.findFirst({
      where: { id: projectId, deletedAt: null },
      select: {
        id: true,
        professionalId: true,
        clientId: true,
        title: true,
      },
    });

    if (!project) {
      return {
        success: false,
        error: "not_found",
        message: "Project not found",
      };
    }

    if (project.professionalId === userId) {
      return { success: true, data: { ...project, role: "PROFESSIONAL" } };
    }

    if (project.clientId === userId) {
      return { success: true, data: { ...project, role: "CLIENT" } };
    }

    return {
      success: false,
      error: "forbidden",
      message: "You are not a participant of this project",
    };
  },

  async verifyMilestone(
    milestoneId: string,
    projectId: string,
    tx: Prisma.TransactionClient = prisma,
  ): Promise<
    RepositoryResult<{
      id: string;
      projectId: string;
      status: MilestoneStatus;
      approvalStatus: ApprovalStatus;
      escrowId: string | null;
    }>
  > {
    const milestone = await tx.projectMilestone.findUnique({
      where: { id: milestoneId },
      select: {
        id: true,
        projectId: true,
        status: true,
        approvalStatus: true,
        escrowId: true,
      },
    });

    if (!milestone || milestone.projectId !== projectId) {
      return {
        success: false,
        error: "not_found",
        message: "Milestone not found in this project",
      };
    }

    return { success: true, data: milestone };
  },

  async getProjectVersion(projectId: string): Promise<number | null> {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { version: true },
    });

    return project?.version ?? null;
  },

  async getMilestoneVersion(milestoneId: string): Promise<number | null> {
    const milestone = await prisma.projectMilestone.findUnique({
      where: { id: milestoneId },
      select: { version: true },
    });

    return milestone?.version ?? null;
  },

  async listActorProjects(input: {
    userId: string;
    page: number;
    limit: number;
    status?: string;
  }) {
    const skip = (input.page - 1) * input.limit;

    let statusFilter: ProjectStatus | { in: ProjectStatus[] } | undefined;
    if (input.status === "active") {
      statusFilter = {
        in: [ProjectStatus.PLANNING, ProjectStatus.IN_PROGRESS],
      };
    } else if (input.status) {
      statusFilter = input.status as ProjectStatus;
    }

    const whereClause: Prisma.ProjectWhereInput = {
      deletedAt: null,
      OR: [{ professionalId: input.userId }, { clientId: input.userId }],
      ...(statusFilter ? { status: statusFilter } : {}),
    };

    const [projects, total] = await Promise.all([
      prisma.project.findMany({
        where: whereClause,
        select: projectListSelect,
        orderBy: { updatedAt: "desc" },
        skip,
        take: input.limit,
      }),
      prisma.project.count({ where: whereClause }),
    ]);

    return {
      projects,
      pagination: {
        page: input.page,
        limit: input.limit,
        total,
        totalPages: Math.ceil(total / input.limit),
      },
    };
  },

  listUserProjects(input: { userId: string; role: "CLIENT" | "PROFESSIONAL" }) {
    if (input.role === "CLIENT") {
      return prisma.project.findMany({
        where: { clientId: input.userId },
        orderBy: { updatedAt: "desc" },
        include: { professional: true },
      });
    }

    return prisma.project.findMany({
      where: { professionalId: input.userId },
      orderBy: { updatedAt: "desc" },
      include: { client: true },
    });
  },

  getProjectForActor(projectId: string, userId: string) {
    return prisma.project.findFirst({
      where: {
        id: projectId,
        deletedAt: null,
        OR: [{ professionalId: userId }, { clientId: userId }],
      },
      select: projectDetailSelect,
    });
  },

  createProfessionalProject(
    userId: string,
    data: {
      clientId: string;
      title: string;
      description?: string;
      type?: Prisma.ProjectCreateInput["type"];
      contractType?: Prisma.ProjectCreateInput["contractType"];
      budgetMin?: number;
      budgetMax?: number;
      agreedPrice?: number;
      startDate?: string;
      endDate?: string;
      status?: Prisma.ProjectCreateInput["status"];
      location?: string;
      siteAddress?: string;
      county?: Prisma.ProjectCreateInput["county"];
    },
  ) {
    return prisma.project.create({
      data: {
        professionalId: userId,
        clientId: data.clientId,
        title: data.title,
        description: data.description,
        type: data.type,
        contractType: data.contractType,
        budgetMin: data.budgetMin,
        budgetMax: data.budgetMax,
        agreedPrice: data.agreedPrice,
        startDate: data.startDate ? new Date(data.startDate) : undefined,
        endDate: data.endDate ? new Date(data.endDate) : undefined,
        status: data.status,
        location: data.location,
        siteAddress: data.siteAddress,
        county: data.county,
      },
      select: projectDetailSelect,
    });
  },

  getMilestoneDetail(projectId: string, milestoneId: string) {
    return prisma.projectMilestone.findFirst({
      where: { id: milestoneId, projectId },
      select: milestoneDetailSelect,
    });
  },

  listMilestones(projectId: string) {
    return prisma.projectMilestone.findMany({
      where: { projectId },
      select: milestoneDetailSelect,
      orderBy: { dueDate: "asc" },
    });
  },

  countMilestones(projectId: string) {
    return prisma.projectMilestone.count({ where: { projectId } });
  },

  createMilestone(data: {
    projectId: string;
    title: string;
    description?: string;
    amount?: number;
    dueDate?: string;
  }) {
    return prisma.projectMilestone.create({
      data: {
        projectId: data.projectId,
        title: data.title,
        description: data.description,
        amount: data.amount,
        dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
      },
      select: milestoneDetailSelect,
    });
  },

  listEscrows(projectId: string) {
    return prisma.escrowTransaction.findMany({
      where: { projectId },
      select: escrowListSelect,
      orderBy: { createdAt: "desc" },
    });
  },

  getEscrowDetail(projectId: string, escrowId: string) {
    return prisma.escrowTransaction.findFirst({
      where: { id: escrowId, projectId },
      select: escrowDetailSelect,
    });
  },

  listProjectDocuments(projectId: string, typeFilter?: string) {
    return prisma.projectDocument.findMany({
      where: {
        projectId,
        ...(typeFilter ? { type: typeFilter as ProjectDocumentType } : {}),
      },
      select: projectDocumentListSelect,
      orderBy: { createdAt: "desc" },
    });
  },

  countProjectDocuments(projectId: string) {
    return prisma.projectDocument.count({ where: { projectId } });
  },

  createProjectDocument(data: {
    projectId: string;
    title: string;
    type: ProjectDocumentType;
    assetId: string;
    milestoneId?: string | null;
    uploadedById: string;
  }) {
    return prisma.projectDocument.create({
      data,
      select: projectDocumentListSelect,
    });
  },

  getProjectMilestone(projectId: string, milestoneId: string) {
    return prisma.projectMilestone.findFirst({
      where: { id: milestoneId, projectId },
      select: { id: true },
    });
  },

  findProjectDocument(projectId: string, documentId: string) {
    return prisma.projectDocument.findFirst({
      where: { id: documentId, projectId },
      select: { id: true },
    });
  },

  getProjectDocument(projectId: string, documentId: string) {
    return prisma.projectDocument.findFirst({
      where: { id: documentId, projectId },
      select: projectDocumentListSelect,
    });
  },

  deleteProjectDocument(documentId: string) {
    return prisma.projectDocument.delete({ where: { id: documentId } });
  },

  listProjectImages(
    projectId: string,
    categoryFilter?: string,
    milestoneFilter?: string,
  ) {
    return prisma.projectImage.findMany({
      where: {
        projectId,
        ...(categoryFilter
          ? { category: categoryFilter as ProjectImageCategory }
          : {}),
        ...(milestoneFilter ? { milestoneId: milestoneFilter } : {}),
      },
      select: projectImageListSelect,
      orderBy: { createdAt: "desc" },
    });
  },

  countProjectImages(projectId: string) {
    return prisma.projectImage.count({ where: { projectId } });
  },

  async createProjectImages(
    projectId: string,
    userId: string,
    images: Array<{
      assetId: string;
      caption?: string;
      category?: ProjectImageCategory;
      milestoneId?: string;
    }>,
  ) {
    return prisma.$transaction(
      images.map((img) =>
        prisma.projectImage.create({
          data: {
            projectId,
            assetId: img.assetId,
            caption: img.caption,
            category: img.category,
            milestoneId: img.milestoneId || null,
            uploadedById: userId,
          },
          select: projectImageListSelect,
        }),
      ),
    );
  },

  findProjectImage(projectId: string, imageId: string) {
    return prisma.projectImage.findFirst({
      where: { id: imageId, projectId },
      select: { id: true },
    });
  },

  getProjectImage(projectId: string, imageId: string) {
    return prisma.projectImage.findFirst({
      where: { id: imageId, projectId },
      select: projectImageListSelect,
    });
  },

  deleteProjectImage(imageId: string) {
    return prisma.projectImage.delete({ where: { id: imageId } });
  },

  markProjectDisputed(projectId: string) {
    return prisma.project.update({
      where: { id: projectId },
      data: { isDisputed: true },
      select: { id: true },
    });
  },

  disputeEscrow(escrowId: string, disputeReason: string) {
    return prisma.escrowTransaction.update({
      where: { id: escrowId },
      data: {
        status: EscrowStatus.DISPUTED,
        disputedAt: new Date(),
        disputeReason,
      },
      select: escrowDetailSelect,
    });
  },

  getEscrowForProject(escrowId: string, projectId: string) {
    return prisma.escrowTransaction.findFirst({
      where: { id: escrowId, projectId },
      select: {
        id: true,
        status: true,
        amount: true,
        platformFee: true,
        vatAmount: true,
        withholdingTax: true,
        milestoneId: true,
      },
    });
  },

  getMilestoneApprovalStatus(milestoneId: string) {
    return prisma.projectMilestone.findUnique({
      where: { id: milestoneId },
      select: { approvalStatus: true },
    });
  },

  updateMilestoneApproval(
    milestoneId: string,
    data: {
      approvalStatus: ApprovalStatus;
      rejectionReason?: string | null;
      status: MilestoneStatus | null;
    },
  ) {
    const updatePayload: Record<string, any> = {
      approvalStatus: data.approvalStatus,
    };

    if (data.approvalStatus === ApprovalStatus.APPROVED) {
      updatePayload.approvedAt = new Date();
      updatePayload.completedAt = new Date();
    }

    if (
      data.approvalStatus === ApprovalStatus.REJECTED ||
      data.approvalStatus === ApprovalStatus.REQUESTED_CHANGE
    ) {
      updatePayload.rejectionReason = data.rejectionReason ?? null;
    }

    if (data.status) {
      updatePayload.status = data.status;
    }

    return prisma.projectMilestone.update({
      where: { id: milestoneId },
      data: updatePayload,
      select: milestoneDetailSelect,
    });
  },

  async fundEscrow(
    escrowId: string,
    referenceCode: string,
    userId: string,
  ): Promise<unknown> {
    return prisma.$transaction(async (tx) => {
      const escrow = await tx.escrowTransaction.findUnique({
        where: { id: escrowId },
        select: { amount: true },
      });

      if (!escrow) {
        return null;
      }

      const updatedEscrow = await tx.escrowTransaction.update({
        where: { id: escrowId },
        data: {
          status: EscrowStatus.FUNDS_HELD,
          fundedAt: new Date(),
          fundingRef: referenceCode,
        },
        select: escrowDetailSelect,
      });

      await tx.ledgerEntry.createMany({
        data: [
          {
            escrowId,
            accountType: "ESCROW_HOLD",
            direction: "DEBIT",
            amount: escrow.amount,
            description: "Escrow funds held",
            transactionRef: referenceCode,
            createdBy: userId,
          },
          {
            escrowId,
            accountType: "PLATFORM_RECEIVABLE",
            direction: "CREDIT",
            amount: escrow.amount,
            description: "Platform receivable from escrow funding",
            transactionRef: referenceCode,
            createdBy: userId,
          },
        ],
      });

      return updatedEscrow;
    });
  },

  async releaseEscrowAndRecordFinance(
    escrow: {
      id: string;
      amount: Prisma.Decimal;
      platformFee: Prisma.Decimal | null;
      vatAmount: Prisma.Decimal | null;
      withholdingTax: Prisma.Decimal | null;
      milestoneId: string | null;
    },
    releaseRef: string,
    userId: string,
    projectId: string,
    professionalId: string,
  ): Promise<unknown> {
    const platformFee = Number(escrow.platformFee ?? 0);
    const vat = Number(escrow.vatAmount ?? 0);
    const withholdingTax = Number(escrow.withholdingTax ?? 0);
    const grossAmount = Number(escrow.amount);
    const netAmount = grossAmount - platformFee - vat - withholdingTax;

    return prisma.$transaction(async (tx) => {
      const updatedEscrow = await tx.escrowTransaction.update({
        where: { id: escrow.id },
        data: {
          status: EscrowStatus.RELEASED,
          releasedAt: new Date(),
          releasedToId: professionalId,
          releaseRef,
        },
        select: escrowDetailSelect,
      });

      const ledgerEntries: Array<{
        escrowId: string;
        accountType: string;
        direction: string;
        amount: number;
        description: string;
        transactionRef: string;
        createdBy: string;
      }> = [
        {
          escrowId: escrow.id,
          accountType: "PROFESSIONAL_PAYABLE",
          direction: "DEBIT",
          amount: netAmount,
          description: "Professional payout",
          transactionRef: releaseRef,
          createdBy: userId,
        },
      ];

      if (platformFee > 0) {
        ledgerEntries.push({
          escrowId: escrow.id,
          accountType: "PLATFORM_FEE",
          direction: "CREDIT",
          amount: platformFee,
          description: "Platform service fee",
          transactionRef: releaseRef,
          createdBy: userId,
        });
      }

      if (vat > 0) {
        ledgerEntries.push({
          escrowId: escrow.id,
          accountType: "TAX_PAYABLE",
          direction: "CREDIT",
          amount: vat,
          description: "VAT withheld",
          transactionRef: releaseRef,
          createdBy: userId,
        });
      }

      if (withholdingTax > 0) {
        ledgerEntries.push({
          escrowId: escrow.id,
          accountType: "TAX_WITHHELD",
          direction: "CREDIT",
          amount: withholdingTax,
          description: "Withholding tax",
          transactionRef: releaseRef,
          createdBy: userId,
        });
      }

      await tx.ledgerEntry.createMany({ data: ledgerEntries });

      await tx.professionalTransaction.create({
        data: {
          professionalId,
          projectId,
          description: "Escrow release payout",
          type: TransactionType.INCOME,
          category: TransactionCategory.PROJECT_PAYMENT,
          method: PROJECT_PAYMENT_METHOD,
          amount: grossAmount,
          platformFee,
          taxAmount: vat + withholdingTax,
          netAmount,
          status: TransactionStatus.SUCCESS,
          referenceCode: releaseRef,
          date: new Date(),
          completedAt: new Date(),
        },
      });

      if (escrow.milestoneId) {
        await tx.projectMilestone.update({
          where: { id: escrow.milestoneId },
          data: { isPaid: true },
        });
      }

      return updatedEscrow;
    });
  },
};
