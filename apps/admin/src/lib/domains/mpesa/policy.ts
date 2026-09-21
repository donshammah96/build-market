import { createHmac } from "node:crypto";
import { adminEnvConfig } from "@/lib/infrastructure/env-schema";

export function validatePayoutAmount(amount: number): boolean {
  return Number.isInteger(amount) && amount > 0 && amount <= 150_000;
}

export function maskKenyanPhone(phone: string): string {
  if (!phone || phone.length < 6) return "***";
  return phone.slice(0, 4) + "****" + phone.slice(-3);
}

export function computePhoneSearchHash(
  phone: string,
  explicitSalt?: string,
): string {
  const salt =
    explicitSalt ??
    adminEnvConfig.MPESA_PHONE_SEARCH_HASH_SECRET ??
    (adminEnvConfig.NODE_ENV === "test"
      ? "test_phone_search_hash_salt_only"
      : undefined);

  if (!salt) {
    throw new Error(
      "[Security] MPESA_PHONE_SEARCH_HASH_SECRET is required through environment configuration to compute phone search hash",
    );
  }

  const cleaned = phone.replace(/[^\d]/g, "");
  return createHmac("sha256", salt).update(cleaned).digest("hex");
}
