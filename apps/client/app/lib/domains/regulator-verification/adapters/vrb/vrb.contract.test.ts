import { describe, expect, it } from "vitest";
import { mapVrbResponse, VRB_CONTRACT_VERSION } from "./contract";
import exactMatch from "./fixtures/exact_match.json";
import suspended from "./fixtures/suspended.json";
import malformed from "./fixtures/malformed.json";

describe("VRB contract validation", () => {
  it("maps a licensed valuer correctly with contract version", () => {
    const record = mapVrbResponse(exactMatch);
    expect(record).not.toBeNull();
    expect(record?.licenseNumber).toBe("VRB-7711");
    expect(record?.holderName).toBe("Peter Valuer");
    expect(record?.companyName).toBe("Heritage Valuations");
    expect(record?.status).toBe("ACTIVE");
    expect(record?.contractVersion).toBe(VRB_CONTRACT_VERSION);
  });

  it("maps a suspended license correctly", () => {
    const record = mapVrbResponse(suspended);
    expect(record?.status).toBe("SUSPENDED");
  });

  it("throws explicitly on malformed shape drift", () => {
    expect(() => mapVrbResponse(malformed)).toThrow(
      /VRB response did not match contract/,
    );
  });
});
