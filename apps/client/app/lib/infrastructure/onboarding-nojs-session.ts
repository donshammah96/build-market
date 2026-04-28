import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { env } from "@/app/lib/infrastructure/env";

/**
 * No-JS onboarding step session.
 *
 * ADR-006: This session may only store Class C and Class D data.
 * Prohibited: national ID, passport numbers, license numbers, email, phone
 *   (Class A and Class B - see ADR-006).
 * Permitted: step index, selected role, non-sensitive profile structure fields
 *   (companyName, county, city, profession enum, years of experience).
 *
 * Clerk-side session (via auth()) provides identity. This session provides
 * only onboarding step continuity.
 */

const ONBOARDING_NOJS_COOKIE_NAME = "bm_onboarding_nojs";
const ONBOARDING_NOJS_COOKIE_PATH = "/onboarding/no-js";
const ONBOARDING_NOJS_TTL_SECONDS = 60 * 60;
const ONBOARDING_NOJS_SESSION_VERSION = 1;

type UnknownRecord = Record<string, unknown>;

export type NoJsOnboardingRole = "client" | "professional";

export type NoJsClientDraft = {
  type: string;
  county: string;
  city?: string;
  companyName?: string;
  projectType?: string;
  projectLocation?: string;
  estimatedBudget?: string;
  description?: string;
};

export type NoJsProfessionalDraft = {
  profession: string;
  companyName: string;
  county: string;
  city?: string;
  yearsExperience?: number;
};

export type OnboardingNoJsSession = {
  version: typeof ONBOARDING_NOJS_SESSION_VERSION;
  role: NoJsOnboardingRole | null;
  client?: NoJsClientDraft;
  professional?: NoJsProfessionalDraft;
  createdAt: number;
  updatedAt: number;
  expiresAt: number;
};

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null;
}

function toOptionalString(value: unknown, maxLength = 255): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  return trimmed.slice(0, maxLength);
}

function toRequiredString(value: unknown, maxLength = 255): string | undefined {
  const normalized = toOptionalString(value, maxLength);
  if (!normalized) {
    return undefined;
  }

  return normalized;
}

function toNonNegativeInteger(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isInteger(value) && value >= 0) {
    return value;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number.parseInt(value, 10);
    if (Number.isInteger(parsed) && parsed >= 0) {
      return parsed;
    }
  }

  return undefined;
}

function normalizeRole(value: unknown): NoJsOnboardingRole | null {
  if (value === "client" || value === "professional") {
    return value;
  }

  return null;
}

function sanitizeClientDraft(value: unknown): NoJsClientDraft | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const type = toRequiredString(value.type, 60);
  const county = toRequiredString(value.county, 60);

  if (!type || !county) {
    return undefined;
  }

  return {
    type,
    county,
    city: toOptionalString(value.city, 120),
    companyName: toOptionalString(value.companyName, 150),
    projectType: toOptionalString(value.projectType, 120),
    projectLocation: toOptionalString(value.projectLocation, 150),
    estimatedBudget: toOptionalString(value.estimatedBudget, 80),
    description: toOptionalString(value.description, 500),
  };
}

function sanitizeProfessionalDraft(
  value: unknown,
): NoJsProfessionalDraft | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const profession = toRequiredString(value.profession, 80);
  const companyName = toRequiredString(value.companyName, 150);
  const county = toRequiredString(value.county, 60);

  if (!profession || !companyName || !county) {
    return undefined;
  }

  return {
    profession,
    companyName,
    county,
    city: toOptionalString(value.city, 120),
    yearsExperience: toNonNegativeInteger(value.yearsExperience),
  };
}

function toBase64Url(input: string): string {
  return Buffer.from(input, "utf8").toString("base64url");
}

function fromBase64Url(input: string): string | null {
  try {
    return Buffer.from(input, "base64url").toString("utf8");
  } catch {
    return null;
  }
}

function getSessionSigningKey(): string {
  return `onboarding-nojs-session:${env.encryption.keys.v1}`;
}

function signSessionPayload(payload: string): string {
  return createHmac("sha256", getSessionSigningKey())
    .update(payload)
    .digest("base64url");
}

function secureCompareSignature(actual: string, expected: string): boolean {
  const actualBuffer = Buffer.from(actual);
  const expectedBuffer = Buffer.from(expected);

  if (actualBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return timingSafeEqual(actualBuffer, expectedBuffer);
}

function buildNewSession(): OnboardingNoJsSession {
  const now = Date.now();

  return {
    version: ONBOARDING_NOJS_SESSION_VERSION,
    role: null,
    createdAt: now,
    updatedAt: now,
    expiresAt: now + ONBOARDING_NOJS_TTL_SECONDS * 1000,
  };
}

function touchSession(session: OnboardingNoJsSession): OnboardingNoJsSession {
  const now = Date.now();

  return {
    ...session,
    updatedAt: now,
    expiresAt: now + ONBOARDING_NOJS_TTL_SECONDS * 1000,
  };
}

function encodeSession(session: OnboardingNoJsSession): string {
  const payload = toBase64Url(JSON.stringify(session));
  const signature = signSessionPayload(payload);
  return `${payload}.${signature}`;
}

function decodeSession(cookieValue: string): OnboardingNoJsSession | null {
  const [payload, signature] = cookieValue.split(".");
  if (!payload || !signature) {
    return null;
  }

  const expectedSignature = signSessionPayload(payload);
  if (!secureCompareSignature(signature, expectedSignature)) {
    return null;
  }

  const decodedPayload = fromBase64Url(payload);
  if (!decodedPayload) {
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(decodedPayload);
  } catch {
    return null;
  }

  if (!isRecord(parsed)) {
    return null;
  }

  const role = normalizeRole(parsed.role);
  const createdAt =
    typeof parsed.createdAt === "number" ? parsed.createdAt : Date.now();
  const updatedAt =
    typeof parsed.updatedAt === "number" ? parsed.updatedAt : createdAt;
  const expiresAt =
    typeof parsed.expiresAt === "number" ? parsed.expiresAt : updatedAt;

  return {
    version: ONBOARDING_NOJS_SESSION_VERSION,
    role,
    client: sanitizeClientDraft(parsed.client),
    professional: sanitizeProfessionalDraft(parsed.professional),
    createdAt,
    updatedAt,
    expiresAt,
  };
}

async function writeSessionCookie(
  session: OnboardingNoJsSession,
): Promise<void> {
  const cookieStore = await cookies();

  cookieStore.set(ONBOARDING_NOJS_COOKIE_NAME, encodeSession(session), {
    httpOnly: true,
    sameSite: "strict",
    secure: env.isProd,
    path: ONBOARDING_NOJS_COOKIE_PATH,
    maxAge: ONBOARDING_NOJS_TTL_SECONDS,
  });
}

export async function readOnboardingNoJsSession(): Promise<OnboardingNoJsSession | null> {
  const cookieStore = await cookies();
  const cookieValue = cookieStore.get(ONBOARDING_NOJS_COOKIE_NAME)?.value;

  if (!cookieValue) {
    return null;
  }

  const parsed = decodeSession(cookieValue);
  if (!parsed) {
    return null;
  }

  if (parsed.expiresAt <= Date.now()) {
    return null;
  }

  return parsed;
}

export async function setOnboardingNoJsRole(
  role: NoJsOnboardingRole,
): Promise<OnboardingNoJsSession> {
  const current = (await readOnboardingNoJsSession()) ?? buildNewSession();
  const next = touchSession({
    ...current,
    role,
    ...(role === "client"
      ? { professional: undefined }
      : { client: undefined }),
  });

  await writeSessionCookie(next);
  return next;
}

export async function setOnboardingNoJsClientDraft(
  draft: NoJsClientDraft,
): Promise<OnboardingNoJsSession> {
  const current = (await readOnboardingNoJsSession()) ?? buildNewSession();
  const next = touchSession({
    ...current,
    role: "client",
    client: {
      type: draft.type,
      county: draft.county,
      city: draft.city,
      companyName: draft.companyName,
      projectType: draft.projectType,
      projectLocation: draft.projectLocation,
      estimatedBudget: draft.estimatedBudget,
      description: draft.description,
    },
    professional: undefined,
  });

  await writeSessionCookie(next);
  return next;
}

export async function setOnboardingNoJsProfessionalDraft(
  draft: NoJsProfessionalDraft,
): Promise<OnboardingNoJsSession> {
  const current = (await readOnboardingNoJsSession()) ?? buildNewSession();
  const next = touchSession({
    ...current,
    role: "professional",
    professional: {
      profession: draft.profession,
      companyName: draft.companyName,
      county: draft.county,
      city: draft.city,
      yearsExperience: draft.yearsExperience,
    },
    client: undefined,
  });

  await writeSessionCookie(next);
  return next;
}

export async function clearOnboardingNoJsSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(ONBOARDING_NOJS_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "strict",
    secure: env.isProd,
    path: ONBOARDING_NOJS_COOKIE_PATH,
    maxAge: 0,
  });
}
