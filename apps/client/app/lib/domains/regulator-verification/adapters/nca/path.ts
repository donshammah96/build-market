import type { RegulatorVerificationRequest } from "../../gateway";

export function buildNcaRequestPath(
  request: RegulatorVerificationRequest,
): string {
  return `/v1/licenses/${encodeURIComponent(request.licenseNumber)}`;
}
