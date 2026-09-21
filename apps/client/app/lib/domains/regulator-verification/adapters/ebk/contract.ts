import { z } from "zod";
import type { NormalizedRegulatorRecord } from "../http-regulator-adapter";

export const EBK_CONTRACT_VERSION = "2026-08-01";

export const EbkLicenseResponseSchema = z.object({
  ebk_reg_no: z.string(),
  engineer_name: z.string().nullable(),
  consulting_firm: z.string().nullable().optional(),
  status: z.enum(["ACTIVE", "INACTIVE", "SUSPENDED", "DELETED", "LICENSED"]),
  valid_until: z.string().nullable(),
});

export function mapEbkResponse(raw: unknown): NormalizedRegulatorRecord | null {
  const parsed = EbkLicenseResponseSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(
      `EBK response did not match contract ${EBK_CONTRACT_VERSION}: ${parsed.error.message}`,
    );
  }
  const r = parsed.data;
  return {
    licenseNumber: r.ebk_reg_no,
    holderName: r.engineer_name,
    companyName: r.consulting_firm ?? null,
    status: mapEbkStatus(r.status),
    expiresAt: r.valid_until,
    contractVersion: EBK_CONTRACT_VERSION,
  };
}

function mapEbkStatus(status: string): string {
  const map: Record<string, string> = {
    ACTIVE: "ACTIVE",
    LICENSED: "ACTIVE",
    SUSPENDED: "SUSPENDED",
    DELETED: "REVOKED",
    INACTIVE: "EXPIRED",
  };
  return map[status] ?? "UNKNOWN";
}
