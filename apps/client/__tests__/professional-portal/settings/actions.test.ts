import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  completeProfessionalProfileAction,
  getProfessionalProfileAction,
  getServiceCategoriesAction,
  getServicesGroupedByCategoryAction,
  updateProfessionalProfileAction,
} from "@/app/professional-portal/settings/actions";
import { professionalSettingsService } from "@/app/lib/domains/professional-settings";

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

vi.mock("@/app/lib/domains/professional-settings", () => ({
  professionalSettingsService: {
    getProfile: vi.fn(),
    updateProfile: vi.fn(),
    listGroupedServices: vi.fn(),
    completeProfile: vi.fn(),
    listServiceCategories: vi.fn(),
  },
}));

describe("professional settings actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue({ userId: "clerk_123" });
    userFindUniqueMock.mockResolvedValue({
      id: "db_user_123",
      email: "test@example.com",
      role: "PROFESSIONAL",
    });
    adminProfileFindUniqueMock.mockResolvedValue(null);
  });

  it("returns unauthorized when the actor is missing", async () => {
    authMock.mockResolvedValueOnce({ userId: null });

    const result = await getProfessionalProfileAction();

    expect(result).toEqual({ success: false, error: "Unauthorized" });
  });

  it("returns validation failed for invalid profile updates", async () => {
    const result = await updateProfessionalProfileAction({
      serviceIds: ["not-a-uuid"],
    });

    expect(result).toEqual({ success: false, error: "Validation failed" });
    expect(professionalSettingsService.updateProfile).not.toHaveBeenCalled();
  });

  it("updates the professional profile through the domain service", async () => {
    vi.mocked(professionalSettingsService.updateProfile).mockResolvedValue({
      ok: true,
      data: undefined,
    });

    const result = await updateProfessionalProfileAction({
      firstName: "Jane",
      serviceIds: ["550e8400-e29b-41d4-a716-446655440000"],
    });

    expect(professionalSettingsService.updateProfile).toHaveBeenCalledWith(
      {
        userId: "db_user_123",
        clerkId: "clerk_123",
        role: "professional",
      },
      {
        firstName: "Jane",
        serviceIds: ["550e8400-e29b-41d4-a716-446655440000"],
      },
    );
    expect(revalidatePathMock).toHaveBeenCalledWith(
      "/professional-portal/settings",
    );
    expect(result).toEqual({ success: true, data: undefined });
  });

  it("completes the profile through the domain service and revalidates the portal", async () => {
    vi.mocked(professionalSettingsService.completeProfile).mockResolvedValue({
      ok: true,
      data: undefined,
    });

    const result = await completeProfessionalProfileAction({
      companyName: "Build Market Ltd",
    });

    expect(professionalSettingsService.completeProfile).toHaveBeenCalledWith(
      {
        userId: "db_user_123",
        clerkId: "clerk_123",
        role: "professional",
      },
      { companyName: "Build Market Ltd" },
    );
    expect(revalidatePathMock).toHaveBeenCalledWith("/professional-portal");
    expect(result).toEqual({ success: true, data: undefined });
  });

  it("lists grouped services without requiring an actor", async () => {
    vi.mocked(
      professionalSettingsService.listGroupedServices,
    ).mockResolvedValue({
      ok: true,
      data: [
        {
          id: "cat-1",
          name: "Design",
          services: [
            { id: "svc-1", name: "Architecture", slug: "architecture" },
          ],
        },
      ],
    });

    const result = await getServicesGroupedByCategoryAction();

    expect(result.success).toBe(true);
    expect(professionalSettingsService.listGroupedServices).toHaveBeenCalled();
  });

  it("lists service categories without requiring an actor", async () => {
    vi.mocked(
      professionalSettingsService.listServiceCategories,
    ).mockResolvedValue({
      ok: true,
      data: [{ id: "cat-1", name: "Design" }],
    });

    const result = await getServiceCategoriesAction();

    expect(result).toEqual({
      success: true,
      data: [{ id: "cat-1", name: "Design" }],
    });
  });
});
