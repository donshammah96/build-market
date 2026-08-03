import type { RegulatorVerificationRequest } from "../../gateway";

export function buildVrbRequestPath(
  request: RegulatorVerificationRequest,
): string {
  return `/v1/licenses/${encodeURIComponent(request.licenseNumber)}`;
}
