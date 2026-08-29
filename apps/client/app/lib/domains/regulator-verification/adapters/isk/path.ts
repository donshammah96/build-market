import type { RegulatorVerificationRequest } from "../../gateway";

export function buildIskRequestPath(
  request: RegulatorVerificationRequest,
): string {
  return `/v1/licenses/${encodeURIComponent(request.licenseNumber)}`;
}
