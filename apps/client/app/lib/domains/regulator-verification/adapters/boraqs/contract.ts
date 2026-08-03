import { z } from "zod";
import type { NormalizedRegulatorRecord } from "../http-regulator-adapter";

export const BORAQS_CONTRACT_VERSION = "2026-08-01";

export const BoraqsLicenseResponseSchema = z.object({
  registration_number: z.string(),
  practitioner_name: z.string().nullable(),
  practice_name: z.string().nullable().optional(),
  status: z.enum([
    "REGISTERED",
    "SUSPENDED",
    "DEREGISTERED",
    "EXPIRED",
    "ACTIVE",
  ]),
  expiry_year: z.union([z.string(), z.number()]).nullable().optional(),
});

export function mapBoraqsResponse(
  raw: unknown,
): NormalizedRegulatorRecord | null {
  const parsed = BoraqsLicenseResponseSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(
      `BORAQS response did not match contract ${BORAQS_CONTRACT_VERSION}: ${parsed.error.message}`,
    );
  }
  const r = parsed.data;
  return {
    licenseNumber: r.registration_number,
    holderName: r.practitioner_name,
    companyName: r.practice_name ?? null,
    status: mapBoraqsStatus(r.status),
    expiresAt: r.expiry_year ? String(r.expiry_year) : null,
    contractVersion: BORAQS_CONTRACT_VERSION,
  };
}

function mapBoraqsStatus(status: string): string {
  const map: Record<string, string> = {
    REGISTERED: "ACTIVE",
    ACTIVE: "ACTIVE",
    SUSPENDED: "SUSPENDED",
    DEREGISTERED: "REVOKED",
    EXPIRED: "EXPIRED",
  };
  return map[status] ?? "UNKNOWN";
}
