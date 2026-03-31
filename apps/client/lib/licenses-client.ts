/**
 * Licenses Client
 *
 * Browser facade for professional-portal licenses API.
 * Uses fetch-based API access; no server actions.
 */
import type { ApiResponse } from "@build/types";
import { API_ROUTES } from "@/lib/links";
import { apiFetch } from "@/lib/api-client-utils";
import { isValidId } from "@/lib/utils/validators";
import type {
  CreateLicenseInput,
  UpdateLicenseInput,
} from "@/app/lib/validation/documents-validation";
import type {
  LicenseListItem,
  LicenseDetail,
} from "@/app/lib/domains/licenses/contracts";

export type { CreateLicenseInput, UpdateLicenseInput };
export type {
  LicenseListItem,
  LicenseDetail,
} from "@/app/lib/domains/licenses/contracts";

export type LicenseListPayload = LicenseListItem[];
export type LicenseDetailPayload = LicenseDetail;
export type LicenseCreatePayload = LicenseListItem;
export type LicenseUpdatePayload = LicenseDetail;
export type LicenseDeletePayload = {
  message: string;
  licenseId: string;
  authority: string;
  licenseNumber: string;
};

export type CreateLicenseClientInput = CreateLicenseInput;
export type UpdateLicenseClientInput = { id: string; data: UpdateLicenseInput };

class LicensesClient {
  async getLicenses(): Promise<ApiResponse<LicenseListPayload>> {
    return apiFetch<LicenseListPayload>(API_ROUTES.professionalPortalLicenses);
  }

  async getLicenseById(id: string): Promise<ApiResponse<LicenseDetailPayload>> {
    if (!isValidId(id)) return { success: false, error: "Invalid license ID" };
    return apiFetch<LicenseDetailPayload>(
      API_ROUTES.professionalPortalLicenseDetail(id),
    );
  }

  async createLicense(
    data: CreateLicenseClientInput,
  ): Promise<ApiResponse<LicenseCreatePayload>> {
    return apiFetch<LicenseCreatePayload>(
      API_ROUTES.professionalPortalLicenses,
      {
        method: "POST",
        body: JSON.stringify(data),
      },
    );
  }

  async updateLicense(
    input: UpdateLicenseClientInput,
  ): Promise<ApiResponse<LicenseUpdatePayload>> {
    if (!isValidId(input.id))
      return { success: false, error: "Invalid license ID" };
    return apiFetch<LicenseUpdatePayload>(
      API_ROUTES.professionalPortalLicenseDetail(input.id),
      {
        method: "PATCH",
        body: JSON.stringify(input.data),
      },
    );
  }

  async deleteLicense(id: string): Promise<ApiResponse<LicenseDeletePayload>> {
    if (!isValidId(id)) return { success: false, error: "Invalid license ID" };
    return apiFetch<LicenseDeletePayload>(
      API_ROUTES.professionalPortalLicenseDetail(id),
      { method: "DELETE" },
    );
  }
}

export const licensesClient = new LicensesClient();
