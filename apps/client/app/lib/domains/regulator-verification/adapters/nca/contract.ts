import { z } from "zod";
import type { NormalizedRegulatorRecord } from "../http-regulator-adapter";

export const NCA_CONTRACT_VERSION = "2026-08-01";

export const NcaLicenseResponseSchema = z.object({
  license_no: z.string(),
  registered_name: z.string().nullable(),
  firm_name: z.string().nullable().optional(),
  registration_status: z.enum([
    "ACTIVE",
    "SUSPENDED",
    "REVOKED",
    "EXPIRED",
    "PENDING_RENEWAL",
  ]),
  expiry_date: z.string().nullable(),
});

export function mapNcaResponse(raw: unknown): NormalizedRegulatorRecord | null {
  const parsed = NcaLicenseResponseSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(
      `NCA response did not match contract ${NCA_CONTRACT_VERSION}: ${parsed.error.message}`,
    );
  }
  const r = parsed.data;
  return {
    licenseNumber: r.license_no,
    holderName: r.registered_name,
    companyName: r.firm_name ?? null,
    status: mapNcaStatus(r.registration_status),
    expiresAt: r.expiry_date,
    contractVersion: NCA_CONTRACT_VERSION,
  };
}

function mapNcaStatus(status: string): string {
  const map: Record<string, string> = {
    ACTIVE: "ACTIVE",
    SUSPENDED: "SUSPENDED",
    REVOKED: "REVOKED",
    EXPIRED: "EXPIRED",
    PENDING_RENEWAL: "ACTIVE",
  };
  return map[status] ?? "UNKNOWN";
}
