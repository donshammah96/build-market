import { describe, expect, it } from "vitest";
import {
  getAdminMvpCapabilityStatus,
  requireLiveAdminMvpCapability,
  capabilityForVerificationEntity,
} from "@/lib/capabilities/mvp-capabilities";

describe("admin MVP capability policy", () => {
  it("labels deferred verticals as dormant and denies mutations by default", () => {
    expect(getAdminMvpCapabilityStatus("materials_commerce")).toBe("dormant");
    expect(requireLiveAdminMvpCapability("property_transactions")).toEqual({
      ok: false,
      code: "MVP_CAPABILITY_DORMANT",
    });
  });
});

it("maps deferred verification entities to their capability for notification suppression", () => {
  expect(capabilityForVerificationEntity("store")).toBe("materials_commerce");
  expect(capabilityForVerificationEntity("property")).toBe(
    "property_transactions",
  );
  expect(capabilityForVerificationEntity("professional")).toBeNull();
});
