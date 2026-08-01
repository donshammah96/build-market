import { createHmac, randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiError, apiSuccess, HttpStatus } from "@/app/lib/api/api-response";
import {
  checkRateLimit,
  getActorRateLimitIdentifier,
  RateLimits,
} from "@/app/lib/api/rate-limit";
import { envConfig } from "@/app/lib/infrastructure/env";
import { ROUTES } from "@/lib/links";

const INTENT_COOKIE = "bm_onboarding_intent";
const INTENT_TTL_SECONDS = 60 * 60;

const IntentSchema = z.object({
  role: z.literal("professional"),
  source: z.string().min(1).max(80).default("professional_landing"),
  returnTo: z.string().startsWith("/").max(200).optional(),
});

function sign(value: string): string {
  return createHmac("sha256", envConfig.auth.secret)
    .update(value)
    .digest("base64url");
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const rateLimitResult = await checkRateLimit(
    getActorRateLimitIdentifier(
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "anonymous",
      "onboarding-intent",
    ),
    RateLimits.AUTH.limit,
    RateLimits.AUTH.window,
  );

  if (!rateLimitResult.success) {
    return apiError(
      "Too many requests. Please try again later.",
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("Invalid JSON body", HttpStatus.BAD_REQUEST);
  }

  const parsed = IntentSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(
      "Unsupported onboarding intent",
      HttpStatus.BAD_REQUEST,
      parsed.error.issues.map((issue) => issue.path.join(".")),
    );
  }

  const issuedAt = Date.now();
  const expiresAt = new Date(issuedAt + INTENT_TTL_SECONDS * 1000);
  const payload = Buffer.from(
    JSON.stringify({
      role: parsed.data.role,
      source: parsed.data.source,
      returnTo: parsed.data.returnTo,
      nonce: randomUUID(),
      iat: issuedAt,
      exp: expiresAt.getTime(),
    }),
  ).toString("base64url");
  const cookieValue = `${payload}.${sign(payload)}`;

  const response = apiSuccess(
    { signUpUrl: ROUTES.joinAsPro, expiresAt: expiresAt.toISOString() },
    HttpStatus.OK,
  );
  response.cookies.set(INTENT_COOKIE, cookieValue, {
    httpOnly: true,
    sameSite: "lax",
    secure: envConfig.isProd,
    path: "/",
    maxAge: INTENT_TTL_SECONDS,
  });

  return response;
}
