import type { RegulatorVerificationRequest } from "../../gateway";

export function buildEarbRequestPath(
  request: RegulatorVerificationRequest,
): string {
  return `/v1/licenses/${encodeURIComponent(request.licenseNumber)}`;
}
