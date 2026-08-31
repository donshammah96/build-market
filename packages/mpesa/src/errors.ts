export type MpesaErrorCode =
  | "CONFIGURATION_ERROR"
  | "VALIDATION_ERROR"
  | "AUTHENTICATION_ERROR"
  | "PROVIDER_ERROR"
  | "PROVIDER_TIMEOUT"
  | "INVALID_PROVIDER_RESPONSE";

export class MpesaError extends Error {
  constructor(
    public readonly code: MpesaErrorCode,
    message: string,
    public readonly retryable = false,
  ) {
    super(message);
    this.name = "MpesaError";
  }
}
