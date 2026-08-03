import { HttpRegulatorAdapter } from "./http-regulator-adapter";
import { loadRegulatorCredentials } from "./credentials";
import { mapEpraResponse } from "./epra/contract";
import { buildEpraRequestPath } from "./epra/path";

/**
 * Energy and Petroleum Regulatory Authority (EPRA) regulator adapter.
 */
export const epraAdapter = new HttpRegulatorAdapter({
  authority: "EPRA",
  loadCredentials: () => loadRegulatorCredentials("EPRA"),
  buildRequestPath: buildEpraRequestPath,
  mapResponse: mapEpraResponse,
  timeoutMs: 8000,
});
