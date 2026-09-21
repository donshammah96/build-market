import type { RegulatorVerificationRequest } from "../../gateway";

export function buildBoraqsRequestPath(
  request: RegulatorVerificationRequest,
): string {
  return `/v1/licenses/${encodeURIComponent(request.licenseNumber)}`;
}
