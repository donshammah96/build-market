import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  deleteProfessionalInquiryAction,
  getProfessionalInquiriesAction,
  getProfessionalInquiryByIdAction,
  updateProfessionalInquiryAction,
} from "@/app/actions/inquiries";
import { inquiriesService } from "@/app/lib/domains/inquiries";

const {
  authMock,
  userFindUniqueMock,
  adminProfileFindUniqueMock,
  revalidatePathMock,
} = vi.hoisted(() => ({
  authMock: vi.fn(),
  userFindUniqueMock: vi.fn(),
  adminProfileFindUniqueMock: vi.fn(),
  revalidatePathMock: vi.fn(),
}));

vi.mock("@clerk/nextjs/server", () => ({
  auth: authMock,
}));

vi.mock("@build/db", () => ({
  prisma: {
    user: {
      findUnique: userFindUniqueMock,
    },
    adminProfile: {
      findUnique: adminProfileFindUniqueMock,
    },
  },
}));

vi.mock("next/cache", () => ({
  revalidatePath: revalidatePathMock,
}));

vi.mock("@/app/lib/domains/inquiries", () => ({
  inquiriesService: {
    listProfessionalInquiries: vi.fn(),
    getProfessionalInquiryById: vi.fn(),
    updateProfessionalInquiry: vi.fn(),
    deleteProfessionalInquiry: vi.fn(),
  },
}));

vi.mock("@/app/lib/services/idempotency.service", () => ({
  IdempotencyService: {
    generateKey: vi.fn().mockReturnValue("idem-key"),
    checkOrCreate: vi.fn().mockResolvedValue({ status: "new" }),
    complete: vi.fn().mockResolvedValue(undefined),
    fail: vi.fn().mockResolvedValue(undefined),
  },
}));

describe("inquiries actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue({ userId: "clerk_123" });
    userFindUniqueMock.mockResolvedValue({
      id: "db_user_123",
      email: "pro@example.com",
      role: "PROFESSIONAL",
    });
    adminProfileFindUniqueMock.mockResolvedValue(null);
  });

  it("returns unauthorized when the actor is missing", async () => {
    authMock.mockResolvedValueOnce({ userId: null });

    const result = await getProfessionalInquiriesAction();

    expect(result).toEqual({
      success: false,
      error: {
        code: "unauthorized",
        message: "Unauthorized",
        status: 401,
      },
    });
  });

  it("returns forbidden for non-professional actors before detail reads", async () => {
    userFindUniqueMock.mockResolvedValueOnce({
      id: "db_user_123",
      email: "client@example.com",
      role: "CLIENT",
    });

    const result = await getProfessionalInquiryByIdAction(
      "550e8400-e29b-41d4-a716-446655440001",
    );

    expect(result).toEqual({
      success: false,
      error: {
        code: "forbidden",
        message: "Forbidden",
        status: 403,
      },
    });
    expect(inquiriesService.getProfessionalInquiryById).not.toHaveBeenCalled();
  });

  it("returns validation_error for empty update payloads", async () => {
    const result = await updateProfessionalInquiryAction({
      inquiryId: "550e8400-e29b-41d4-a716-446655440001",
      data: {},
    });

    expect(result.success).toBe(false);
    expect(result.success ? undefined : result.error.code).toBe(
      "validation_error",
    );
    expect(inquiriesService.updateProfessionalInquiry).not.toHaveBeenCalled();
  });

  it("maps domain not_found failures for updates to structured action errors", async () => {
    vi.mocked(inquiriesService.updateProfessionalInquiry).mockResolvedValue({
      ok: false,
      error: "not_found",
      message: "Inquiry not found",
      status: 404,
    });

    const result = await updateProfessionalInquiryAction({
      inquiryId: "550e8400-e29b-41d4-a716-446655440001",
      data: { status: "CONTACTED" },
    });

    expect(result).toEqual({
      success: false,
      error: {
        code: "not_found",
        message: "Inquiry not found",
        status: 404,
      },
    });
  });

  it("lists inquiries through secureAction", async () => {
    vi.mocked(inquiriesService.listProfessionalInquiries).mockResolvedValue({
      ok: true,
      data: {
        data: [],
        pagination: { page: 1, limit: 10, total: 0, totalPages: 0 },
      },
    });

    const result = await getProfessionalInquiriesAction({ status: "NEW" });

    expect(inquiriesService.listProfessionalInquiries).toHaveBeenCalledWith(
      {
        userId: "db_user_123",
        role: "professional",
      },
      expect.objectContaining({ status: "NEW", page: 1, limit: 10 }),
    );
    expect(result.success).toBe(true);
  });

  it("deletes an inquiry through secureAction and revalidates the inquiries page", async () => {
    vi.mocked(inquiriesService.deleteProfessionalInquiry).mockResolvedValue({
      ok: true,
      data: { message: "Inquiry deleted successfully" },
    });

    const result = await deleteProfessionalInquiryAction({
      inquiryId: "550e8400-e29b-41d4-a716-446655440001",
    });

    expect(inquiriesService.deleteProfessionalInquiry).toHaveBeenCalledWith(
      {
        userId: "db_user_123",
        role: "professional",
      },
      "550e8400-e29b-41d4-a716-446655440001",
    );
    expect(revalidatePathMock).toHaveBeenCalledWith(
      "/professional-portal/inquiries",
    );
    expect(result).toEqual({
      success: true,
      data: { message: "Inquiry deleted successfully" },
    });
  });
});
