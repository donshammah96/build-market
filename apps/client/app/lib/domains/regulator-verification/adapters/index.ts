import type { LicenseAuthority } from "@prisma/client";
import type { RegulatorAdapter } from "../gateway";
import { ebkAdapter } from "./ebk.adapter";
import { boraqsAdapter } from "./boraqs.adapter";
import { ncaAdapter } from "./nca.adapter";
import { earbAdapter } from "./earb.adapter";
import { vrbAdapter } from "./vrb.adapter";
import { iskAdapter } from "./isk.adapter";
import { epraAdapter } from "./epra.adapter";

export {
  HttpRegulatorAdapter,
  RegulatorAdapterError,
} from "./http-regulator-adapter";
export { loadRegulatorCredentials } from "./credentials";
export { mapDefaultRegulatorResponse } from "./default-response-mapper";

/**
 * All seven regulator adapters, keyed by authority. Each adapter is safe to
 * include unconditionally: HttpRegulatorAdapter.verify() checks its own
 * credentials at call time and degrades to `available: false, retryable:
 * false` (routing to manual review) when unconfigured, rather than the
 * gateway needing to know which authorities are "live" ahead of time.
 *
 * SystemSettings provides explicit enableAutoVerify kill switches for all seven
 * statutory authorities (NCA, EPRA, BORAQS, EBK, EARB, VRB, ISK). `buildProductionAdapterMap`
 * evaluates each flag before routing verification requests to the respective adapter.
 */
export const ALL_REGULATOR_ADAPTERS: Record<
  LicenseAuthority,
  RegulatorAdapter
> = {
  EBK: ebkAdapter,
  BORAQS: boraqsAdapter,
  NCA: ncaAdapter,
  EARB: earbAdapter,
  VRB: vrbAdapter,
  ISK: iskAdapter,
  EPRA: epraAdapter,
  // ERC is @deprecated in favor of EPRA - intentionally left unmapped so it
  // always routes to manual review rather than silently reusing EPRA logic.
  ERC: undefined as unknown as RegulatorAdapter,
  NEMA: undefined as unknown as RegulatorAdapter,
  KEBS: undefined as unknown as RegulatorAdapter,
  OTHER: undefined as unknown as RegulatorAdapter,
};

export type SystemSettingsAutoVerifyFlags = {
  enableAutoVerifyNCA?: boolean;
  enableAutoVerifyEPRA?: boolean;
  enableAutoVerifyBORAQS?: boolean;
  enableAutoVerifyEBK?: boolean;
  enableAutoVerifyEARB?: boolean;
  enableAutoVerifyVRB?: boolean;
  enableAutoVerifyISK?: boolean;
};

/**
 * Builds the adapter map handed to RegulatorVerificationGateway, respecting
 * explicit SystemSettings kill switches for all statutory authorities (NCA, EPRA,
 * BORAQS, EBK, EARB, VRB, ISK). When an authority flag is false/omitted, its adapter
 * is excluded and requests fall back to manual review.
 */
export function buildProductionAdapterMap(
  flags: SystemSettingsAutoVerifyFlags = {},
): Partial<Record<LicenseAuthority, RegulatorAdapter>> {
  const map: Partial<Record<LicenseAuthority, RegulatorAdapter>> = {};

  if (flags.enableAutoVerifyNCA) map.NCA = ALL_REGULATOR_ADAPTERS.NCA;
  if (flags.enableAutoVerifyEPRA) map.EPRA = ALL_REGULATOR_ADAPTERS.EPRA;
  if (flags.enableAutoVerifyBORAQS) map.BORAQS = ALL_REGULATOR_ADAPTERS.BORAQS;
  if (flags.enableAutoVerifyEBK) map.EBK = ALL_REGULATOR_ADAPTERS.EBK;
  if (flags.enableAutoVerifyEARB) map.EARB = ALL_REGULATOR_ADAPTERS.EARB;
  if (flags.enableAutoVerifyVRB) map.VRB = ALL_REGULATOR_ADAPTERS.VRB;
  if (flags.enableAutoVerifyISK) map.ISK = ALL_REGULATOR_ADAPTERS.ISK;

  return map;
}
