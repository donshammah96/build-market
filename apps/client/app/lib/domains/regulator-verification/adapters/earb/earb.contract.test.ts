import { describe, expect, it } from "vitest";
import { mapEarbResponse, EARB_CONTRACT_VERSION } from "./contract";
import exactMatch from "./fixtures/exact_match.json";
import suspended from "./fixtures/suspended.json";
import malformed from "./fixtures/malformed.json";

describe("EARB contract validation", () => {
  it("maps a registered estate agent correctly with contract version", () => {
    const record = mapEarbResponse(exactMatch);
    expect(record).not.toBeNull();
    expect(record?.licenseNumber).toBe("EARB-5544");
    expect(record?.holderName).toBe("Mary Agent");
    expect(record?.companyName).toBe("Prime Realty Ltd");
    expect(record?.status).toBe("ACTIVE");
    expect(record?.contractVersion).toBe(EARB_CONTRACT_VERSION);
  });

  it("maps a suspended license correctly", () => {
    const record = mapEarbResponse(suspended);
    expect(record?.status).toBe("SUSPENDED");
  });

  it("throws explicitly on malformed shape drift", () => {
    expect(() => mapEarbResponse(malformed)).toThrow(
      /EARB response did not match contract/,
    );
  });
});
