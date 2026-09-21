import { HttpRegulatorAdapter } from "./http-regulator-adapter";
import { loadRegulatorCredentials } from "./credentials";
import { mapNcaResponse } from "./nca/contract";
import { buildNcaRequestPath } from "./nca/path";

/**
 * National Construction Authority (NCA) regulator adapter.
 */
export const ncaAdapter = new HttpRegulatorAdapter({
  authority: "NCA",
  loadCredentials: () => loadRegulatorCredentials("NCA"),
  buildRequestPath: buildNcaRequestPath,
  mapResponse: mapNcaResponse,
  timeoutMs: 8000,
});
