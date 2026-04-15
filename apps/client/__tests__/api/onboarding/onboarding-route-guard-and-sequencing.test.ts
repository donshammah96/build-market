import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

type RouteSpec = {
  label: string;
  file: string;
  domainSnippet: string;
  namespace: string;
  safeMessageMap: string;
};

const ROUTES: RouteSpec[] = [
  {
    label: "submit onboarding route",
    file: "app/api/onboarding/route.ts",
    domainSnippet: "userProfileOnboardingService.completeOnboarding(",
    namespace: "onboarding-submit",
    safeMessageMap: "ONBOARDING_ERROR_MESSAGE_MAP",
  },
  {
    label: "skip-client onboarding route",
    file: "app/api/onboarding/skip/route.ts",
    domainSnippet: "userProfileOnboardingService.skipClientOnboarding(",
    namespace: "onboarding-skip-client",
    safeMessageMap: "SKIP_ONBOARDING_ERROR_MESSAGE_MAP",
  },
  {
    label: "skip-professional onboarding route",
    file: "app/api/onboarding/skip-professional/route.ts",
    domainSnippet: "userProfileOnboardingService.skipProfessionalOnboarding(",
    namespace: "onboarding-skip-professional",
    safeMessageMap: "SKIP_PROFESSIONAL_ONBOARDING_ERROR_MESSAGE_MAP",
  },
];

function readRouteSource(relativePath: string): string {
  const absolutePath = path.join(process.cwd(), relativePath);
  return fs.readFileSync(absolutePath, "utf8");
}

function assertOrderedSnippets(
  source: string,
  snippets: string[],
  label: string,
): void {
  let cursor = 0;

  for (const snippet of snippets) {
    const nextIndex = source.indexOf(snippet, cursor);
    expect(nextIndex, `${label} must include ${snippet}`).toBeGreaterThan(-1);
    cursor = nextIndex + snippet.length;
  }
}

describe("onboarding route guard and sequencing policy", () => {
  it("keeps canonical sequencing across onboarding mutation routes", () => {
    for (const route of ROUTES) {
      const source = readRouteSource(route.file);

      assertOrderedSnippets(
        source,
        [
          route.domainSnippet,
          "finalizeClerkOnboardingTransition(",
          "IdempotencyService.complete(",
        ],
        route.label,
      );
    }
  });

  it("enforces actor-scoped rate-limit keys for each onboarding route", () => {
    for (const route of ROUTES) {
      const source = readRouteSource(route.file);

      expect(source).toContain(
        `getActorRateLimitIdentifier(clerkId, \"${route.namespace}\")`,
      );
      expect(source).not.toContain("getRateLimitIdentifier(");
    }
  });

  it("guards idempotency completion persistence failures without rethrowing", () => {
    for (const route of ROUTES) {
      const source = readRouteSource(route.file);

      const completionCallIndex = source.indexOf(
        "await IdempotencyService.complete(idempotencyKey, responseData)",
      );
      expect(completionCallIndex).toBeGreaterThan(-1);

      const completionWindow = source.slice(
        Math.max(0, completionCallIndex - 100),
        completionCallIndex + 520,
      );

      expect(completionWindow).toContain("try {");
      expect(completionWindow).toContain("catch (completionError)");
      expect(completionWindow).toContain("await IdempotencyService.fail(");
      expect(completionWindow).not.toContain("throw completionError");
    }
  });

  it("uses static-safe adapter error messages instead of domain message passthrough", () => {
    for (const route of ROUTES) {
      const source = readRouteSource(route.file);

      expect(source).toContain(route.safeMessageMap);
      expect(source).toContain("const safeMessage");
      expect(source).toContain("apiError(safeMessage, status)");
      expect(source).not.toMatch(/apiError\(\s*result\.data\.message/);
      expect(source).not.toMatch(/apiError\(\s*result\.data\?\.message/);
      expect(source).not.toMatch(/apiError\(\s*data\.message/);
      expect(source).not.toMatch(/apiError\(\s*err\.message/);
    }
  });
});
