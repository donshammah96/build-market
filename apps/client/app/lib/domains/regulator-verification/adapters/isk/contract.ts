import { z } from "zod";
import type { NormalizedRegulatorRecord } from "../http-regulator-adapter";

export const ISK_CONTRACT_VERSION = "2026-08-01";

export const IskLicenseResponseSchema = z.object({
  member_no: z.string(),
  full_name: z.string().nullable(),
  survey_firm: z.string().nullable().optional(),
  membership_status: z.enum([
    "ACTIVE",
    "SUSPENDED",
    "INACTIVE",
    "EXPIRED",
    "VALID",
  ]),
  valid_until: z.string().nullable(),
});

export function mapIskResponse(raw: unknown): NormalizedRegulatorRecord | null {
  const parsed = IskLicenseResponseSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(
      `ISK response did not match contract ${ISK_CONTRACT_VERSION}: ${parsed.error.message}`,
    );
  }
  const r = parsed.data;
  return {
    licenseNumber: r.member_no,
    holderName: r.full_name,
    companyName: r.survey_firm ?? null,
    status: mapIskStatus(r.membership_status),
    expiresAt: r.valid_until,
    contractVersion: ISK_CONTRACT_VERSION,
  };
}

function mapIskStatus(status: string): string {
  const map: Record<string, string> = {
    ACTIVE: "ACTIVE",
    VALID: "ACTIVE",
    SUSPENDED: "SUSPENDED",
    INACTIVE: "EXPIRED",
    EXPIRED: "EXPIRED",
  };
  return map[status] ?? "UNKNOWN";
}
