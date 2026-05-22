import { err, ok } from "@/app/lib/errors/result";
import { normalizeRole } from "@/app/lib/security/roles";
import { inquiriesRepository } from "@/app/lib/domains/inquiries/repository";
import {
  toInquiryDetailDto,
  toInquiryDto,
} from "@/app/lib/domains/inquiries/mappers";
import type {
  InquiryActor,
  InquiryDeleteResult,
  InquiryDetailResult,
  InquiryListResult,
  InquiryResult,
  InquiriesQueryInput,
  UpdateInquiryInput,
} from "@/app/lib/domains/inquiries/contracts";

const PROFESSIONAL_INQUIRY_ROLES = new Set(["PROFESSIONAL", "ADMIN"]);

function forbidden(message = "Forbidden"): InquiryResult<never> {
  return err({ error: "forbidden", message, status: 403 });
}

function notFound(message = "Inquiry not found"): InquiryResult<never> {
  return err({ error: "not_found", message, status: 404 });
}

function requireProfessionalInquiryActor(
  actor: InquiryActor,
): InquiryResult<{ userId: string }> {
  const role = normalizeRole(actor.role);
  if (!role || !PROFESSIONAL_INQUIRY_ROLES.has(role)) {
    return forbidden();
  }

  return ok({ userId: actor.userId });
}

function mapInquiryListItem(
  inquiry: Awaited<
    ReturnType<typeof inquiriesRepository.listProfessionalInquiries>
  >[0][number],
) {
  return {
    id: inquiry.id,
    property: inquiry.property,
    clientName: inquiry.sender
      ? `${inquiry.sender.firstName || ""} ${inquiry.sender.lastName || ""}`.trim() ||
        inquiry.name ||
        "Unknown"
      : inquiry.name || "Unknown",
    clientPhone: inquiry.sender?.phone || inquiry.phone || null,
    clientEmail: inquiry.email || null,
    message: inquiry.message,
    status: inquiry.status,
    createdAt: toInquiryDto(inquiry.createdAt) as unknown as string,
    updatedAt: toInquiryDto(inquiry.updatedAt) as unknown as string,
  };
}

async function getOwnedInquiryDetail(
  actor: InquiryActor,
  inquiryId: string,
): Promise<InquiryResult<InquiryDetailResult>> {
  const actorResult = requireProfessionalInquiryActor(actor);
  if (!actorResult.ok) {
    return actorResult;
  }

  const inquiry =
    await inquiriesRepository.findProfessionalInquiryById(inquiryId);
  if (!inquiry) {
    return notFound();
  }

  if (inquiry.property.agentId !== actorResult.data.userId) {
    return forbidden();
  }

  return ok(
    toInquiryDetailDto(inquiry as Parameters<typeof toInquiryDetailDto>[0]),
  );
}

export const inquiriesService = {
  async listProfessionalInquiries(
    actor: InquiryActor,
    query: InquiriesQueryInput,
  ): Promise<InquiryResult<InquiryListResult>> {
    const actorResult = requireProfessionalInquiryActor(actor);
    if (!actorResult.ok) {
      return actorResult;
    }

    const { limit, page, status } = query;
    const skip = (page - 1) * limit;
    const where = {
      property: { agentId: actorResult.data.userId, deletedAt: null },
      ...(status && { status }),
    };

    const [inquiries, total] =
      await inquiriesRepository.listProfessionalInquiries(where, skip, limit);

    return ok({
      data: inquiries.map(mapInquiryListItem),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  },

  async getProfessionalInquiryById(
    actor: InquiryActor,
    inquiryId: string,
  ): Promise<InquiryResult<InquiryDetailResult>> {
    return getOwnedInquiryDetail(actor, inquiryId);
  },

  async updateProfessionalInquiry(
    actor: InquiryActor,
    inquiryId: string,
    data: UpdateInquiryInput,
  ): Promise<InquiryResult<InquiryDetailResult>> {
    const existing = await getOwnedInquiryDetail(actor, inquiryId);
    if (!existing.ok) {
      return existing;
    }

    const updated = await inquiriesRepository.updateProfessionalInquiry(
      inquiryId,
      data,
    );
    return ok(
      toInquiryDetailDto(updated as Parameters<typeof toInquiryDetailDto>[0]),
    );
  },

  async deleteProfessionalInquiry(
    actor: InquiryActor,
    inquiryId: string,
  ): Promise<InquiryResult<InquiryDeleteResult>> {
    const existing = await getOwnedInquiryDetail(actor, inquiryId);
    if (!existing.ok) {
      return existing;
    }

    await inquiriesRepository.deleteProfessionalInquiry(inquiryId);
    return ok({ message: "Inquiry deleted successfully" });
  },
};
