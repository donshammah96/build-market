import type { NormalizedRegulatorRecord } from "./http-regulator-adapter";

/**
 * Starting-point response mapper shared by adapters that don't yet have a
 * confirmed, authority-specific contract. Assumes a reasonably common
 * snake_case shape: { license_number, holder_name, company_name, status,
 * expires_at }.
 *
 * TODO 1 (per authority): replace this with a mapper built against that
 * regulator's real API/portal response once credentials and a sandbox
 * environment are available - do not enable `enableAutoVerify<AUTHORITY>`
 * in SystemSettings until the mapping has been verified against real data.
 */
export function mapDefaultRegulatorResponse(
  raw: unknown,
): NormalizedRegulatorRecord | null {
  if (typeof raw !== "object" || raw === null) {
    throw new Error("expected a JSON object");
  }

  const record = raw as Record<string, unknown>;
  const asString = (value: unknown): string | null =>
    typeof value === "string" ? value : null;

  return {
    licenseNumber: asString(record.license_number),
    holderName: asString(record.holder_name),
    companyName: asString(record.company_name),
    status: asString(record.status),
    expiresAt: asString(record.expires_at),
  };
}
