import { HttpRegulatorAdapter } from "./http-regulator-adapter";
import { loadRegulatorCredentials } from "./credentials";
import { mapVrbResponse } from "./vrb/contract";
import { buildVrbRequestPath } from "./vrb/path";

/**
 * Valuers Registration Board (VRB) regulator adapter.
 */
export const vrbAdapter = new HttpRegulatorAdapter({
  authority: "VRB",
  loadCredentials: () => loadRegulatorCredentials("VRB"),
  buildRequestPath: buildVrbRequestPath,
  mapResponse: mapVrbResponse,
  timeoutMs: 8000,
});
