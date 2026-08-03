import type { RegulatorVerificationRequest } from "../../gateway";

export function buildEbkRequestPath(
  request: RegulatorVerificationRequest,
): string {
  return `/v1/licenses/${encodeURIComponent(request.licenseNumber)}`;
}
