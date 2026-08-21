import type { ScanInput, ScanResult, VirusScanner } from "./types.js";

export type CloudmersiveConfig = {
  apiKey: string;
  baseUrl?: string;
  timeoutMs?: number;
  maxRetries?: number;
};

type CloudmersiveAdvancedScanResponse = {
  CleanResult: boolean;
  FoundViruses?: Array<{ FileName: string; VirusName: string }> | null;
  ContainsExecutable: boolean;
  ContainsInvalidFile: boolean;
  ContainsScript: boolean;
  ContainsPasswordProtectedFile: boolean;
  ContainsRestrictedFileFormat: boolean;
  ContainsMacros: boolean;
  ContainsXmlExternalEntities: boolean;
  ContainsInsecureDeserialization: boolean;
  ContainsHtml: boolean;
  ContainsUnsafeArchive: boolean;
  ContainsOleEmbeddedObject: boolean;
  VerifiedFileFormat?: string;
};

type StructuralThreat = {
  reason: string;
  category: NonNullable<ScanResult["threatCategory"]>;
};

function structuralThreat(
  result: CloudmersiveAdvancedScanResponse,
): StructuralThreat | null {
  if (result.ContainsExecutable)
    return { reason: "Contains an executable payload", category: "executable" };
  if (result.ContainsInvalidFile)
    return {
      reason: "File failed format validation",
      category: "invalid-file",
    };
  if (result.ContainsScript)
    return {
      reason: "Contains embedded script content",
      category: "html-script",
    };
  if (result.ContainsPasswordProtectedFile)
    return {
      reason: "Password-protected files cannot be scanned and are rejected",
      category: "password-protected",
    };
  if (result.ContainsRestrictedFileFormat)
    return {
      reason: "File format is restricted by policy",
      category: "restricted-format",
    };
  if (result.ContainsMacros)
    return { reason: "Contains macros", category: "macro" };
  if (result.ContainsXmlExternalEntities)
    return {
      reason: "Contains XML External Entities (XXE)",
      category: "xxe",
    };
  if (result.ContainsInsecureDeserialization)
    return {
      reason: "Contains insecure deserialization payload",
      category: "insecure-deserialization",
    };
  if (result.ContainsHtml)
    return {
      reason: "Contains HTML or script content",
      category: "html-script",
    };
  if (result.ContainsUnsafeArchive)
    return {
      reason: "Archive contains unsafe structure or recursion",
      category: "unsafe-archive",
    };
  if (result.ContainsOleEmbeddedObject)
    return {
      reason: "Contains embedded OLE object",
      category: "ole-embedded-object",
    };
  return null;
}

export class CloudmersiveVirusScanner implements VirusScanner {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;

  constructor(config: CloudmersiveConfig) {
    if (!config.apiKey) {
      throw new Error("CloudmersiveVirusScanner requires a non-empty apiKey.");
    }
    this.apiKey = config.apiKey;
    this.baseUrl = (config.baseUrl ?? "https://api.cloudmersive.com").replace(
      /\/+$/,
      "",
    );
    this.timeoutMs = config.timeoutMs ?? 20_000;
    this.maxRetries = config.maxRetries ?? 2;
  }

  async scanUpload(input: ScanInput): Promise<ScanResult> {
    const startTime = Date.now();

    if (!input.buffer) {
      return {
        status: "ERROR",
        safe: false,
        threatCategory: "scanner-unavailable",
        scanTimeMs: Date.now() - startTime,
        engineVersion: "Cloudmersive-Advanced-v2",
        details: "No buffer provided for Cloudmersive scan",
      };
    }

    const endpoint = `${this.baseUrl}/virus/scan/file/advanced`;
    let lastError: unknown;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const formData = new FormData();
        const blob = new Blob([new Uint8Array(input.buffer)], {
          type: input.mimeType || "application/octet-stream",
        });
        formData.append("inputFile", blob, input.originalName || "upload.bin");

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

        let response: Response;
        try {
          response = await fetch(endpoint, {
            method: "POST",
            headers: {
              Apikey: this.apiKey,
            },
            body: formData,
            signal: controller.signal,
          });
        } finally {
          clearTimeout(timeout);
        }

        if (!response.ok) {
          if (response.status >= 500 && attempt < this.maxRetries) {
            await new Promise((r) => setTimeout(r, 200 * (attempt + 1)));
            continue;
          }
          const text = await response.text().catch(() => "");
          return {
            status: "ERROR",
            safe: false,
            threatCategory: "scanner-unavailable",
            scanTimeMs: Date.now() - startTime,
            engineVersion: "Cloudmersive-Advanced-v2",
            details: `Cloudmersive HTTP ${response.status}: ${text.slice(0, 200)}`,
          };
        }

        const data =
          (await response.json()) as CloudmersiveAdvancedScanResponse;

        if (data.CleanResult) {
          return {
            status: "CLEAN",
            safe: true,
            scanTimeMs: Date.now() - startTime,
            engineVersion: "Cloudmersive-Advanced-v2",
          };
        }

        // Check viruses
        if (data.FoundViruses && data.FoundViruses.length > 0) {
          const virusName =
            data.FoundViruses[0]?.VirusName ?? "Malware.Detected";
          return {
            status: "INFECTED",
            safe: false,
            virusName,
            threatCategory: "known-virus",
            scanTimeMs: Date.now() - startTime,
            engineVersion: "Cloudmersive-Advanced-v2",
            details: `Identified virus: ${virusName}`,
          };
        }

        // Check structural threats
        const threat = structuralThreat(data);
        if (threat) {
          return {
            status: "INFECTED",
            safe: false,
            threatCategory: threat.category,
            scanTimeMs: Date.now() - startTime,
            engineVersion: "Cloudmersive-Advanced-v2",
            details: threat.reason,
          };
        }

        return {
          status: "INFECTED",
          safe: false,
          threatCategory: "known-virus",
          scanTimeMs: Date.now() - startTime,
          engineVersion: "Cloudmersive-Advanced-v2",
          details: "Vendor flagged file as unclean without named virus",
        };
      } catch (err) {
        lastError = err;
        if (attempt < this.maxRetries) {
          await new Promise((r) => setTimeout(r, 200 * (attempt + 1)));
          continue;
        }
      }
    }

    return {
      status: "ERROR",
      safe: false,
      threatCategory: "scanner-unavailable",
      scanTimeMs: Date.now() - startTime,
      engineVersion: "Cloudmersive-Advanced-v2",
      details:
        lastError instanceof Error ? lastError.message : String(lastError),
    };
  }
}
