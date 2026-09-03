import { describe, expect, it } from "vitest";
import { shouldProcessCapabilityWork } from "../guard.js";

describe("worker MVP capability guard", () => {
  it("suppresses deferred work without treating it as a delivery failure", () => {
    expect(
      shouldProcessCapabilityWork("materials_commerce", {
        FEATURE_MVP_MATERIALS_COMMERCE: false,
      }),
    ).toEqual({ process: false, reason: "capability_dormant" });
  });

  it("allows reviewed live work", () => {
    expect(
      shouldProcessCapabilityWork("materials_commerce", {
        FEATURE_MVP_MATERIALS_COMMERCE: true,
      }),
    ).toEqual({ process: true });
  });
});
