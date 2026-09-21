import { createHmac, randomUUID, timingSafeEqual } from "crypto";
import { envConfig } from "@/app/lib/infrastructure/env";

export const PROFESSIONAL_ONBOARDING_INTENT_COOKIE = "bm_onboarding_intent";
export const PROFESSIONAL_ONBOARDING_INTENT_TTL_SECONDS = 60 * 60;

export type ProfessionalOnboardingIntent = {
  role: "professional";
  source: string;
  returnTo?: string;
  nonce: string;
  iat: number;
  exp: number;
};

function sign(value: string): string {
  return createHmac("sha256", envConfig.auth.secret)
    .update(value)
    .digest("base64url");
}

export function createProfessionalOnboardingIntent(input: {
  source: string;
  returnTo?: string;
  now?: number;
}): { value: string; expiresAt: Date } {
  const issuedAt = input.now ?? Date.now();
  const expiresAt = new Date(
    issuedAt + PROFESSIONAL_ONBOARDING_INTENT_TTL_SECONDS * 1000,
  );
  const payload = Buffer.from(
    JSON.stringify({
      role: "professional",
      source: input.source,
      returnTo: input.returnTo,
      nonce: randomUUID(),
      iat: issuedAt,
      exp: expiresAt.getTime(),
    } satisfies ProfessionalOnboardingIntent),
  ).toString("base64url");

  return { value: `${payload}.${sign(payload)}`, expiresAt };
}

export function verifyProfessionalOnboardingIntent(
  cookieValue: string | undefined | null,
  now = Date.now(),
): { ok: true; intent: ProfessionalOnboardingIntent } | { ok: false } {
  if (!cookieValue) return { ok: false };

  const [payload, signature] = cookieValue.split(".");
  if (!payload || !signature) return { ok: false };

  const expected = sign(payload);
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (
    signatureBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(signatureBuffer, expectedBuffer)
  ) {
    return { ok: false };
  }

  try {
    const parsed = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    ) as Partial<ProfessionalOnboardingIntent>;

    if (parsed.role !== "professional" || typeof parsed.exp !== "number") {
      return { ok: false };
    }
    if (parsed.exp <= now) return { ok: false };

    return { ok: true, intent: parsed as ProfessionalOnboardingIntent };
  } catch {
    return { ok: false };
  }
}
