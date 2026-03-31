import { beforeEach, describe, expect, it, vi } from "vitest";

const repositoryMock = vi.hoisted(() => ({
  getCertificates: vi.fn(),
  getCertificateById: vi.fn(),
  createCertificate: vi.fn(),
  updateCertificate: vi.fn(),
  deleteCertificate: vi.fn(),
}));

vi.mock("@/app/lib/domains/certificates/repository", () => ({
  certificatesRepository: repositoryMock,
}));

import { certificatesService } from "@/app/lib/domains/certificates/service";

describe("certificatesService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects certificate reads for non-professional actor", async () => {
    const result = await certificatesService.getCertificates(
      { userId: "user_123", role: "client" },
      {},
    );

    expect(result).toEqual({
      ok: false,
      error: "forbidden",
      message: "Forbidden",
      status: 403,
    });
    expect(repositoryMock.getCertificates).not.toHaveBeenCalled();
  });

  it("returns certificate list for professional actor", async () => {
    const mockCerts = [
      { id: "cert_1", category: "EDUCATION_CERT", title: "Degree" },
    ];
    repositoryMock.getCertificates.mockResolvedValue(mockCerts);

    const result = await certificatesService.getCertificates(
      { userId: "pro_123", role: "professional" },
      {},
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toEqual(mockCerts);
    }
    expect(repositoryMock.getCertificates).toHaveBeenCalledWith("pro_123", {});
  });

  it("maps not_found from getCertificateById to Result err", async () => {
    repositoryMock.getCertificateById.mockResolvedValue({
      success: false,
      error: "not_found",
    });

    const result = await certificatesService.getCertificateById(
      { userId: "pro_123", role: "professional" },
      "cert_missing",
    );

    expect(result).toEqual({
      ok: false,
      error: "not_found",
      message: "Certificate not found",
      status: 404,
    });
  });

  it("maps forbidden from getCertificateById to Result err", async () => {
    repositoryMock.getCertificateById.mockResolvedValue({
      success: false,
      error: "forbidden",
    });

    const result = await certificatesService.getCertificateById(
      { userId: "pro_123", role: "professional" },
      "cert_other",
    );

    expect(result).toEqual({
      ok: false,
      error: "forbidden",
      message: "Forbidden",
      status: 403,
    });
  });

  it("returns certificate detail for owner", async () => {
    const mockCert = {
      id: "cert_1",
      category: "EDUCATION_CERT",
      title: "Degree",
      status: "PENDING",
    };
    repositoryMock.getCertificateById.mockResolvedValue({
      success: true,
      data: mockCert,
    });

    const result = await certificatesService.getCertificateById(
      { userId: "pro_123", role: "professional" },
      "cert_1",
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toEqual(mockCert);
    }
  });

  it("maps asset_not_found from create to Result err", async () => {
    repositoryMock.createCertificate.mockResolvedValue({
      error: "asset_not_found",
    });

    const result = await certificatesService.createCertificate(
      { userId: "pro_123", role: "professional" },
      {
        title: "Cert",
        category: "EDUCATION_CERT",
        assetId: "550e8400-e29b-41d4-a716-446655440000",
      },
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("asset_not_found");
      expect(result.status).toBe(404);
    }
  });

  it("maps limit_exceeded from create to Result err", async () => {
    repositoryMock.createCertificate.mockResolvedValue({
      error: "limit_exceeded",
    });

    const result = await certificatesService.createCertificate(
      { userId: "pro_123", role: "professional" },
      {
        title: "Cert",
        category: "EDUCATION_CERT",
        assetId: "550e8400-e29b-41d4-a716-446655440000",
      },
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("limit_exceeded");
      expect(result.status).toBe(400);
    }
  });
});
