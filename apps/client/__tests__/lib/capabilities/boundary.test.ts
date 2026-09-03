import { describe, expect, it } from "vitest";
import { capabilityBoundaryForPath } from "@/app/lib/capabilities/boundary";

describe("capability boundary", () => {
  it("denies dormant public and API entry points without exposing state", () => {
    expect(capabilityBoundaryForPath("/stores/nairobi")).toEqual({
      status: 404,
      body: { error: "Not found" },
    });
    expect(capabilityBoundaryForPath("/api/properties/property_1")).toEqual({
      status: 404,
      body: { error: "Not found" },
    });
  });

  it("does not interfere with live MVP routes", () => {
    expect(capabilityBoundaryForPath("/professionals")).toBeNull();
  });
});
