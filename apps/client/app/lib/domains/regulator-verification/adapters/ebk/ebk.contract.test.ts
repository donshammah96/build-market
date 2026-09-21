import { describe, expect, it } from "vitest";
import { mapEbkResponse, EBK_CONTRACT_VERSION } from "./contract";
import exactMatch from "./fixtures/exact_match.json";
import suspended from "./fixtures/suspended.json";
import malformed from "./fixtures/malformed.json";

describe("EBK contract validation", () => {
  it("maps an active engineer registration correctly with contract version", () => {
    const record = mapEbkResponse(exactMatch);
    expect(record).not.toBeNull();
    expect(record?.licenseNumber).toBe("EBK-9900");
    expect(record?.holderName).toBe("Samuel Civil");
    expect(record?.companyName).toBe("Apex Infrastructure");
    expect(record?.status).toBe("ACTIVE");
    expect(record?.contractVersion).toBe(EBK_CONTRACT_VERSION);
  });

  it("maps a suspended license correctly", () => {
    const record = mapEbkResponse(suspended);
    expect(record?.status).toBe("SUSPENDED");
  });

  it("throws explicitly on malformed shape drift", () => {
    expect(() => mapEbkResponse(malformed)).toThrow(
      /EBK response did not match contract/,
    );
  });
});
