import { describe, expect, it } from "vitest";
import { mapBoraqsResponse, BORAQS_CONTRACT_VERSION } from "./contract";
import exactMatch from "./fixtures/exact_match.json";
import suspended from "./fixtures/suspended.json";
import malformed from "./fixtures/malformed.json";

describe("BORAQS contract validation", () => {
  it("maps a registered practitioner correctly with contract version", () => {
    const record = mapBoraqsResponse(exactMatch);
    expect(record).not.toBeNull();
    expect(record?.licenseNumber).toBe("A1234");
    expect(record?.holderName).toBe("David Architect");
    expect(record?.companyName).toBe("Studio Design Ltd");
    expect(record?.status).toBe("ACTIVE");
    expect(record?.contractVersion).toBe(BORAQS_CONTRACT_VERSION);
  });

  it("maps a suspended license correctly", () => {
    const record = mapBoraqsResponse(suspended);
    expect(record?.status).toBe("SUSPENDED");
  });

  it("throws explicitly on malformed shape drift", () => {
    expect(() => mapBoraqsResponse(malformed)).toThrow(
      /BORAQS response did not match contract/,
    );
  });
});
