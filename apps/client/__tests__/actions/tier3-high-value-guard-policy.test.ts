import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  CRITICAL_TRANSITION_STEP_SEQUENCE_RULES,
  CRITICAL_VERIFICATION_ADAPTER_STEP_SEQUENCE_RULES,
  type GuardNumericConstantRule,
  HIGH_VALUE_ROUTE_GUARD_RULES,
  HIGH_VALUE_SERVER_ACTION_GUARD_RULES,
  type CriticalTransitionStepSequenceRule,
  type CriticalVerificationAdapterStepSequenceRule,
  type HighValueRouteGuardRule,
  type HighValueServerActionGuardRule,
} from "@/app/lib/security/high-risk-registry";

type HighValueServerActionRule = HighValueServerActionGuardRule;
type HighValueRouteRule = HighValueRouteGuardRule;
type CriticalTransitionRule = CriticalTransitionStepSequenceRule;
type CriticalVerificationAdapterRule =
  CriticalVerificationAdapterStepSequenceRule;
type NumericConstantRule = GuardNumericConstantRule;

type PolicyViolation = {
  file: string;
  actionName: string;
  check:
    | "missing-file"
    | "missing-action"
    | "missing-secure-action"
    | "unparsable-secure-action-options"
    | "missing-numeric-constant"
    | "invalid-numeric-constant"
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

function findLineNumber(source: string, index: number): number {
  return source.slice(0, index).split(/\r?\n/).length;
}

function findNumericConstantAssignment(
  source: string,
  rule: NumericConstantRule,
): { line: number; value: number } | null {
  const constantPattern = new RegExp(
    `\\bconst\\s+${rule.symbol}\\s*=\\s*(\\d+)\\s*;`,
  );
  const constantMatch = constantPattern.exec(source);
  if (!constantMatch || constantMatch.index === undefined) {
    return null;
  }

  const numericToken = constantMatch[1];
  if (!numericToken) {
    return null;
  }

  return {
    line: findLineNumber(source, constantMatch.index),
    value: Number.parseInt(numericToken, 10),
  };
}

function extractBalancedDelimiterBlock(
  source: string,
  openIndex: number,
  openDelimiter: string,
  closeDelimiter: string,
): string | null {
  if (openIndex < 0 || openIndex >= source.length) {
    return null;
  }

  if (source[openIndex] !== openDelimiter) {
    return null;
  }

  let depth = 0;
  for (let index = openIndex; index < source.length; index += 1) {
    const char = source[index];
    if (char === openDelimiter) {
      depth += 1;
      continue;
    }

    if (char === closeDelimiter) {
      depth -= 1;
      if (depth === 0) {
        return source.slice(openIndex, index + 1);
      }
    }
  }

  return null;
}

function extractBalancedBraceBlock(
  source: string,
  openBraceIndex: number,
): string | null {
  return extractBalancedDelimiterBlock(source, openBraceIndex, "{", "}");
}

function extractBalancedParenthesisBlock(
  source: string,
  openParenIndex: number,
): string | null {
  return extractBalancedDelimiterBlock(source, openParenIndex, "(", ")");
}

function splitTopLevelArguments(source: string): string[] {
  const args: string[] = [];
  let start = 0;
  let parenDepth = 0;
  let braceDepth = 0;
  let bracketDepth = 0;
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let inTemplateString = false;
  let escaped = false;

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (char === "\\") {
      escaped = true;
      continue;
    }

    if (inSingleQuote) {
      if (char === "'") {
        inSingleQuote = false;
      }
      continue;
    }

    if (inDoubleQuote) {
      if (char === '"') {
        inDoubleQuote = false;
      }
      continue;
    }

    if (inTemplateString) {
      if (char === "`") {
        inTemplateString = false;
      }
      continue;
    }

    if (char === "'") {
      inSingleQuote = true;
      continue;
    }

    if (char === '"') {
      inDoubleQuote = true;
      continue;
    }

    if (char === "`") {
      inTemplateString = true;
      continue;
    }

    if (char === "(") {
      parenDepth += 1;
      continue;
    }

    if (char === ")") {
      parenDepth = Math.max(parenDepth - 1, 0);
      continue;
    }

    if (char === "{") {
      braceDepth += 1;
      continue;
    }

    if (char === "}") {
      braceDepth = Math.max(braceDepth - 1, 0);
      continue;
    }

    if (char === "[") {
      bracketDepth += 1;
      continue;
    }

    if (char === "]") {
      bracketDepth = Math.max(bracketDepth - 1, 0);
      continue;
    }

    if (
      char === "," &&
      parenDepth === 0 &&
      braceDepth === 0 &&
      bracketDepth === 0
    ) {
      args.push(source.slice(start, index).trim());
      start = index + 1;
    }
  }

  const tail = source.slice(start).trim();
  if (tail.length > 0) {
    args.push(tail);
  }

  return args;
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

function extractDirectRouteExportHandlerBlock(
  source: string,
  exportName: string,
): { block: string; actionIndex: number } | null {
  const exportPattern = new RegExp(
    `export\\s+async\\s+function\\s+${exportName}\\s*\\(`,
  );
  const exportMatch = exportPattern.exec(source);
  if (!exportMatch || exportMatch.index === undefined) {
    return null;
  }

  const bodyStartIndex = source.indexOf("{", exportMatch.index);
  const block = extractBalancedBraceBlock(source, bodyStartIndex);
  if (!block) {
    return null;
  }

  return {
    block,
    actionIndex: exportMatch.index,
  };
}

function extractWithAuthExportOptionsBlock(
  source: string,
  exportName: string,
): { optionsBlock: string | null; actionIndex: number } | null {
  const exportPattern = new RegExp(
    `export\\s+const\\s+${exportName}\\s*=\\s*withAuth(?:<[^>]+>)?\\s*\\(`,
  );
  const exportMatch = exportPattern.exec(source);
  if (!exportMatch || exportMatch.index === undefined) {
    return null;
  }

  const callOpenParenIndex = source.indexOf(
    "(",
    exportMatch.index + exportMatch[0].length - 1,
  );
  const callBlock = extractBalancedParenthesisBlock(source, callOpenParenIndex);
  if (!callBlock) {
    return {
      optionsBlock: null,
      actionIndex: exportMatch.index,
    };
  }

  const args = splitTopLevelArguments(callBlock.slice(1, -1));
  if (args.length < 2) {
    return {
      optionsBlock: null,
      actionIndex: exportMatch.index,
    };
  }

  const optionsCandidate = args.slice(1).join(",").trim();
  const optionsStartIndex = optionsCandidate.indexOf("{");
  if (optionsStartIndex < 0) {
    return {
      optionsBlock: null,
      actionIndex: exportMatch.index,
    };
  }

  return {
    optionsBlock: extractBalancedBraceBlock(
      optionsCandidate,
      optionsStartIndex,
    ),
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

  for (const requiredRecentAuthSnippet of rule.requiredRecentAuthSnippets ??
    []) {
    if (optionsBlock.includes(requiredRecentAuthSnippet)) {
      continue;
    }

    offenders.push({
      file: rule.file,
      actionName: rule.actionName,
      line: findLineNumber(source, secureActionIndex),
      check: "missing-recent-auth-window",
      message:
        "High-value action must enforce the configured recent-auth window.",
    });
    break;
  }

  for (const requiredRateLimitSnippet of rule.requiredRateLimitSnippets ?? []) {
    if (optionsBlock.includes(requiredRateLimitSnippet)) {
      continue;
    }

    offenders.push({
      file: rule.file,
      actionName: rule.actionName,
      line: findLineNumber(source, secureActionIndex),
      check: "missing-rate-limit-key-snippet",
      message:
        "High-value action rate-limit configuration must match the canonical key pattern.",
    });
    break;
  }

  for (const requiredNumericConstant of rule.requiredNumericConstants ?? []) {
    const assignment = findNumericConstantAssignment(
      source,
      requiredNumericConstant,
    );
    if (!assignment) {
      offenders.push({
        file: rule.file,
        actionName: rule.actionName,
        line: findLineNumber(source, secureActionIndex),
        check: "missing-numeric-constant",
        message:
          "High-value action guard constants must declare explicit numeric assignments.",
      });
      continue;
    }

    if (assignment.value === requiredNumericConstant.expectedValue) {
      continue;
    }

    offenders.push({
      file: rule.file,
      actionName: rule.actionName,
      line: assignment.line,
      check: "invalid-numeric-constant",
      message:
        "High-value action guard constants must match the canonical numeric policy value.",
    });
  }

  return offenders;
}

function collectRouteGuardViolationsFromSource(
  source: string,
  rule: HighValueRouteRule,
): PolicyViolation[] {
  const offenders: PolicyViolation[] = [];
  const extractedWithAuthHandler = extractWithAuthExportHandlerBlock(
    source,
    rule.exportName,
  );

  let extractedHandler = extractedWithAuthHandler;
  let optionsBlock = "";

  if (!extractedWithAuthHandler) {
    const allowsDirectAuthExport =
      rule.requiredAuthOptions.length === 0 && !!rule.emptyAuthOptionsRationale;

    if (!allowsDirectAuthExport) {
      offenders.push({
        file: rule.file,
        actionName: rule.exportName,
        check: "missing-withauth-export",
        message:
          "High-value route mutation must be wrapped by withAuth with Tier-3 guard options.",
      });
      return offenders;
    }

    extractedHandler = extractDirectRouteExportHandlerBlock(
      source,
      rule.exportName,
    );

    if (!extractedHandler) {
      offenders.push({
        file: rule.file,
        actionName: rule.exportName,
        check: "missing-route-export",
        message:
          "High-value route export is missing; cannot verify Tier-3 guardrails.",
      });
      return offenders;
    }
  } else {
    const extractedOptions = extractWithAuthExportOptionsBlock(
      source,
      rule.exportName,
    );
    optionsBlock = extractedOptions?.optionsBlock ?? "";
  }

  const finalHandler = extractedHandler!;

  const actionLine = findLineNumber(source, finalHandler.actionIndex);

  for (const requiredAuthOption of rule.requiredAuthOptions) {
    const optionPattern = new RegExp(`\\b${requiredAuthOption}\\s*:`);
    if (optionPattern.test(optionsBlock)) {
      continue;
    }

    offenders.push({
      file: rule.file,
      actionName: rule.exportName,
      line: actionLine,
      check: `missing-${requiredAuthOption}`,
      message: `High-value route mutation must define withAuth.${requiredAuthOption}.`,
    });
  }

  for (const requiredRecentAuthSnippet of rule.requiredRecentAuthSnippets ??
    []) {
    if (optionsBlock.includes(requiredRecentAuthSnippet)) {
      continue;
    }

    offenders.push({
      file: rule.file,
      actionName: rule.exportName,
      line: actionLine,
      check: "missing-recent-auth-window",
      message:
        "High-value route mutation must enforce the configured recent-auth window.",
    });
    break;
  }

  for (const requiredSnippet of rule.requiredRateLimitSnippets ?? []) {
    if (finalHandler.block.includes(requiredSnippet)) {
      continue;
    }

    offenders.push({
      file: rule.file,
      actionName: rule.exportName,
      line: actionLine,
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

  it("flags mismatched numeric guard constants on high-value server actions", () => {
    const source = [
      "const WITHDRAWAL_RECENT_AUTH_MAX_AGE_SECONDS = 300;",
      "export async function requestWithdrawalAction(data: unknown) {",
      "  return secureAction({",
      "    recentAuth: { maxAgeSeconds: WITHDRAWAL_RECENT_AUTH_MAX_AGE_SECONDS },",
      '    rateLimit: { key: "high-value-withdrawal:db_user_123", limit: 1, windowMs: 60000 },',
      "    schema: null,",
      "    handler: async () => ({ ok: true }),",
      "  });",
      "}",
    ].join("\n");

    const offenders = collectServerActionGuardViolationsFromSource(source, {
      file: "sample/actions/finance.ts",
      actionName: "requestWithdrawalAction",
      requiredOptions: ["recentAuth", "rateLimit"],
      requiredRecentAuthSnippets: [
        "maxAgeSeconds: WITHDRAWAL_RECENT_AUTH_MAX_AGE_SECONDS",
      ],
      requiredRateLimitSnippets: ["high-value-withdrawal:"],
      requiredNumericConstants: [
        {
          symbol: "WITHDRAWAL_RECENT_AUTH_MAX_AGE_SECONDS",
          expectedValue: 180,
        },
      ],
    });

    expect(offenders).toEqual([
      {
        file: "sample/actions/finance.ts",
        actionName: "requestWithdrawalAction",
        line: 1,
        check: "invalid-numeric-constant",
        message:
          "High-value action guard constants must match the canonical numeric policy value.",
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
      requiredRateLimitSnippets: ["checkRateLimit(", "escrow-write:"],
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

  it("scopes recentAuth checks to the matched withAuth export", () => {
    const source = [
      "export const GET = withAuth(async () => {",
      "  return apiSuccess({ ok: true });",
      "}, { recentAuth: { maxAgeSeconds: 300 } });",
      "",
      "export const POST = withAuth(async () => {",
      "  await checkRateLimit('escrow-write:user', 5, 60000);",
      "  return apiSuccess({ ok: true });",
      "});",
    ].join("\n");

    const offenders = collectRouteGuardViolationsFromSource(source, {
      file: "sample/api/escrow/route.ts",
      exportName: "POST",
      requiredAuthOptions: ["recentAuth"],
      requiredRateLimitSnippets: ["checkRateLimit(", "escrow-write:"],
    });

    expect(offenders).toEqual([
      {
        file: "sample/api/escrow/route.ts",
        actionName: "POST",
        line: 5,
        check: "missing-recentAuth",
        message: "High-value route mutation must define withAuth.recentAuth.",
      },
    ]);
  });

  it("allows direct auth route exports when auth options are intentionally empty", () => {
    const source = [
      "export async function POST() {",
      "  await checkRateLimit(getActorRateLimitIdentifier(clerkId, 'onboarding-submit'), 5, 60000);",
      "  return apiSuccess({ ok: true });",
      "}",
    ].join("\n");

    const offenders = collectRouteGuardViolationsFromSource(source, {
      file: "sample/api/onboarding/route.ts",
      exportName: "POST",
      requiredAuthOptions: [],
      emptyAuthOptionsRationale:
        "AUTH-RATIONALE: Uses direct Clerk auth() because DB user may not exist yet.",
      requiredRateLimitSnippets: [
        "checkRateLimit(",
        "onboarding-submit",
        "getActorRateLimitIdentifier(",
      ],
    });

    expect(offenders).toEqual([]);
  });

  it("scopes rate-limit snippet checks to the matched withAuth handler", () => {
    const source = [
      "export const POST = withAuth(async () => {",
      "  return apiSuccess({ ok: true });",
      "}, { recentAuth: { maxAgeSeconds: 300 } });",
      "",
      "export const PATCH = withAuth(async () => {",
      "  await checkRateLimit('escrow-write:user', 5, 60000);",
      "  return apiSuccess({ ok: true });",
      "}, { recentAuth: { maxAgeSeconds: 300 } });",
    ].join("\n");

    const offenders = collectRouteGuardViolationsFromSource(source, {
      file: "sample/api/escrow/route.ts",
      exportName: "POST",
      requiredAuthOptions: ["recentAuth"],
      requiredRateLimitSnippets: ["checkRateLimit(", "escrow-write:"],
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
      "  await executeOnboardingTransition({ operationName: 'complete_onboarding_action', clerkId: 'clerk_123', clerkUser: {} as never, intent: { kind: 'submit', role: 'CLIENT', data: {} as never }, idempotencyKey: 'idem-key' });",
      "  await checkOnboardingTransitionIdempotency({ idempotencyKey: 'idem-key', clerkId: 'clerk_123' });",
      "}",
    ].join("\n");

    const offenders = collectCriticalTransitionViolationsFromSource(source, {
      file: "sample/actions/onboarding.ts",
      actionName: "submitOnboarding",
      orderedSnippets: [
        "checkOnboardingTransitionIdempotency(",
        "executeOnboardingTransition(",
      ],
    });

    expect(offenders).toEqual([
      {
        file: "sample/actions/onboarding.ts",
        actionName: "submitOnboarding",
        line: 1,
        check: "out-of-order-step",
        missingStep: "executeOnboardingTransition(",
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
