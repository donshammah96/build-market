import { HttpRegulatorAdapter } from "./http-regulator-adapter";
import { loadRegulatorCredentials } from "./credentials";
import { mapIskResponse } from "./isk/contract";
import { buildIskRequestPath } from "./isk/path";

/**
 * Institution of Surveyors of Kenya (ISK) regulator adapter.
 */
export const iskAdapter = new HttpRegulatorAdapter({
  authority: "ISK",
  loadCredentials: () => loadRegulatorCredentials("ISK"),
  buildRequestPath: buildIskRequestPath,
  mapResponse: mapIskResponse,
  timeoutMs: 8000,
});
