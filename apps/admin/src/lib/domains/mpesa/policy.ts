import { createHmac } from "node:crypto";

export function validatePayoutAmount(amount: number): boolean {
  return Number.isInteger(amount) && amount > 0 && amount <= 150_000;
}

export function maskKenyanPhone(phone: string): string {
  if (!phone || phone.length < 6) return "***";
  return phone.slice(0, 4) + "****" + phone.slice(-3);
}

export function computePhoneSearchHash(
  phone: string,
  salt = "buildmarket_phone_hmac_salt",
): string {
  const cleaned = phone.replace(/[^\d]/g, "");
  return createHmac("sha256", salt).update(cleaned).digest("hex");
}
