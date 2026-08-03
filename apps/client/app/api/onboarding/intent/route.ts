import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiError, apiSuccess, HttpStatus } from "@/app/lib/api/api-response";
import {
  checkRateLimit,
  getActorRateLimitIdentifier,
  RateLimits,
} from "@/app/lib/api/rate-limit";
import { envConfig } from "@/app/lib/infrastructure/env";
import {
  createProfessionalOnboardingIntent,
  PROFESSIONAL_ONBOARDING_INTENT_COOKIE,
  PROFESSIONAL_ONBOARDING_INTENT_TTL_SECONDS,
} from "@/app/lib/auth/professional-onboarding-intent";
import { ROUTES } from "@/lib/links";

const SafeReturnToSchema = z
  .string()
  .startsWith("/")
  .max(200)
  .refine((value) => !value.startsWith("//"), {
    message: "returnTo must be an application-relative path",
  });

const IntentSchema = z.object({
  role: z.literal("professional"),
  source: z.string().min(1).max(80).default("professional_landing"),
  returnTo: SafeReturnToSchema.optional(),
});

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

  const intent = createProfessionalOnboardingIntent({
    source: parsed.data.source,
    returnTo: parsed.data.returnTo,
  });

  const response = apiSuccess(
    { signUpUrl: ROUTES.joinAsPro, expiresAt: intent.expiresAt.toISOString() },
    HttpStatus.OK,
  );
  response.cookies.set(PROFESSIONAL_ONBOARDING_INTENT_COOKIE, intent.value, {
    httpOnly: true,
    sameSite: "lax",
    secure: envConfig.isProd,
    path: "/",
    maxAge: PROFESSIONAL_ONBOARDING_INTENT_TTL_SECONDS,
  });

  return response;
}
