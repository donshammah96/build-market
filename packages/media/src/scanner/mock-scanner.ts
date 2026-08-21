import type { ScanInput, ScanResult, VirusScanner } from "./types.js";

const EICAR_SIGNATURE =
  "X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*";

export class MockVirusScanner implements VirusScanner {
  private simulateScanError: boolean = false;

  constructor(options?: { simulateScanError?: boolean }) {
    if (options?.simulateScanError) {
      this.simulateScanError = options.simulateScanError;
    }
  }

  async scanUpload(input: ScanInput): Promise<ScanResult> {
    const startTime = Date.now();

    if (
      this.simulateScanError ||
      input.originalName.includes("scan-error-trigger")
    ) {
      return {
        status: "ERROR",
        safe: false,
        threatCategory: "scanner-unavailable",
        scanTimeMs: Date.now() - startTime,
        engineVersion: "MockScanner-1.0.0",
        details: "Scanner service temporarily unavailable",
      };
    }

    const isEicar =
      input.originalName.includes("eicar") ||
      (input.buffer && input.buffer.toString("utf8").includes(EICAR_SIGNATURE));

    if (isEicar) {
      return {
        status: "INFECTED",
        safe: false,
        virusName: "Win32.EICAR.Test-File",
        threatCategory: "known-virus",
        scanTimeMs: Date.now() - startTime,
        engineVersion: "MockScanner-1.0.0",
        details: "EICAR standard antivirus test string detected",
      };
    }

    return {
      status: "CLEAN",
      safe: true,
      scanTimeMs: Date.now() - startTime,
      engineVersion: "MockScanner-1.0.0",
    };
  }
}
