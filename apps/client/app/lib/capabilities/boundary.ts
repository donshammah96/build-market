import { capabilityForPath, getCapabilityDecision } from "./registry";

export interface CapabilityBoundaryDenial {
  status: 404;
  body: { error: "Not found" };
}

export function capabilityBoundaryForPath(
  pathname: string,
): CapabilityBoundaryDenial | null {
  const capability = capabilityForPath(pathname);
  if (!capability || getCapabilityDecision(capability).state === "live") {
    return null;
  }

  return { status: 404, body: { error: "Not found" } };
}
