import { describe, expect, it } from "vitest";
import {
  ALL_REGULATOR_ADAPTERS,
  buildProductionAdapterMap,
} from "@/app/lib/domains/regulator-verification/adapters";

describe("buildProductionAdapterMap", () => {
  it("returns empty map when all kill switch flags are false or omitted", () => {
    const map = buildProductionAdapterMap({});
    expect(map).toEqual({});
  });

  it("includes only enabled adapters based on SystemSettings kill switches", () => {
    const map = buildProductionAdapterMap({
      enableAutoVerifyNCA: true,
      enableAutoVerifyEBK: true,
    });

    expect(map).toEqual({
      NCA: ALL_REGULATOR_ADAPTERS.NCA,
      EBK: ALL_REGULATOR_ADAPTERS.EBK,
    });
    expect(map.EPRA).toBeUndefined();
    expect(map.BORAQS).toBeUndefined();
    expect(map.EARB).toBeUndefined();
    expect(map.VRB).toBeUndefined();
    expect(map.ISK).toBeUndefined();
  });

  it("includes all seven statutory adapters when all kill switches are enabled", () => {
    const map = buildProductionAdapterMap({
      enableAutoVerifyNCA: true,
      enableAutoVerifyEPRA: true,
      enableAutoVerifyBORAQS: true,
      enableAutoVerifyEBK: true,
      enableAutoVerifyEARB: true,
      enableAutoVerifyVRB: true,
      enableAutoVerifyISK: true,
    });

    expect(Object.keys(map)).toEqual([
      "NCA",
      "EPRA",
      "BORAQS",
      "EBK",
      "EARB",
      "VRB",
      "ISK",
    ]);
    expect(map.NCA).toBe(ALL_REGULATOR_ADAPTERS.NCA);
    expect(map.EPRA).toBe(ALL_REGULATOR_ADAPTERS.EPRA);
    expect(map.BORAQS).toBe(ALL_REGULATOR_ADAPTERS.BORAQS);
    expect(map.EBK).toBe(ALL_REGULATOR_ADAPTERS.EBK);
    expect(map.EARB).toBe(ALL_REGULATOR_ADAPTERS.EARB);
    expect(map.VRB).toBe(ALL_REGULATOR_ADAPTERS.VRB);
    expect(map.ISK).toBe(ALL_REGULATOR_ADAPTERS.ISK);
  });
});
