import { prisma, type Prisma } from "@build/db";
import type {
  PrismaVerificationStatus,
  VerificationDocumentAction,
  VerificationDocumentSummary,
  VerificationDocumentType,
  VerificationQueueItem,
  VerificationQueueQuery,
  VerificationStatsPeriod,
} from "./contracts";

const OWNER_SELECT = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  phone: true,
} as const;

const PROFESSIONAL_QUEUE_INCLUDE = {
  user: { select: OWNER_SELECT },
  _count: { select: { documents: true, licenses: true } },
} satisfies Prisma.ProfessionalProfileInclude;

const STORE_QUEUE_INCLUDE = {
  professional: {
    include: {
      user: { select: OWNER_SELECT },
    },
  },
  _count: { select: { products: true } },
} satisfies Prisma.StoreInclude;

const PROPERTY_QUEUE_INCLUDE = {
  agent: {
    include: {
      user: { select: OWNER_SELECT },
    },
  },
  _count: { select: { attachments: true, images: true } },
} satisfies Prisma.PropertyInclude;

type ProfessionalQueueRow = Prisma.ProfessionalProfileGetPayload<{
  include: typeof PROFESSIONAL_QUEUE_INCLUDE;
}>;
type StoreQueueRow = Prisma.StoreGetPayload<{
  include: typeof STORE_QUEUE_INCLUDE;
}>;
type PropertyQueueRow = Prisma.PropertyGetPayload<{
  include: typeof PROPERTY_QUEUE_INCLUDE;
}>;

function dateFilterForPeriod(
  period: VerificationStatsPeriod,
  now: Date = new Date(),
): Prisma.DateTimeFilter | undefined {
  if (period === "all") return undefined;

  const start = new Date(now);
  if (period === "today") {
    start.setHours(0, 0, 0, 0);
  }
  if (period === "week") {
    start.setDate(start.getDate() - 7);
  }
  if (period === "month") {
    start.setDate(start.getDate() - 30);
  }

  return { gte: start };
}

function statusWhere(status: PrismaVerificationStatus) {
  return { verificationStatus: status };
}

function pendingSubmissionWhere(status: PrismaVerificationStatus) {
  if (status !== "PENDING") return {};
  return { submittedAt: { not: null } };
}

function orderByFor(query: VerificationQueueQuery) {
  return {
    [query.sortBy === "submittedAt" ? "submittedAt" : "createdAt"]:
      query.sortOrder,
  };
}

export async function listProfessionalQueue(
  query: VerificationQueueQuery & { status: PrismaVerificationStatus },
): Promise<VerificationQueueItem[]> {
  const rows = (await prisma.professionalProfile.findMany({
    where: statusWhere(query.status),
    include: PROFESSIONAL_QUEUE_INCLUDE,
    orderBy: { createdAt: query.sortOrder },
    skip: query.entityType === "professional" ? query.skip : 0,
    ...(query.entityType === "professional" ? { take: query.limit } : {}),
  })) as ProfessionalQueueRow[];

  return rows.map((profile) => ({
    entityType: "professional",
    entityId: profile.userId,
    name: profile.companyName,
    status: profile.verificationStatus,
    submittedAt: profile.createdAt,
    createdAt: profile.createdAt,
    owner: profile.user,
    documentCount: profile._count.documents,
    certificateCount: profile._count.licenses,
    city: profile.city,
    county: profile.county,
  }));
}

export async function countProfessionalQueue(
  status: PrismaVerificationStatus,
): Promise<number> {
  return prisma.professionalProfile.count({
    where: statusWhere(status),
  });
}

export async function listStoreQueue(
  query: VerificationQueueQuery & { status: PrismaVerificationStatus },
): Promise<VerificationQueueItem[]> {
  const rows = (await prisma.store.findMany({
    where: {
      ...statusWhere(query.status),
      ...pendingSubmissionWhere(query.status),
      deletedAt: null,
    },
    include: STORE_QUEUE_INCLUDE,
    orderBy: orderByFor(query),
    skip: query.entityType === "store" ? query.skip : 0,
    ...(query.entityType === "store" ? { take: query.limit } : {}),
  })) as StoreQueueRow[];

  return rows.map((store) => ({
    entityType: "store",
    entityId: store.id,
    name: store.name,
    status: store.verificationStatus,
    submittedAt: store.submittedAt,
    createdAt: store.createdAt,
    owner: store.professional.user,
    productCount: store._count.products,
    city: store.city,
    county: store.county,
  }));
}

export async function countStoreQueue(
  status: PrismaVerificationStatus,
): Promise<number> {
  return prisma.store.count({
    where: {
      ...statusWhere(status),
      ...pendingSubmissionWhere(status),
      deletedAt: null,
    },
  });
}

export async function listPropertyQueue(
  query: VerificationQueueQuery & { status: PrismaVerificationStatus },
): Promise<VerificationQueueItem[]> {
  const rows = (await prisma.property.findMany({
    where: {
      ...statusWhere(query.status),
      ...pendingSubmissionWhere(query.status),
      deletedAt: null,
    },
    include: PROPERTY_QUEUE_INCLUDE,
    orderBy: orderByFor(query),
    skip: query.entityType === "property" ? query.skip : 0,
    ...(query.entityType === "property" ? { take: query.limit } : {}),
  })) as PropertyQueueRow[];

  return rows.map((property) => ({
    entityType: "property",
    entityId: property.id,
    name: property.title,
    status: property.verificationStatus,
    submittedAt: property.submittedAt,
    createdAt: property.createdAt,
    owner: property.agent.user,
    attachmentCount: property._count.attachments,
    imageCount: property._count.images,
    location: property.location,
    county: property.county,
  }));
}

export async function countPropertyQueue(
  status: PrismaVerificationStatus,
): Promise<number> {
  return prisma.property.count({
    where: {
      ...statusWhere(status),
      ...pendingSubmissionWhere(status),
      deletedAt: null,
    },
  });
}

export async function listLicenseQueue(
  query: VerificationQueueQuery & { status: PrismaVerificationStatus },
): Promise<VerificationQueueItem[]> {
  const rows = await prisma.professionalLicense.findMany({
    where: { status: query.status },
    select: {
      id: true,
      authority: true,
      licenseNumber: true,
      status: true,
      createdAt: true,
      validFrom: true,
      validUntil: true,
      professional: {
        select: {
          userId: true,
          companyName: true,
          user: {
            select: {
              email: true,
              firstName: true,
              lastName: true,
              phone: true,
            },
          },
        },
      },
    },
    orderBy: { createdAt: query.sortOrder },
    skip: query.entityType === "license" ? query.skip : 0,
    ...(query.entityType === "license" ? { take: query.limit } : {}),
  });

  return rows.map((license) => ({
    entityType: "license",
    entityId: license.id,
    name: `${license.authority} - ${license.licenseNumber}`,
    status: license.status,
    submittedAt: license.createdAt,
    createdAt: license.createdAt,
    owner: {
      id: license.professional.userId,
      email: license.professional.user.email,
      firstName: license.professional.user.firstName,
      lastName: license.professional.user.lastName,
      phone: license.professional.user.phone,
    },
    licenseId: license.id,
  }));
}

export async function countLicenseQueue(
  status: PrismaVerificationStatus,
): Promise<number> {
  return prisma.professionalLicense.count({
    where: { status },
  });
}

export async function countVerificationStatus(
  model: "professional" | "store" | "property",
  status: PrismaVerificationStatus,
  period: VerificationStatsPeriod,
): Promise<number> {
  const createdAt = dateFilterForPeriod(period);
  const where = {
    ...(createdAt ? { createdAt } : {}),
    verificationStatus: status,
    ...(model === "professional" ? {} : { deletedAt: null }),
  };

  if (model === "professional") {
    return prisma.professionalProfile.count({ where });
  }
  if (model === "store") {
    return prisma.store.count({ where });
  }
  return prisma.property.count({ where });
}

export async function findStoreOwnerId(
  entityId: string,
): Promise<string | null> {
  const store = await prisma.store.findUnique({
    where: { id: entityId },
    select: { professionalId: true },
  });

  return store?.professionalId ?? null;
}

export async function findPropertyOwnerId(
  entityId: string,
): Promise<string | null> {
  const property = await prisma.property.findUnique({
    where: { id: entityId },
    select: { agentId: true },
  });

  return property?.agentId ?? null;
}

function toDocumentStatus(action: VerificationDocumentAction) {
  return action === "APPROVE" ? "APPROVED" : "REJECTED";
}

function toVerificationStatus(action: VerificationDocumentAction) {
  return action === "APPROVE" ? "VERIFIED" : "REJECTED";
}

export async function updateDocumentVerification(input: {
  documentType: VerificationDocumentType;
  documentId: string;
  action: VerificationDocumentAction;
  notes?: string | undefined;
  adminId: string;
}): Promise<VerificationDocumentSummary> {
  const status = toDocumentStatus(input.action);
  const verificationStatus = toVerificationStatus(input.action);
  const verifiedAt = input.action === "APPROVE" ? new Date() : null;
  const verifiedById = input.action === "APPROVE" ? input.adminId : null;
  const rejectionReason =
    input.action === "REJECT" ? (input.notes ?? null) : null;

  if (
    input.documentType === "professional_document" ||
    input.documentType === "certificate"
  ) {
    const document = await prisma.professionalDocument.update({
      where: { id: input.documentId },
      data: {
        status: verificationStatus,
        verifiedAt,
        verifiedById,
        rejectionReason,
      },
      select: {
        id: true,
        professionalId: true,
      },
    });

    return {
      documentType: input.documentType,
      documentId: document.id,
      targetEntityType: "professional",
      targetEntityId: document.professionalId,
      status,
      message: `Document ${input.action === "APPROVE" ? "approved" : "rejected"} successfully`,
      ...(input.notes ? { notes: input.notes } : {}),
    };
  }

  const document = await prisma.propertyDocument.update({
    where: { id: input.documentId },
    data: {
      status,
      verifiedAt,
      verifiedById,
      rejectionReason,
      ...(input.notes !== undefined ? { notes: input.notes } : {}),
    },
    select: {
      id: true,
      propertyId: true,
    },
  });

  return {
    documentType: input.documentType,
    documentId: document.id,
    targetEntityType: "property",
    targetEntityId: document.propertyId,
    status,
    message: `Document ${input.action === "APPROVE" ? "approved" : "rejected"} successfully`,
    ...(input.notes ? { notes: input.notes } : {}),
  };
}

export const verificationRepository = {
  listProfessionalQueue,
  countProfessionalQueue,
  listStoreQueue,
  countStoreQueue,
  listPropertyQueue,
  countPropertyQueue,
  listLicenseQueue,
  countLicenseQueue,
  countVerificationStatus,
  findStoreOwnerId,
  findPropertyOwnerId,
  updateDocumentVerification,
};
