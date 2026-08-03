import { HttpRegulatorAdapter } from "./http-regulator-adapter";
import { loadRegulatorCredentials } from "./credentials";
import { mapBoraqsResponse } from "./boraqs/contract";
import { buildBoraqsRequestPath } from "./boraqs/path";

/**
 * Board of Registration of Architects and Quantity Surveyors (BORAQS) adapter.
 */
export const boraqsAdapter = new HttpRegulatorAdapter({
  authority: "BORAQS",
  loadCredentials: () => loadRegulatorCredentials("BORAQS"),
  buildRequestPath: buildBoraqsRequestPath,
  mapResponse: mapBoraqsResponse,
  timeoutMs: 8000,
});
