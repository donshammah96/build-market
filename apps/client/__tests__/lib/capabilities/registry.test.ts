import { describe, expect, it } from "vitest";
import {
  capabilityForPath,
  getCapabilityDecision,
  getCapabilityTelemetryAttributes,
  MVP_CAPABILITIES,
} from "@/app/lib/capabilities/registry";

describe("MVP capability registry", () => {
  it("defaults every deferred capability to disabled", () => {
    expect(MVP_CAPABILITIES).toEqual([
      "materials_commerce",
      "property_transactions",
      "idea_books",
      "cpd",
      "wallets_escrow",
      "platform_custody",
    ]);

    for (const capability of MVP_CAPABILITIES) {
      expect(getCapabilityDecision(capability)).toMatchObject({
        capability,
        state: "disabled",
        publicDiscoveryEligible: false,
        asyncDeliveryEligible: false,
        adminLifecycleLabel: "dormant",
      });
    }
  });

  it("maps all public and API entry points to their deferred capability", () => {
    expect(capabilityForPath("/stores/nairobi-hardware")).toBe(
      "materials_commerce",
    );
    expect(capabilityForPath("/api/properties/property_123")).toBe(
      "property_transactions",
    );
    expect(capabilityForPath("/idea-books/kitchen-renovation")).toBe(
      "idea_books",
    );
    expect(capabilityForPath("/api/professionals/cpd?year=2026")).toBe("cpd");
    expect(capabilityForPath("/api/projects/project_1/escrow/escrow_1/fund")).toBe(
      "wallets_escrow",
    );
    expect(
      capabilityForPath(
        "/api/professional-portal/projects/project_1/escrow/escrow_1/release",
      ),
    ).toBe("wallets_escrow");
    expect(capabilityForPath("/professionals")).toBeNull();
  });

  it("reports a disabled analytics label without classifying traffic as live", () => {
    expect(getCapabilityTelemetryAttributes("materials_commerce")).toEqual({
      capability: "materials_commerce",
      capability_state: "disabled",
    });
  });
});
