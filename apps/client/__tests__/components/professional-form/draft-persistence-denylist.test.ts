import { describe, expect, it } from "vitest";

const DRAFT_DENYLIST: ReadonlySet<string> = new Set([
  "licenseNumber",
  "boardRegistrationNumber",
  "kraPin",
  "idNumber",
  "nationalId",
  "passportNumber",
  "uploadId",
  "previewUrl",
  "documents",
  "consents",
  "certificates",
  "idDocuments",
]);

function stripSensitiveFields(
  obj: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (DRAFT_DENYLIST.has(key)) continue;
    if (/\b(pin|passport|national.?id)\b/i.test(key)) continue;
    result[key] = value;
  }
  return result;
}

describe("Professional onboarding draft persistence denylist", () => {
  it("strips sensitive fields from draft state", () => {
    const rawState = {
      profession: "ARCHITECT",
      companyName: "Acme Designs",
      licenseNumber: "A12345",
      boardRegistrationNumber: "BORAQS-9876",
      kraPin: "A001234567Z",
      nationalId: "12345678",
      uploadId: "upl_abc123",
      previewUrl: "https://s3.amazonaws.com/bucket/doc.pdf",
      documents: [{ uploadId: "upl_1" }],
      consents: { termsAccepted: { accepted: true } },
      certificates: [{ file: {} }],
      idDocuments: [{ file: {} }],
      county: "Nairobi",
      yearsExperience: 5,
    };

    const sanitized = stripSensitiveFields(rawState);

    expect(sanitized.profession).toBe("ARCHITECT");
    expect(sanitized.companyName).toBe("Acme Designs");
    expect(sanitized.county).toBe("Nairobi");
    expect(sanitized.yearsExperience).toBe(5);

    // Denied fields must be removed
    expect(sanitized.licenseNumber).toBeUndefined();
    expect(sanitized.boardRegistrationNumber).toBeUndefined();
    expect(sanitized.kraPin).toBeUndefined();
    expect(sanitized.nationalId).toBeUndefined();
    expect(sanitized.uploadId).toBeUndefined();
    expect(sanitized.previewUrl).toBeUndefined();
    expect(sanitized.documents).toBeUndefined();
    expect(sanitized.consents).toBeUndefined();
    expect(sanitized.certificates).toBeUndefined();
    expect(sanitized.idDocuments).toBeUndefined();
  });
});
