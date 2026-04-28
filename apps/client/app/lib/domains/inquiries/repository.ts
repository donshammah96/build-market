import { prisma } from "@build/db";
import type { Prisma } from "@prisma/client";
import {
  inquiryDetailSelect,
  inquiryListSelect,
} from "@/app/lib/validation/inquiries-validation";
import type { UpdateInquiryInput } from "@/app/lib/domains/inquiries/contracts";

export const inquiriesRepository = {
  listProfessionalInquiries(
    where: Prisma.PropertyInquiryWhereInput,
    skip: number,
    take: number,
  ) {
    return Promise.all([
      prisma.propertyInquiry.findMany({
        where,
        select: inquiryListSelect,
        orderBy: { createdAt: "desc" },
        skip,
        take,
      }),
      prisma.propertyInquiry.count({ where }),
    ]);
  },

  findProfessionalInquiryById(inquiryId: string) {
    return prisma.propertyInquiry.findUnique({
      where: { id: inquiryId },
      select: inquiryDetailSelect,
    });
  },

  updateProfessionalInquiry(inquiryId: string, data: UpdateInquiryInput) {
    return prisma.propertyInquiry.update({
      where: { id: inquiryId },
      data: {
        ...(data.status && { status: data.status }),
        ...(data.notes !== undefined ? { notes: data.notes } : {}),
        ...(data.preferredViewingDate !== undefined
          ? {
              preferredViewingDate:
                data.preferredViewingDate === "" ||
                data.preferredViewingDate === null
                  ? null
                  : new Date(data.preferredViewingDate),
            }
          : {}),
      },
      select: inquiryDetailSelect,
    });
  },

  deleteProfessionalInquiry(inquiryId: string) {
    return prisma.propertyInquiry.delete({ where: { id: inquiryId } });
  },
};
