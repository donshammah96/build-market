/**
 * Inquiries Service Layer
 *
 * Core business logic for professional-portal property inquiry operations.
 */
import { prisma } from "../db";
import {
  inquiryListSelect,
  inquiryDetailSelect,
} from "@/lib/validation/inquiries-validation";
import type {
  InquiriesQueryInput,
  UpdateInquiryInput,
} from "@/lib/validation/inquiries-validation";

export type { InquiriesQueryInput, UpdateInquiryInput };

export type InquiryListResult = {
  data: Array<{
    id: string;
    property: unknown;
    clientName: string;
    clientPhone: string | null;
    clientEmail: string | null;
    message: string | null;
    status: string;
    createdAt: string;
    updatedAt: string;
  }>;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export async function getProfessionalInquiries(
  dbUserId: string,
  query: InquiriesQueryInput,
): Promise<InquiryListResult> {
  const { limit, page, status } = query;
  const skip = (page - 1) * limit;

  const where = {
    property: { agentId: dbUserId, deletedAt: null },
    ...(status && { status }),
  };

  const [inquiries, total] = await Promise.all([
    prisma.propertyInquiry.findMany({
      where,
      select: inquiryListSelect,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.propertyInquiry.count({ where }),
  ]);

  const formattedInquiries = inquiries.map((inq) => ({
    id: inq.id,
    property: inq.property,
    clientName: inq.sender
      ? `${inq.sender.firstName || ""} ${inq.sender.lastName || ""}`.trim() ||
        inq.name ||
        "Unknown"
      : inq.name || "Unknown",
    clientPhone: inq.sender?.phone || inq.phone || null,
    clientEmail: inq.email || null,
    message: inq.message,
    status: inq.status,
    createdAt: inq.createdAt.toISOString(),
    updatedAt: inq.updatedAt.toISOString(),
  }));

  return {
    data: formattedInquiries,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export type GetInquiryResult =
  | { success: true; data: unknown }
  | { success: false; error: "not_found" | "forbidden" };

export async function getProfessionalInquiryById(
  dbUserId: string,
  inquiryId: string,
): Promise<GetInquiryResult> {
  const inquiry = await prisma.propertyInquiry.findUnique({
    where: { id: inquiryId },
    select: inquiryDetailSelect,
  });

  if (!inquiry) return { success: false, error: "not_found" };
  if (inquiry.property.agentId !== dbUserId)
    return { success: false, error: "forbidden" };

  const { property, ...rest } = inquiry;
  const { agentId: _agentId, price, ...propertyData } = property;

  return {
    success: true,
    data: {
      ...rest,
      property: {
        ...propertyData,
        price: Number(price),
      },
    },
  };
}

export type UpdateInquiryResult =
  | { success: true; data: unknown }
  | { success: false; error: "not_found" | "forbidden" };

export async function updateProfessionalInquiry(
  dbUserId: string,
  inquiryId: string,
  data: UpdateInquiryInput,
): Promise<UpdateInquiryResult> {
  const existing = await prisma.propertyInquiry.findUnique({
    where: { id: inquiryId },
    select: {
      id: true,
      property: { select: { agentId: true, deletedAt: true } },
    },
  });

  if (!existing) return { success: false, error: "not_found" };
  if (existing.property.agentId !== dbUserId)
    return { success: false, error: "forbidden" };

  const updated = await prisma.propertyInquiry.update({
    where: { id: inquiryId },
    data: {
      ...(data.status && { status: data.status }),
    },
    select: inquiryDetailSelect,
  });

  return { success: true, data: updated };
}

export type DeleteInquiryResult =
  | { success: true }
  | { success: false; error: "not_found" | "forbidden" };

export async function deleteProfessionalInquiry(
  dbUserId: string,
  inquiryId: string,
): Promise<DeleteInquiryResult> {
  const existing = await prisma.propertyInquiry.findUnique({
    where: { id: inquiryId },
    select: {
      id: true,
      property: { select: { agentId: true } },
    },
  });

  if (!existing) return { success: false, error: "not_found" };
  if (existing.property.agentId !== dbUserId)
    return { success: false, error: "forbidden" };

  await prisma.propertyInquiry.delete({ where: { id: inquiryId } });

  return { success: true };
}
