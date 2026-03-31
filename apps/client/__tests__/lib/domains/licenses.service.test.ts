import { beforeEach, describe, expect, it, vi } from "vitest";

const repositoryMocks = vi.hoisted(() => ({
  getLicenses: vi.fn(),
  getLicenseById: vi.fn(),
  createLicense: vi.fn(),
  updateLicense: vi.fn(),
  deleteLicense: vi.fn(),
}));

vi.mock("@/app/lib/domains/licenses/repository", () => ({
  licensesRepository: repositoryMocks,
}));

import { licensesService } from "@/app/lib/domains/licenses/service";

describe("licensesService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects license reads for actors without a professional-capable role", async () => {
    const result = await licensesService.getLicenses({
      userId: "user_1",
      role: "client",
    });

    expect(result).toEqual({
      ok: false,
      error: "forbidden",
      message: "Forbidden",
      status: 403,
    });
    expect(repositoryMocks.getLicenses).not.toHaveBeenCalled();
  });

  it("returns license list for professional actor", async () => {
    const mockLicenses = [
      {
        id: "lic_1",
        authority: "NCA",
        licenseNumber: "NCA-001",
        status: "PENDING",
        validFrom: new Date(),
        validUntil: null,
        isAnnualRenewal: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        asset: null,
      },
    ];
    repositoryMocks.getLicenses.mockResolvedValue(mockLicenses);

    const result = await licensesService.getLicenses({
      userId: "pro_1",
      role: "professional",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toEqual(mockLicenses);
    }
    expect(repositoryMocks.getLicenses).toHaveBeenCalledWith("pro_1");
  });

  it("maps not_found from repository to Result err", async () => {
    repositoryMocks.getLicenseById.mockResolvedValue({ error: "not_found" });

    const result = await licensesService.getLicenseById(
      { userId: "pro_1", role: "professional" },
      "lic_missing",
    );

    expect(result).toEqual({
      ok: false,
      error: "not_found",
      message: "License not found",
      status: 404,
    });
  });

  it("maps forbidden from repository to Result err", async () => {
    repositoryMocks.getLicenseById.mockResolvedValue({ error: "forbidden" });

    const result = await licensesService.getLicenseById(
      { userId: "pro_1", role: "professional" },
      "lic_other",
    );

    expect(result).toEqual({
      ok: false,
      error: "forbidden",
      message: "Forbidden",
      status: 403,
    });
  });

  it("returns license detail for owner", async () => {
    const mockLicense = {
      id: "lic_1",
      authority: "NCA",
      licenseNumber: "NCA-001",
      status: "PENDING",
      verifiedBy: null,
      notes: null,
    };
    repositoryMocks.getLicenseById.mockResolvedValue({ data: mockLicense });

    const result = await licensesService.getLicenseById(
      { userId: "pro_1", role: "professional" },
      "lic_1",
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toEqual(mockLicense);
    }
  });

  it("maps duplicate from create to Result err with 409", async () => {
    repositoryMocks.createLicense.mockResolvedValue({ error: "duplicate" });

    const result = await licensesService.createLicense(
      { userId: "pro_1", role: "professional" },
      {
        authority: "NCA",
        licenseNumber: "NCA-001",
        validFrom: "2026-01-01T00:00:00.000Z",
        isAnnualRenewal: true,
      },
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("duplicate");
      expect(result.status).toBe(409);
    }
  });
});
