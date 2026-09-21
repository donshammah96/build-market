import { describe, expect, it } from "vitest";
import { mapNcaResponse, NCA_CONTRACT_VERSION } from "./contract";
import exactMatch from "./fixtures/exact_match.json";
import suspended from "./fixtures/suspended.json";
import malformed from "./fixtures/malformed.json";

describe("NCA contract validation", () => {
  it("maps an active license correctly with contract version", () => {
    const record = mapNcaResponse(exactMatch);
    expect(record).not.toBeNull();
    expect(record?.licenseNumber).toBe("NCA-12345");
    expect(record?.holderName).toBe("Don Shammah");
    expect(record?.companyName).toBe("Shammah Builders Ltd");
    expect(record?.status).toBe("ACTIVE");
    expect(record?.contractVersion).toBe(NCA_CONTRACT_VERSION);
  });

  it("maps a suspended license correctly", () => {
    const record = mapNcaResponse(suspended);
    expect(record?.status).toBe("SUSPENDED");
  });

  it("throws explicitly on malformed shape drift", () => {
    expect(() => mapNcaResponse(malformed)).toThrow(
      /NCA response did not match contract/,
    );
  });
});
