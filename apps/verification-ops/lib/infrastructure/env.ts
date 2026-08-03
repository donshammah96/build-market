/**
 * apps/verification-ops — Environment Variable Validation
 * =========================================================
 * Mirrors the ADR-004 pattern from apps/client
 * (`lib/infrastructure/env.ts`): all process.env reads in this app
 * should go through this module, not scattered raw `process.env.X` calls.
 *
 * SCOPE NOTE: this is a deliberately small, self-contained copy of the
 * validation *engine* (EnvVar/EnvGroup/validateEnv/helpers) rather than a
 * shared import from apps/client, because apps/client's env.ts is scoped to
 * that app (see its own header comment) and isn't published as a package.
 * This duplication is small today (3 groups) but will drift the same way
 * @build/verification-domain's types drifted from schema.prisma if it's
 * copy-pasted again for a third app. RECOMMENDATION: extract the generic
 * engine (types + validateEnv + getStringEnv/getOptionalStringEnv/
 * getNumberEnv/getBooleanEnv) into a `@build/env-validation` package once a
 * third app needs this, and have both apps.
 *
 * Usage:
 *   import { envConfig, validateEnv } from "@/lib/infrastructure/env";
 *   validateEnv(); // call once, early — see middleware.ts / instrumentation.ts
 *
 * SATELLITE UPDATE: this app is now a Clerk satellite of apps/client
 * (buildmarket.app), mirroring apps/admin's setup. Added
 * NEXT_PUBLIC_CLERK_IS_SATELLITE / NEXT_PUBLIC_CLERK_DOMAIN /
 * NEXT_PUBLIC_CLERK_PRIMARY_SIGN_IN_URL to the `clerk` group below. See
 * layout.tsx and middleware.ts for how these are consumed — both must be
 * kept in sync with apps/admin's equivalent files.
 */

import { toBool } from "./env-utils";

type EnvVar = {
  name: string;
  required: boolean;
  default?: string;
  validate?: (value: string) => boolean;
  errorMessage?: string;
};

type EnvGroup = {
  name: string;
  description: string;
  variables: EnvVar[];
};

export type ValidationResult = {
  valid: boolean;
  errors: string[];
  warnings: string[];
};

/** Returns true only if `value` parses as a well-formed absolute http(s) URL. */
function isAbsoluteHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

const envGroups: EnvGroup[] = [
  {
    name: "clerk",
    description:
      "Clerk Authentication (shared Clerk instance with apps/client)",
    variables: [
      { name: "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", required: true },
      { name: "CLERK_SECRET_KEY", required: true },
      // No CLERK_WEBHOOK_SECRET here on purpose — this app does not receive
      // Clerk webhooks; that's owned by apps/client. Requiring it here would
      // just be a second place to keep the same secret in sync for no
      // functional reason.
      {
        name: "NEXT_PUBLIC_CLERK_SIGN_IN_URL",
        required: false,
        default: "/sign-in",
      },
      // --- Satellite configuration (mirrors apps/admin) -----------------
      // Not required: this app must keep working (as a plain, non-satellite
      // Clerk consumer) in local dev / any environment where satellite mode
      // hasn't been configured yet. The *consequence* of isSatellite=true
      // with a missing/invalid primarySignInUrl is enforced at runtime in
      // layout.tsx (fail fast) and middleware.ts (fail open + log), not
      // here — this engine validates individual vars, not cross-var
      // invariants.
      {
        name: "NEXT_PUBLIC_CLERK_IS_SATELLITE",
        required: false,
        default: "false",
      },
      {
        name: "NEXT_PUBLIC_CLERK_DOMAIN",
        required: false,
      },
      {
        name: "NEXT_PUBLIC_CLERK_PRIMARY_SIGN_IN_URL",
        required: false,
        validate: isAbsoluteHttpUrl,
        errorMessage:
          "NEXT_PUBLIC_CLERK_PRIMARY_SIGN_IN_URL must be an absolute http(s) URL " +
          '(e.g. "https://buildmarket.app/sign-in"), not a relative path — that\'s ' +
          "what NEXT_PUBLIC_CLERK_SIGN_IN_URL is for.",
      },
    ],
  },
  {
    name: "database",
    description: "Postgres (via @build/db / Prisma)",
    variables: [
      {
        name: "DATABASE_URL",
        required: true,
        errorMessage:
          "DATABASE_URL is required — @build/db will otherwise fail deep inside a Prisma call at request time instead of at boot.",
      },
    ],
  },
  {
    name: "app",
    description: "App-level configuration",
    variables: [
      {
        name: "NEXT_PUBLIC_VERIFICATION_OPS_URL",
        required: false,
        default: "http://localhost:3501",
        validate: (value) => {
          try {
            new URL(value);
            return true;
          } catch {
            return false;
          }
        },
        errorMessage:
          "NEXT_PUBLIC_VERIFICATION_OPS_URL must be a valid absolute URL",
      },
    ],
  },
  // NOT included yet, intentionally: NATS_URL / regulator credentials.
  // This app has no write path or event-publishing today (see Phase 8
  // migration plan — writes are still behind a feature flag that doesn't
  // exist yet). Add a "nats" group here in the same PR that adds
  // `license.manual_decision_recorded` publishing, not before — an env
  // group required for a capability that doesn't exist yet just makes
  // local setup harder for no benefit.
];

const BUILD_DEFERRED_SERVER_ONLY_REQUIRED_VARS = new Set<string>([
  "CLERK_SECRET_KEY",
  "DATABASE_URL",
]);

function shouldDeferServerOnlyValidationForBuild(): boolean {
  return process.env.NEXT_PHASE === "phase-production-build";
}

export function validateEnv(
  groups: string[] | "all" = "all",
  throwOnError = true,
): ValidationResult {
  const result: ValidationResult = { valid: true, errors: [], warnings: [] };
  const groupsToValidate =
    groups === "all"
      ? envGroups
      : envGroups.filter((g) => groups.includes(g.name));
  const deferServerOnlyRequiredErrors =
    shouldDeferServerOnlyValidationForBuild();

  for (const group of groupsToValidate) {
    for (const variable of group.variables) {
      const value = process.env[variable.name];

      if (variable.required && !value) {
        if (
          deferServerOnlyRequiredErrors &&
          BUILD_DEFERRED_SERVER_ONLY_REQUIRED_VARS.has(variable.name)
        ) {
          result.warnings.push(
            `[${group.name}] Deferring required server env until runtime: ${variable.name}`,
          );
          continue;
        }
        result.valid = false;
        result.errors.push(
          `[${group.name}] Missing required: ${variable.name}`,
        );
        continue;
      }

      if (!value) {
        if (variable.default) {
          result.warnings.push(
            `[${group.name}] Using default for ${variable.name}: ${variable.default}`,
          );
        }
        continue;
      }

      if (variable.validate && !variable.validate(value)) {
        result.valid = false;
        result.errors.push(
          `[${group.name}] Invalid ${variable.name}: ${variable.errorMessage || "Validation failed"}`,
        );
      }
    }
  }

  if (!result.valid && throwOnError) {
    throw new Error(
      `Environment validation failed:\n${result.errors.map((e) => `  - ${e}`).join("\n")}`,
    );
  }

  return result;
}

function getStringEnv(name: string, fallback = ""): string {
  return process.env[name] || fallback;
}

function getOptionalStringEnv(name: string): string | undefined {
  const value = getStringEnv(name);
  return value.length > 0 ? value : undefined;
}

function getBooleanEnv(name: string, fallback = false): boolean {
  const value = process.env[name];
  return value === undefined ? fallback : toBool(value);
}

function buildEnvConfig() {
  return {
    nodeEnv: process.env.NODE_ENV ?? "development",
    clerk: {
      publishableKey: getStringEnv("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"),
      secretKey: getOptionalStringEnv("CLERK_SECRET_KEY"),
      signInUrl: getStringEnv("NEXT_PUBLIC_CLERK_SIGN_IN_URL", "/sign-in"),
      // Satellite config — see the "clerk" env group above for validation,
      // and layout.tsx / middleware.ts for how these are consumed.
      isSatellite: getBooleanEnv("NEXT_PUBLIC_CLERK_IS_SATELLITE", false),
      domain: getOptionalStringEnv("NEXT_PUBLIC_CLERK_DOMAIN"),
      primarySignInUrl: getOptionalStringEnv(
        "NEXT_PUBLIC_CLERK_PRIMARY_SIGN_IN_URL",
      ),
    },
    database: {
      url: getOptionalStringEnv("DATABASE_URL"),
    },
    app: {
      url: getStringEnv(
        "NEXT_PUBLIC_VERIFICATION_OPS_URL",
        "http://localhost:3501",
      ),
    },
  } as const;
}

export const envConfig = buildEnvConfig();
export type VerificationOpsEnvConfig = typeof envConfig;
export default envConfig;
