/**
 * Certificates Client
 *
 * Browser facade for professional-portal certificates API.
 * Uses fetch-based API access; no server actions.
 */
import type { ApiResponse } from "@build/types";
import { API_ROUTES } from "@/lib/routes";
import { apiFetch } from "@/lib/api-client-utils";
import { isValidId } from "@/lib/utils/validators";
import type {
  CreateCertificateInput,
  UpdateCertificateInput,
  CertificateQueryInput,
} from "@/validation/certificate-validation";
import type {
  CertificateListItem,
  CertificateDetail,
} from "@/domains/certificates/contracts";

export type {
  CreateCertificateInput,
  UpdateCertificateInput,
  CertificateQueryInput,
};
export type {
  CertificateListItem,
  CertificateDetail,
} from "@/domains/certificates/contracts";

export type CertificateListPayload = CertificateListItem[];
export type CertificateDetailPayload = CertificateDetail;
export type CertificateCreatePayload = CertificateListItem;
export type CertificateUpdatePayload = CertificateDetail;
export type CertificateDeletePayload = { message: string; category: string };

export type CreateCertificateClientInput = CreateCertificateInput;
export type UpdateCertificateClientInput = {
  id: string;
  data: UpdateCertificateInput;
};

class CertificatesClient {
  async getCertificates(
    query?: Partial<CertificateQueryInput>,
  ): Promise<ApiResponse<CertificateListPayload>> {
    const params = new URLSearchParams();
    if (query?.category) params.set("category", query.category);
    if (query?.status) params.set("status", query.status);
    const qs = params.toString();
    const url = `${API_ROUTES.professionalPortalCertificates}${qs ? `?${qs}` : ""}`;
    return apiFetch<CertificateListPayload>(url);
  }

  async getCertificateById(
    id: string,
  ): Promise<ApiResponse<CertificateDetailPayload>> {
    if (!isValidId(id))
      return { success: false, error: "Invalid certificate ID" };
    return apiFetch<CertificateDetailPayload>(
      API_ROUTES.professionalPortalCertificateDetail(id),
    );
  }

  async createCertificate(
    data: CreateCertificateClientInput,
  ): Promise<ApiResponse<CertificateCreatePayload>> {
    return apiFetch<CertificateCreatePayload>(
      API_ROUTES.professionalPortalCertificates,
      {
        method: "POST",
        body: JSON.stringify(data),
      },
    );
  }

  async updateCertificate(
    input: UpdateCertificateClientInput,
  ): Promise<ApiResponse<CertificateUpdatePayload>> {
    if (!isValidId(input.id))
      return { success: false, error: "Invalid certificate ID" };
    return apiFetch<CertificateUpdatePayload>(
      API_ROUTES.professionalPortalCertificateDetail(input.id),
      {
        method: "PATCH",
        body: JSON.stringify(input.data),
      },
    );
  }

  async deleteCertificate(
    id: string,
  ): Promise<ApiResponse<CertificateDeletePayload>> {
    if (!isValidId(id))
      return { success: false, error: "Invalid certificate ID" };
    return apiFetch<CertificateDeletePayload>(
      API_ROUTES.professionalPortalCertificateDetail(id),
      { method: "DELETE" },
    );
  }
}

export const certificatesClient = new CertificatesClient();
