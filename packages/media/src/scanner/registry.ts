import type { VirusScanner } from "./types.js";
import { MockVirusScanner } from "./mock-scanner.js";

let registeredScanner: VirusScanner | null = null;
let testScannerOverride: VirusScanner | null = null;

export function registerVirusScanner(scanner: VirusScanner): void {
  registeredScanner = scanner;
}

export function setVirusScannerForTests(scanner: VirusScanner | null): void {
  testScannerOverride = scanner;
}

export function getVirusScanner(options?: {
  allowMock?: boolean;
  isProd?: boolean;
}): VirusScanner {
  if (testScannerOverride) {
    return testScannerOverride;
  }
  if (registeredScanner) {
    return registeredScanner;
  }
  if (options?.allowMock || !options?.isProd) {
    return new MockVirusScanner();
  }
  throw new Error(
    "No production virus scanner registered before accepting traffic. Call registerVirusScanner() at application bootstrap.",
  );
}

export function isRealScannerRegistered(): boolean {
  return (
    registeredScanner !== null &&
    !(registeredScanner instanceof MockVirusScanner)
  );
}
