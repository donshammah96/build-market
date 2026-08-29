import type { RegulatorVerificationRequest } from "../../gateway";

export function buildEpraRequestPath(
  request: RegulatorVerificationRequest,
): string {
  return `/v1/licenses/${encodeURIComponent(request.licenseNumber)}`;
}
