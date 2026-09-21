import { describe, expect, it } from "vitest";
import {
  MockVirusScanner,
  initializeProductionVirusScanner,
  isRealScannerRegistered,
  setVirusScannerForTests,
  type ScanInput,
} from "@/app/lib/domains/uploads/virus-scanner";

describe("MockVirusScanner Domain Service", () => {
  it("returns CLEAN for standard valid file scan input", async () => {
    const scanner = new MockVirusScanner();
    const input: ScanInput = {
      uploadId: "upl_123",
      originalName: "business-license.pdf",
      mimeType: "application/pdf",
      size: 10245,
    };

    const result = await scanner.scanUpload(input);

    expect(result.status).toBe("CLEAN");
    expect(result.safe).toBe(true);
    expect(result.scanTimeMs).toBeGreaterThanOrEqual(0);
    expect(result.engineVersion).toBeDefined();
  });

  it("returns INFECTED for file with EICAR malware test string or filename", async () => {
    const scanner = new MockVirusScanner();
    const input: ScanInput = {
      uploadId: "upl_bad",
      originalName: "eicar-test-sample.com",
      mimeType: "application/x-msdownload",
      size: 68,
      buffer: Buffer.from(
        "X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*",
      ),
    };

    const result = await scanner.scanUpload(input);

    expect(result.status).toBe("INFECTED");
    expect(result.safe).toBe(false);
    expect(result.virusName).toBe("Win32.EICAR.Test-File");
    expect(result.details).toContain("EICAR test signature");
  });

  it("returns ERROR when scanner outage occurs", async () => {
    const scanner = new MockVirusScanner({ simulateScanError: true });
    const input: ScanInput = {
      uploadId: "upl_err",
      originalName: "tax-document.pdf",
      mimeType: "application/pdf",
      size: 5000,
    };

    const result = await scanner.scanUpload(input);

    expect(result.status).toBe("ERROR");
    expect(result.safe).toBe(false);
    expect(result.details).toContain("Scanner service temporarily unavailable");
  });

  describe("initializeProductionVirusScanner Entry Point", () => {
    it("registers CloudmersiveVirusScanner when API key is provided", () => {
      initializeProductionVirusScanner({
        storage: {
          cloudmersiveApiKey: "test_cloudmersive_api_key_123",
          cloudmersiveBaseUrl: "https://api.cloudmersive.com",
        },
        isProd: false,
      });

      expect(isRealScannerRegistered()).toBe(true);
    });

    it("throws fatal error in production if no scanner registered and mock not allowed", () => {
      // Reset registered scanner state
      setVirusScannerForTests(null);

      expect(() => {
        initializeProductionVirusScanner({
          storage: { cloudmersiveApiKey: undefined },
          isProd: true,
          features: { allowMockScanner: false },
        });
      }).toThrow(
        /No production virus scanner registered before accepting traffic/,
      );
    });
  });
});
