import { describe, expect, it } from "vitest";
import { mapIskResponse, ISK_CONTRACT_VERSION } from "./contract";
import exactMatch from "./fixtures/exact_match.json";
import suspended from "./fixtures/suspended.json";
import malformed from "./fixtures/malformed.json";

describe("ISK contract validation", () => {
  it("maps an active surveyor member correctly with contract version", () => {
    const record = mapIskResponse(exactMatch);
    expect(record).not.toBeNull();
    expect(record?.licenseNumber).toBe("ISK-3322");
    expect(record?.holderName).toBe("Sarah Surveyor");
    expect(record?.companyName).toBe("Geospatial Associates");
    expect(record?.status).toBe("ACTIVE");
    expect(record?.contractVersion).toBe(ISK_CONTRACT_VERSION);
  });

  it("maps a suspended license correctly", () => {
    const record = mapIskResponse(suspended);
    expect(record?.status).toBe("SUSPENDED");
  });

  it("throws explicitly on malformed shape drift", () => {
    expect(() => mapIskResponse(malformed)).toThrow(
      /ISK response did not match contract/,
    );
  });
});
