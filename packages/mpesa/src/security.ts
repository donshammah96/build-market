import { constants, publicEncrypt } from "node:crypto";
import { MpesaError } from "./errors.js";

/**
 * Daraja SecurityCredential uses the provider-issued public certificate and
 * RSA PKCS#1 v1.5 encryption. The private initiator password never leaves this
 * function and the returned value is safe to place in a provider request only.
 */
export function encryptSecurityCredential(
  initiatorPassword: string,
  certificatePem: string,
): string {
  if (!initiatorPassword || !certificatePem.includes("BEGIN")) {
    throw new MpesaError(
      "CONFIGURATION_ERROR",
      "A provider initiator password and PEM certificate are required",
    );
  }

  try {
    return publicEncrypt(
      { key: certificatePem, padding: constants.RSA_PKCS1_PADDING },
      Buffer.from(initiatorPassword, "utf8"),
    ).toString("base64");
  } catch {
    throw new MpesaError(
      "CONFIGURATION_ERROR",
      "The provider certificate could not encrypt the security credential",
    );
  }
}
