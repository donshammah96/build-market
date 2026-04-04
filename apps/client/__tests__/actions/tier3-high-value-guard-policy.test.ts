import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

type HighValueServerActionRule = {
  file: string;
  actionName: string;
  requiredOptions: string[];
};

type HighValueRouteRule = {
  file: string;
  exportName: string;
  requiredAuthOptions: string[];
  requiredSnippets: string[];
};

type CriticalTransitionRule = {
  file: string;
  actionName: string;
  orderedSnippets: string[];
};

type CriticalVerificationAdapterRule = {
  file: string;
  exportName: string;
  orderedSnippets: string[];
};

type PolicyViolation = {
  file: string;
  actionName: string;
  check:
    | "missing-file"
    | "missing-action"
    | "missing-secure-action"
    | "unparsable-secure-action-options"
    | `missing-${string}`
    | "missing-withauth-export"
    | "missing-route-export"
    | "missing-rate-limit-enforcement"
    | "missing-step"
    | "out-of-order-step";
  line?: number;
  message: string;
  missingStep?: string;
};

const HIGH_VALUE_SERVER_ACTION_GUARD_RULES: HighValueServerActionRule[] = [
  {
    file: "app/actions/finance.ts",
    actionName: "requestWithdrawalAction",
    requiredOptions: ["recentAuth", "rateLimit"],
  },
  {
    file: "app/actions/onboarding.ts",
    actionName: "submitOnboarding",
    requiredOptions: ["recentAuth", "rateLimit"],
  },
  {
    file: "app/actions/onboarding.ts",
    actionName: "skipOnboarding",
    requiredOptions: ["recentAuth", "rateLimit"],
  },
  {
    file: "app/actions/onboarding.ts",
    actionName: "skipProfessionalOnboarding",
    requiredOptions: ["recentAuth", "rateLimit"],
  },
];

const HIGH_VALUE_ROUTE_GUARD_RULES: HighValueRouteRule[] = [
  {
    file: "app/api/projects/[id]/escrow/[escrowId]/fund/route.ts",
    exportName: "POST",
    requiredAuthOptions: ["recentAuth"],
    requiredSnippets: ["checkRateLimit(", "escrow-write:"],
  },
  {
    file: "app/api/projects/[id]/escrow/[escrowId]/release/route.ts",
    exportName: "POST",
    requiredAuthOptions: ["recentAuth"],
    requiredSnippets: ["checkRateLimit(", "escrow-write:"],
  },
  {
    file: "app/api/projects/[id]/escrow/[escrowId]/dispute/route.ts",
    exportName: "POST",
    requiredAuthOptions: ["recentAuth"],
    requiredSnippets: ["checkRateLimit(", "escrow-write:"],
  },
];

const CRITICAL_TRANSITION_STEP_SEQUENCE_RULES: CriticalTransitionRule[] = [
  {
    file: "app/actions/onboarding.ts",
    actionName: "submitOnboarding",
    orderedSnippets: [
      "userProfileOnboardingService.completeOnboarding(",
      "updateClerkOnboardingMetadata(",
      "IdempotencyService.complete(",
    ],
  },
  {
    file: "app/actions/onboarding.ts",
    actionName: "skipOnboarding",
    orderedSnippets: [
      "userProfileOnboardingService.skipClientOnboarding(",
      "updateClerkOnboardingMetadata(",
    ],
  },
  {
    file: "app/actions/onboarding.ts",
    actionName: "skipProfessionalOnboarding",
    orderedSnippets: [
      "userProfileOnboardingService.skipProfessionalOnboarding(",
      "updateClerkOnboardingMetadata(",
    ],
  },
];

const CRITICAL_VERIFICATION_ADAPTER_STEP_SEQUENCE_RULES: CriticalVerificationAdapterRule[] =
  [
    {
      file: "app/api/professional-portal/documents/route.ts",
      exportName: "POST",
      orderedSnippets: [
        "documentsService.createDocument(",
        "IdempotencyService.complete(",
      ],
    },
    {
      file: "app/api/professional-portal/documents/[id]/route.ts",
      exportName: "PATCH",
      orderedSnippets: [
        "documentsService.updateDocument(",
        "IdempotencyService.complete(",
      ],
    },
    {
      file: "app/api/professional-portal/licenses/[id]/route.ts",
      exportName: "PATCH",
      orderedSnippets: [
        "licensesService.updateLicense(",
        "IdempotencyService.complete(",
      ],
    },
  ];

function findLineNumber(source: string, index: number): number {
  return source.slice(0, index).split(/\r?\n/).length;
}

function extractBalancedBraceBlock(
  source: string,
  openBraceIndex: number,
): string | null {
  if (openBraceIndex < 0 || openBraceIndex >= source.length) {
    return null;
  }

  let depth = 0;
  for (let index = openBraceIndex; index < source.length; index += 1) {
    const char = source[index];
    if (char === "{") {
      depth += 1;
    } else if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        return source.slice(openBraceIndex, index + 1);
      }
    }
  }

  return null;
}

function extractExportedAsyncFunctionBlock(
  source: string,
  actionName: string,
): { block: string; actionIndex: number } | null {
  const actionPattern = new RegExp(
    `export\\s+async\\s+function\\s+${actionName}\\s*\\(`,
  );
  const actionMatch = actionPattern.exec(source);
  if (!actionMatch || actionMatch.index === undefined) {
    return null;
  }

  const bodyStartIndex = source.indexOf("{", actionMatch.index);
  const block = extractBalancedBraceBlock(source, bodyStartIndex);
  if (!block) {
    return null;
  }

  return {
    block,
    actionIndex: actionMatch.index,
  };
}

function extractWithAuthExportHandlerBlock(
  source: string,
  exportName: string,
): { block: string; actionIndex: number } | null {
  const exportPattern = new RegExp(
    `export\\s+const\\s+${exportName}\\s*=\\s*withAuth(?:<[^>]+>)?\\s*\\(`,
  );
  const exportMatch = exportPattern.exec(source);
  if (!exportMatch || exportMatch.index === undefined) {
    return null;
  }

  const arrowIndex = source.indexOf(
    "=>",
    exportMatch.index + exportMatch[0].length,
  );
  if (arrowIndex < 0) {
    return null;
  }

  const bodyStartIndex = source.indexOf("{", arrowIndex);
  const block = extractBalancedBraceBlock(source, bodyStartIndex);
  if (!block) {
    return null;
  }

  return {
    block,
    actionIndex: exportMatch.index,
  };
}

function collectServerActionGuardViolationsFromSource(
  source: string,
  rule: HighValueServerActionRule,
): PolicyViolation[] {
  const offenders: PolicyViolation[] = [];
  const actionSignature = `export async function ${rule.actionName}`;
  const actionIndex = source.indexOf(actionSignature);
  if (actionIndex < 0) {
    offenders.push({
      file: rule.file,
      actionName: rule.actionName,
      check: "missing-action",
      message:
        "High-value server-action is missing; cannot verify Tier-3 guardrails.",
    });
    return offenders;
  }

  const secureActionIndex = source.indexOf("secureAction(", actionIndex);
  if (secureActionIndex < 0) {
    offenders.push({
      file: rule.file,
      actionName: rule.actionName,
      line: findLineNumber(source, actionIndex),
      check: "missing-secure-action",
      message:
        "High-value action must call secureAction to enforce Tier-3 guardrails.",
    });
    return offenders;
  }

  const optionsStartIndex = source.indexOf("{", secureActionIndex);
  const optionsBlock = extractBalancedBraceBlock(source, optionsStartIndex);
  if (!optionsBlock) {
    offenders.push({
      file: rule.file,
      actionName: rule.actionName,
      line: findLineNumber(source, secureActionIndex),
      check: "unparsable-secure-action-options",
      message:
        "Could not parse secureAction options for Tier-3 guardrail verification.",
    });
    return offenders;
  }

  for (const requiredOption of rule.requiredOptions) {
    const optionPattern = new RegExp(`\\b${requiredOption}\\s*:`);
    if (optionPattern.test(optionsBlock)) {
      continue;
    }

    offenders.push({
      file: rule.file,
      actionName: rule.actionName,
      line: findLineNumber(source, secureActionIndex),
      check: `missing-${requiredOption}`,
      message: `High-value action must define secureAction.${requiredOption}.`,
    });
  }

  return offenders;
}

function collectRouteGuardViolationsFromSource(
  source: string,
  rule: HighValueRouteRule,
): PolicyViolation[] {
  const offenders: PolicyViolation[] = [];
  const exportSignature = `export const ${rule.exportName} = withAuth`;
  const exportIndex = source.indexOf(exportSignature);

  if (exportIndex < 0) {
    offenders.push({
      file: rule.file,
      actionName: rule.exportName,
      check: "missing-withauth-export",
      message:
        "High-value route mutation must be wrapped by withAuth with Tier-3 guard options.",
    });
    return offenders;
  }

  for (const requiredAuthOption of rule.requiredAuthOptions) {
    const optionPattern = new RegExp(`\\b${requiredAuthOption}\\s*:`);
    if (optionPattern.test(source)) {
      continue;
    }

    offenders.push({
      file: rule.file,
      actionName: rule.exportName,
      line: findLineNumber(source, exportIndex),
      check: `missing-${requiredAuthOption}`,
      message: `High-value route mutation must define withAuth.${requiredAuthOption}.`,
    });
  }

  for (const requiredSnippet of rule.requiredSnippets) {
    if (source.includes(requiredSnippet)) {
      continue;
    }

    offenders.push({
      file: rule.file,
      actionName: rule.exportName,
      line: findLineNumber(source, exportIndex),
      check: "missing-rate-limit-enforcement",
      message:
        "High-value route mutation must enforce anti-automation rate limiting.",
    });
    break;
  }

  return offenders;
}

function collectCriticalTransitionViolationsFromSource(
  source: string,
  rule: CriticalTransitionRule,
): PolicyViolation[] {
  const offenders: PolicyViolation[] = [];
  const extracted = extractExportedAsyncFunctionBlock(source, rule.actionName);
  if (!extracted) {
    offenders.push({
      file: rule.file,
      actionName: rule.actionName,
      check: "missing-action",
      message:
        "Critical transition action is missing; cannot verify step sequencing.",
    });
    return offenders;
  }

  const { block, actionIndex } = extracted;
  let cursor = 0;

  for (const orderedSnippet of rule.orderedSnippets) {
    const nextIndex = block.indexOf(orderedSnippet, cursor);
    if (nextIndex >= 0) {
      cursor = nextIndex + orderedSnippet.length;
      continue;
    }

    const existsOutOfOrder = block.indexOf(orderedSnippet) >= 0;
    offenders.push({
      file: rule.file,
      actionName: rule.actionName,
      line: findLineNumber(source, actionIndex),
      check: existsOutOfOrder ? "out-of-order-step" : "missing-step",
      missingStep: orderedSnippet,
      message: existsOutOfOrder
        ? "Critical transition steps must execute in canonical order."
        : "Critical transition sequence is missing a required server-side step.",
    });
    break;
  }

  return offenders;
}

function collectCriticalVerificationAdapterViolationsFromSource(
  source: string,
  rule: CriticalVerificationAdapterRule,
): PolicyViolation[] {
  const offenders: PolicyViolation[] = [];
  const extracted = extractWithAuthExportHandlerBlock(source, rule.exportName);
  if (!extracted) {
    offenders.push({
      file: rule.file,
      actionName: rule.exportName,
      check: "missing-route-export",
      message:
        "Critical verification adapter export is missing; cannot verify step sequencing.",
    });
    return offenders;
  }

  const { block, actionIndex } = extracted;
  let cursor = 0;

  for (const orderedSnippet of rule.orderedSnippets) {
    const nextIndex = block.indexOf(orderedSnippet, cursor);
    if (nextIndex >= 0) {
      cursor = nextIndex + orderedSnippet.length;
      continue;
    }

    const existsOutOfOrder = block.indexOf(orderedSnippet) >= 0;
    offenders.push({
      file: rule.file,
      actionName: rule.exportName,
      line: findLineNumber(source, actionIndex),
      check: existsOutOfOrder ? "out-of-order-step" : "missing-step",
      missingStep: orderedSnippet,
      message: existsOutOfOrder
        ? "Critical transition steps must execute in canonical order."
        : "Critical transition sequence is missing a required server-side step.",
    });
    break;
  }

  return offenders;
}

function collectWorkspaceHighValueGuardViolations(): PolicyViolation[] {
  const offenders: PolicyViolation[] = [];

  for (const rule of HIGH_VALUE_SERVER_ACTION_GUARD_RULES) {
    const absolutePath = path.join(process.cwd(), rule.file);
    if (!fs.existsSync(absolutePath)) {
      offenders.push({
        file: rule.file,
        actionName: rule.actionName,
        check: "missing-file",
        message:
          "High-value server-action file is missing; cannot verify Tier-3 guardrails.",
      });
      continue;
    }

    const source = fs.readFileSync(absolutePath, "utf8");
    offenders.push(
      ...collectServerActionGuardViolationsFromSource(source, rule),
    );
  }

  for (const rule of HIGH_VALUE_ROUTE_GUARD_RULES) {
    const absolutePath = path.join(process.cwd(), rule.file);
    if (!fs.existsSync(absolutePath)) {
      offenders.push({
        file: rule.file,
        actionName: rule.exportName,
        check: "missing-file",
        message:
          "High-value route file is missing; cannot verify Tier-3 guardrails.",
      });
      continue;
    }

    const source = fs.readFileSync(absolutePath, "utf8");
    offenders.push(...collectRouteGuardViolationsFromSource(source, rule));
  }

  return offenders;
}

function collectWorkspaceCriticalTransitionViolations(): PolicyViolation[] {
  const offenders: PolicyViolation[] = [];

  for (const rule of CRITICAL_TRANSITION_STEP_SEQUENCE_RULES) {
    const absolutePath = path.join(process.cwd(), rule.file);
    if (!fs.existsSync(absolutePath)) {
      offenders.push({
        file: rule.file,
        actionName: rule.actionName,
        check: "missing-file",
        message:
          "Critical transition file is missing; cannot verify step sequencing.",
      });
      continue;
    }

    const source = fs.readFileSync(absolutePath, "utf8");
    offenders.push(
      ...collectCriticalTransitionViolationsFromSource(source, rule),
    );
  }

  for (const rule of CRITICAL_VERIFICATION_ADAPTER_STEP_SEQUENCE_RULES) {
    const absolutePath = path.join(process.cwd(), rule.file);
    if (!fs.existsSync(absolutePath)) {
      offenders.push({
        file: rule.file,
        actionName: rule.exportName,
        check: "missing-file",
        message:
          "Critical verification adapter file is missing; cannot verify step sequencing.",
      });
      continue;
    }

    const source = fs.readFileSync(absolutePath, "utf8");
    offenders.push(
      ...collectCriticalVerificationAdapterViolationsFromSource(source, rule),
    );
  }

  return offenders;
}

describe("Tier-3 high-value guard policy", () => {
  it("flags missing secureAction guard options on high-value server actions", () => {
    const source = [
      "export async function requestWithdrawalAction(data: unknown) {",
      "  return secureAction({",
      "    recentAuth: { maxAgeSeconds: 300 },",
      "    handler: async () => ({ ok: true }),",
      "  });",
      "}",
    ].join("\n");

    const offenders = collectServerActionGuardViolationsFromSource(source, {
      file: "sample/actions/finance.ts",
      actionName: "requestWithdrawalAction",
      requiredOptions: ["recentAuth", "rateLimit"],
    });

    expect(offenders).toEqual([
      {
        file: "sample/actions/finance.ts",
        actionName: "requestWithdrawalAction",
        line: 2,
        check: "missing-rateLimit",
        message: "High-value action must define secureAction.rateLimit.",
      },
    ]);
  });

  it("flags missing route anti-automation guard snippets", () => {
    const source = [
      "export const POST = withAuth(async () => {",
      "  return apiSuccess({ ok: true });",
      "}, { recentAuth: { maxAgeSeconds: 300 } });",
    ].join("\n");

    const offenders = collectRouteGuardViolationsFromSource(source, {
      file: "sample/api/escrow/route.ts",
      exportName: "POST",
      requiredAuthOptions: ["recentAuth"],
      requiredSnippets: ["checkRateLimit(", "escrow-write:"],
    });

    expect(offenders).toEqual([
      {
        file: "sample/api/escrow/route.ts",
        actionName: "POST",
        line: 1,
        check: "missing-rate-limit-enforcement",
        message:
          "High-value route mutation must enforce anti-automation rate limiting.",
      },
    ]);
  });

  it("reports no Tier-3 high-value guard drift in workspace files", () => {
    const offenders = collectWorkspaceHighValueGuardViolations();
    expect(offenders).toEqual([]);
  });
});

describe("Tier-3 critical transition sequencing policy", () => {
  it("flags out-of-order onboarding transition steps", () => {
    const source = [
      "export async function submitOnboarding() {",
      "  await updateClerkOnboardingMetadata('clerk_123', { status: 'ACTIVE' });",
      "  await userProfileOnboardingService.completeOnboarding({ actor: { clerkId: 'clerk_123' } });",
      "  await IdempotencyService.complete('idem-key', {});",
      "}",
    ].join("\n");

    const offenders = collectCriticalTransitionViolationsFromSource(source, {
      file: "sample/actions/onboarding.ts",
      actionName: "submitOnboarding",
      orderedSnippets: [
        "userProfileOnboardingService.completeOnboarding(",
        "updateClerkOnboardingMetadata(",
        "IdempotencyService.complete(",
      ],
    });

    expect(offenders).toEqual([
      {
        file: "sample/actions/onboarding.ts",
        actionName: "submitOnboarding",
        line: 1,
        check: "out-of-order-step",
        missingStep: "updateClerkOnboardingMetadata(",
        message: "Critical transition steps must execute in canonical order.",
      },
    ]);
  });

  it("reports no Tier-3 step-sequencing drift in workspace files", () => {
    const offenders = collectWorkspaceCriticalTransitionViolations();
    expect(offenders).toEqual([]);
  });

  it("flags out-of-order verification adapter steps", () => {
    const source = [
      "export const PATCH = withAuth(async () => {",
      "  await IdempotencyService.complete('idem-key', {});",
      "  const updated = await licensesService.updateLicense({ userId: 'u1' }, 'l1', {});",
      "  return apiSuccess(updated);",
      "});",
    ].join("\n");

    const offenders = collectCriticalVerificationAdapterViolationsFromSource(
      source,
      {
        file: "sample/api/professional-portal/licenses/[id]/route.ts",
        exportName: "PATCH",
        orderedSnippets: [
          "licensesService.updateLicense(",
          "IdempotencyService.complete(",
        ],
      },
    );

    expect(offenders).toEqual([
      {
        file: "sample/api/professional-portal/licenses/[id]/route.ts",
        actionName: "PATCH",
        line: 1,
        check: "out-of-order-step",
        missingStep: "IdempotencyService.complete(",
        message: "Critical transition steps must execute in canonical order.",
      },
    ]);
  });
});
