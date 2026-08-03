import { HttpRegulatorAdapter } from "./http-regulator-adapter";
import { loadRegulatorCredentials } from "./credentials";
import { mapEbkResponse } from "./ebk/contract";
import { buildEbkRequestPath } from "./ebk/path";

/**
 * Engineers Board of Kenya (EBK) regulator adapter.
 */
export const ebkAdapter = new HttpRegulatorAdapter({
  authority: "EBK",
  loadCredentials: () => loadRegulatorCredentials("EBK"),
  buildRequestPath: buildEbkRequestPath,
  mapResponse: mapEbkResponse,
  timeoutMs: 8000,
});
