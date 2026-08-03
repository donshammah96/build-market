import { HttpRegulatorAdapter } from "./http-regulator-adapter";
import { loadRegulatorCredentials } from "./credentials";
import { mapEarbResponse } from "./earb/contract";
import { buildEarbRequestPath } from "./earb/path";

/**
 * Estate Agents Registration Board (EARB) regulator adapter.
 */
export const earbAdapter = new HttpRegulatorAdapter({
  authority: "EARB",
  loadCredentials: () => loadRegulatorCredentials("EARB"),
  buildRequestPath: buildEarbRequestPath,
  mapResponse: mapEarbResponse,
  timeoutMs: 8000,
});
