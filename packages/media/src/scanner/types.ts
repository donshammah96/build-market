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
