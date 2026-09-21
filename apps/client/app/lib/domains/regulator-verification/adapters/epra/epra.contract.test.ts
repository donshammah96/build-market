import { describe, expect, it } from "vitest";
import { mapEpraResponse, EPRA_CONTRACT_VERSION } from "./contract";
import exactMatch from "./fixtures/exact_match.json";
import suspended from "./fixtures/suspended.json";
import malformed from "./fixtures/malformed.json";

describe("EPRA contract validation", () => {
  it("maps a valid license correctly with contract version", () => {
    const record = mapEpraResponse(exactMatch);
    expect(record).not.toBeNull();
    expect(record?.licenseNumber).toBe("EPRA-8899");
    expect(record?.holderName).toBe("Evans Ndegwa");
    expect(record?.companyName).toBe("Evannas Consulting Limited");
    expect(record?.status).toBe("ACTIVE");
    expect(record?.contractVersion).toBe(EPRA_CONTRACT_VERSION);
  });

  it("maps a suspended license correctly", () => {
    const record = mapEpraResponse(suspended);
    expect(record?.status).toBe("SUSPENDED");
  });

  it("throws explicitly on malformed shape drift", () => {
    expect(() => mapEpraResponse(malformed)).toThrow(
      /EPRA response did not match contract/,
    );
  });
});
