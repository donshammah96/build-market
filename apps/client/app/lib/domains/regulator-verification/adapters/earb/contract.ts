import { z } from "zod";
import type { NormalizedRegulatorRecord } from "../http-regulator-adapter";

export const EARB_CONTRACT_VERSION = "2026-08-01";

export const EarbLicenseResponseSchema = z.object({
  registration_no: z.string(),
  agent_name: z.string().nullable(),
  agency_name: z.string().nullable().optional(),
  status: z.enum(["REGISTERED", "SUSPENDED", "CANCELLED", "EXPIRED", "ACTIVE"]),
  expiry_date: z.string().nullable(),
});

export function mapEarbResponse(
  raw: unknown,
): NormalizedRegulatorRecord | null {
  const parsed = EarbLicenseResponseSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(
      `EARB response did not match contract ${EARB_CONTRACT_VERSION}: ${parsed.error.message}`,
    );
  }
  const r = parsed.data;
  return {
    licenseNumber: r.registration_no,
    holderName: r.agent_name,
    companyName: r.agency_name ?? null,
    status: mapEarbStatus(r.status),
    expiresAt: r.expiry_date,
    contractVersion: EARB_CONTRACT_VERSION,
  };
}

function mapEarbStatus(status: string): string {
  const map: Record<string, string> = {
    REGISTERED: "ACTIVE",
    ACTIVE: "ACTIVE",
    SUSPENDED: "SUSPENDED",
    CANCELLED: "REVOKED",
    EXPIRED: "EXPIRED",
  };
  return map[status] ?? "UNKNOWN";
}
