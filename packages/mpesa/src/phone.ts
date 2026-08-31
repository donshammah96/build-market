import { MpesaError } from "./errors.js";

const KENYAN_MOBILE = /^254[17]\d{8}$/;

export function normalizeKenyanPhone(input: string): string {
  const compact = input.replace(/[\s()\-]/g, "");
  const normalized = compact.startsWith("+254")
    ? compact.slice(1)
    : compact.startsWith("0")
      ? `254${compact.slice(1)}`
      : compact.startsWith("254")
        ? compact
        : `254${compact}`;

  if (!KENYAN_MOBILE.test(normalized)) {
    throw new MpesaError(
      "VALIDATION_ERROR",
      "Phone number must be a valid Kenyan mobile number",
    );
  }

  return normalized;
}

export function redactPhoneNumber(phoneNumber: string): string {
  if (phoneNumber.length < 6) return "[redacted]";
  return `${phoneNumber.slice(0, 4)}******${phoneNumber.slice(-2)}`;
}
