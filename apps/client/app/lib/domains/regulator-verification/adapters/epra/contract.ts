import { z } from "zod";
import type { NormalizedRegulatorRecord } from "../http-regulator-adapter";

export const EPRA_CONTRACT_VERSION = "2026-08-01";

export const EpraLicenseResponseSchema = z.object({
  licence_number: z.string(),
  licence_holder: z.string().nullable(),
  company: z.string().nullable().optional(),
  status: z.enum(["VALID", "EXPIRED", "SUSPENDED", "REVOKED", "ACTIVE"]),
  valid_to: z.string().nullable(),
});

export function mapEpraResponse(
  raw: unknown,
): NormalizedRegulatorRecord | null {
  const parsed = EpraLicenseResponseSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(
      `EPRA response did not match contract ${EPRA_CONTRACT_VERSION}: ${parsed.error.message}`,
    );
  }
  const r = parsed.data;
  return {
    licenseNumber: r.licence_number,
    holderName: r.licence_holder,
    companyName: r.company ?? null,
    status: mapEpraStatus(r.status),
    expiresAt: r.valid_to,
    contractVersion: EPRA_CONTRACT_VERSION,
  };
}

function mapEpraStatus(status: string): string {
  const map: Record<string, string> = {
    VALID: "ACTIVE",
    ACTIVE: "ACTIVE",
    SUSPENDED: "SUSPENDED",
    REVOKED: "REVOKED",
    EXPIRED: "EXPIRED",
  };
  return map[status] ?? "UNKNOWN";
}
