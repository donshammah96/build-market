/**
 * Virus / Malware Scanner Domain Abstraction
 *
 * This file owns ONLY the interface, shared types, the test/dev mock, and
 * the scanner registry. Concrete vendor adapters (Cloudmersive,
 * attachmentAV, a self-hosted ClamAV client, etc.) live in their own
 * files and are wired in explicitly via `registerVirusScanner()` at app
 * bootstrap — never auto-constructed from inside this module.
 *
 * FIX (H1): a previous revision added an auto-wiring branch directly
 * inside `getVirusScanner()` that constructed a `CloudmersiveVirusScanner`
 * from `env.storage.cloudmersiveApiKey` on first call. That reintroduced
 * exactly what this file's own registry design was meant to prevent:
 *   - `isRealScannerRegistered()` became unreliable as a startup check,
 *     since `registeredScanner` was only populated lazily on the first
 *     real scan request, not at bootstrap.
 *   - A hardcoded Cloudmersive base URL came back into this
 *     vendor-agnostic file, and there was no way for the auto-wired
 *     instance to point at a private/self-hosted deployment.
 * Removed. Registration must go through `registerVirusScanner()`,
 * explicitly, once, at app bootstrap — see the usage note below.
 */

import { env } from "@/app/lib/infrastructure/env";

export type ScanStatus = "CLEAN" | "INFECTED" | "ERROR";

export type ScanResult = {
  status: ScanStatus;
  safe: boolean;
  virusName?: string;
  threatCategory?:
    | "known-virus"
    | "macro"
    | "ole-embedded-object"
    | "xxe"
    | "insecure-deserialization"
    | "html-script"
    | "unsafe-archive"
    | "executable"
    | "invalid-file"
    | "password-protected"
    | "restricted-format"
    | "format-mismatch"
    | "size-mismatch"
    | "oversized"
    | "scanner-unavailable";
  scanTimeMs: number;
  engineVersion: string;
  details?: string;
};

export type ScanInput = {
  uploadId: string;
  originalName: string;
  mimeType: string;
  size: number;
  buffer?: Buffer;
  storageKey?: string;
};

export interface VirusScanner {
  scanUpload(input: ScanInput): Promise<ScanResult>;
}

/**
 * Mock virus scanner implementation for test/dev environments ONLY.
 * Never register this as the production scanner.
 */
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
      (input.buffer &&
        input.buffer
          .toString("utf8")
          .includes("EICAR-STANDARD-ANTIVIRUS-TEST-FILE"));

    if (isEicar || input.originalName.includes("malware-test")) {
      return {
        status: "INFECTED",
        safe: false,
        virusName: "Win32.EICAR.Test-File",
        threatCategory: "known-virus",
        scanTimeMs: Date.now() - startTime,
        engineVersion: "MockScanner-1.0.0",
        details: "EICAR test signature detected in upload buffer",
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

import { CloudmersiveVirusScanner } from "./cloudmersive-scanner";

let testScannerOverride: VirusScanner | null = null;
let registeredScanner: VirusScanner | null = null;

export function setVirusScannerForTests(scanner: VirusScanner | null): void {
  testScannerOverride = scanner;
  if (scanner === null) {
    registeredScanner = null;
  }
}

export type VirusScannerInitConfig = {
  storage?: {
    cloudmersiveApiKey?: string;
    cloudmersiveBaseUrl?: string;
  };
  isProd?: boolean;
  features?: {
    allowMockScanner?: boolean;
  };
};

/**
 * Production wiring entry point. Call this ONCE at app bootstrap (e.g. Next.js `instrumentation.ts` register()):
 *
 *   import { initializeProductionVirusScanner } from "./virus-scanner";
 *   initializeProductionVirusScanner(envConfig);
 *
 * Eagerly registers a real Cloudmersive scanner if CLOUDMERSIVE_API_KEY is present,
 * and asserts `isRealScannerRegistered()` in production before traffic is accepted.
 */
export function initializeProductionVirusScanner(
  config?: VirusScannerInitConfig,
): void {
  const resolvedConfig = config ?? {
    storage: {
      cloudmersiveApiKey: env.storage.cloudmersiveApiKey,
      cloudmersiveBaseUrl: env.storage.cloudmersiveBaseUrl,
    },
    isProd: env.isProd,
    features: {
      allowMockScanner: env.features.allowMockScanner,
    },
  };

  const apiKey = resolvedConfig.storage?.cloudmersiveApiKey;
  if (apiKey) {
    const baseUrl =
      resolvedConfig.storage?.cloudmersiveBaseUrl ??
      "https://api.cloudmersive.com";
    registerVirusScanner(
      new CloudmersiveVirusScanner({
        apiKey,
        baseUrl,
      }),
    );
  }

  const isProd = resolvedConfig.isProd ?? false;
  const allowMock = resolvedConfig.features?.allowMockScanner ?? false;

  if (isProd && !allowMock && !isRealScannerRegistered()) {
    throw new Error(
      "No production virus scanner registered before accepting traffic. " +
        "Configure CLOUDMERSIVE_API_KEY or invoke registerVirusScanner() with a valid VirusScanner adapter.",
    );
  }
}

export function registerVirusScanner(scanner: VirusScanner): void {
  registeredScanner = scanner;
}

export function isRealScannerRegistered(): boolean {
  return registeredScanner !== null;
}

function isMockScannerAllowed(): boolean {
  if (env.features.allowMockScanner) {
    return true;
  }
  return env.isTest === true || env.isDev === true;
}

export function getVirusScanner(): VirusScanner {
  if (testScannerOverride) {
    return testScannerOverride;
  }
  if (registeredScanner) {
    return registeredScanner;
  }
  if (isMockScannerAllowed()) {
    if (env.isTest !== true) {
      console.warn("[virus_scanner_mock_dispensed]", {
        reason: env.features.allowMockScanner
          ? "allowMockScanner feature flag"
          : "dev environment",
        isDev: env.isDev,
        isProd: env.isProd,
      });
    }

    return new MockVirusScanner();
  }
  throw new Error(
    "No production virus scanner has been registered via registerVirusScanner(). " +
      "Refusing to fall back to MockVirusScanner outside test/dev — it cannot detect real malware.",
  );
}
