import { z } from "zod";
import type { NormalizedRegulatorRecord } from "../http-regulator-adapter";

export const VRB_CONTRACT_VERSION = "2026-08-01";

export const VrbLicenseResponseSchema = z.object({
  vrb_number: z.string(),
  valuer_name: z.string().nullable(),
  valuation_firm: z.string().nullable().optional(),
  status: z.enum(["LICENSED", "SUSPENDED", "REVOKED", "EXPIRED", "ACTIVE"]),
  expiry_year: z.union([z.string(), z.number()]).nullable().optional(),
});

export function mapVrbResponse(raw: unknown): NormalizedRegulatorRecord | null {
  const parsed = VrbLicenseResponseSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(
      `VRB response did not match contract ${VRB_CONTRACT_VERSION}: ${parsed.error.message}`,
    );
  }
  const r = parsed.data;
  return {
    licenseNumber: r.vrb_number,
    holderName: r.valuer_name,
    companyName: r.valuation_firm ?? null,
    status: mapVrbStatus(r.status),
    expiresAt: r.expiry_year ? String(r.expiry_year) : null,
    contractVersion: VRB_CONTRACT_VERSION,
  };
}

function mapVrbStatus(status: string): string {
  const map: Record<string, string> = {
    LICENSED: "ACTIVE",
    ACTIVE: "ACTIVE",
    SUSPENDED: "SUSPENDED",
    REVOKED: "REVOKED",
    EXPIRED: "EXPIRED",
  };
  return map[status] ?? "UNKNOWN";
}
