import { describe, expect, it } from "vitest";
import {
  mapStkResultCode,
  resolveStkCallbackStatus,
} from "../mpesa-stk.processor.js";

describe("M-Pesa STK processor", () => {
  it("maps only provider success code zero to SUCCESS", () => {
    expect(mapStkResultCode(0)).toBe("SUCCESS");
    expect(mapStkResultCode(1032)).toBe("FAILED");
  });

  it("does not let a duplicate failure callback regress a settled payment", () => {
    expect(resolveStkCallbackStatus("SUCCESS", 1032)).toBe("SUCCESS");
    expect(resolveStkCallbackStatus("PROCESSING", 0)).toBe("SUCCESS");
  });

  it("does not reopen reversed or refunded payments", () => {
    expect(resolveStkCallbackStatus("REVERSED", 0)).toBe("SUCCESS");
    expect(resolveStkCallbackStatus("REFUNDED", 0)).toBe("SUCCESS");
  });
});
