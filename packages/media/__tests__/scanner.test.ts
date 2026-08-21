import { describe, expect, it, beforeEach } from "vitest";
import {
  CloudmersiveVirusScanner,
  MockVirusScanner,
  getVirusScanner,
  setVirusScannerForTests,
} from "../src/index.js";

describe("@build/media VirusScanner", () => {
  beforeEach(() => {
    setVirusScannerForTests(null);
  });

  it("identifies EICAR string as INFECTED", async () => {
    const scanner = new MockVirusScanner();
    const eicarBuffer = Buffer.from(
      "X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*",
    );

    const result = await scanner.scanUpload({
      uploadId: "test_up_1",
      originalName: "test.png",
      mimeType: "image/png",
      size: eicarBuffer.length,
      buffer: eicarBuffer,
    });

    expect(result.status).toBe("INFECTED");
    expect(result.safe).toBe(false);
    expect(result.virusName).toBe("Win32.EICAR.Test-File");
  });

  it("identifies clean buffers as CLEAN", async () => {
    const scanner = new MockVirusScanner();
    const cleanBuffer = Buffer.from("clean image content");

    const result = await scanner.scanUpload({
      uploadId: "test_up_2",
      originalName: "photo.jpg",
      mimeType: "image/jpeg",
      size: cleanBuffer.length,
      buffer: cleanBuffer,
    });

    expect(result.status).toBe("CLEAN");
    expect(result.safe).toBe(true);
  });

  it("handles scanner errors fail-closed", async () => {
    const scanner = new MockVirusScanner({ simulateScanError: true });
    const result = await scanner.scanUpload({
      uploadId: "test_up_3",
      originalName: "doc.pdf",
      mimeType: "application/pdf",
      size: 100,
      buffer: Buffer.from("test"),
    });

    expect(result.status).toBe("ERROR");
    expect(result.safe).toBe(false);
    expect(result.threatCategory).toBe("scanner-unavailable");
  });

  it("throws when no scanner registered in production without allowMock", () => {
    expect(() => getVirusScanner({ isProd: true, allowMock: false })).toThrow(
      /No production virus scanner registered/,
    );
  });

  it("allows MockVirusScanner when allowMock is true", () => {
    const scanner = getVirusScanner({ isProd: true, allowMock: true });
    expect(scanner).toBeInstanceOf(MockVirusScanner);
  });

  describe("CloudmersiveVirusScanner", () => {
    it("throws if apiKey is missing", () => {
      expect(() => new CloudmersiveVirusScanner({ apiKey: "" })).toThrow(
        /requires a non-empty apiKey/,
      );
    });

    it("trims trailing slashes linearly from baseUrl", () => {
      const scanner = new CloudmersiveVirusScanner({
        apiKey: "test-key",
        baseUrl: "https://custom-api.cloudmersive.com///",
      });
      // Verify baseUrl is trimmed without trailing slashes
      expect((scanner as unknown as { baseUrl: string }).baseUrl).toBe(
        "https://custom-api.cloudmersive.com",
      );
    });

    it("defaults baseUrl to api.cloudmersive.com when not provided", () => {
      const scanner = new CloudmersiveVirusScanner({
        apiKey: "test-key",
      });
      expect((scanner as unknown as { baseUrl: string }).baseUrl).toBe(
        "https://api.cloudmersive.com",
      );
    });
  });
});
