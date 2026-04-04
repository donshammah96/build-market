import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import {
  collectFiles,
  findLineNumber,
  readFile,
  readLines,
  relativeToApp,
} from "./security-check-utils.mjs";
import {
  collectGetJsonInGetHandlerDrift,
  collectMutationPassthroughDrift,
  collectUnsafeApiErrorDrift,
} from "./security-lint-checks.mjs";

const REPORT_OUTPUT = path.join(
  process.cwd(),
  "tmp-security-drift-report.json",
);
const FAIL_ON_ANY = process.argv.includes("--fail-on-any");

const GENERAL_SCAN_PATHS = [
  "app",
  "components",
  "hooks",
  "lib",
  "middleware.ts",
  "next.config.ts",
  "instrumentation.ts",
  "sentry.client.config.ts",
  "sentry.edge.config.ts",
  "sentry.server.config.ts",
];

const SERVER_SCAN_PATHS = [
  "app/api",
  "app/actions",
  "app/lib",
  "app/jobs",
  "app/workers",
  "middleware.ts",
];

const DIRECT_ENV_PATTERN = /process\.env(?:\.|\[)/g;
const STORAGE_PATTERN =
  /\b(?:window\.)?(?:localStorage|sessionStorage)\.(?:getItem|setItem|removeItem|clear)\b/g;
const DANGEROUS_HTML_PATTERN = /\bdangerouslySetInnerHTML\b/g;

const UPLOAD_GUARD_STORAGE_PATH = "app/lib/infrastructure/storage.ts";
const UPLOAD_GUARD_ENV_PATH = "app/lib/infrastructure/env.ts";
const UPLOAD_GUARD_TEST_PATH = "__tests__/lib/storage-config.test.ts";

const SERVER_ACTION_SCAN_PATHS = ["app/actions"];
const SERVER_ACTION_PARSE_PATTERN = /\.parse\s*\(/g;
const SERVER_ACTION_SAFEPARSE_PATTERN = /\.safeParse\s*\(/;
const SERVER_ACTION_THROW_NEW_ERROR_PATTERN = /throw\s+new\s+Error\s*\(/;
const SERVER_ACTION_VALIDATION_ALLOWLIST_MARKER =
  "SECURITY_SERVER_ACTION_VALIDATION_ALLOWLIST";

const HIGH_VALUE_SERVER_ACTION_GUARD_RULES = [
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

const HIGH_VALUE_ROUTE_GUARD_RULES = [
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

const CRITICAL_TRANSITION_STEP_SEQUENCE_RULES = [
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

const CRITICAL_VERIFICATION_ADAPTER_STEP_SEQUENCE_RULES = [
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

const LOGGER_CALL_PATTERN =
  /\b(?:logger|console)\s*\.\s*(?:info|warn|error|debug|log)\s*\(/;
const SPREAD_PROPERTY_PATTERN = /\.\.\.\s*[A-Za-z_$][\w$]*/;
const BANNED_LOG_KEYS = [
  "userId",
  "clerkId",
  "userEmail",
  "email",
  "phone",
  "phoneNumber",
  "rawPhone",
  "nationalId",
  "idNumber",
];

const BANNED_LOG_KEY_PATTERNS = BANNED_LOG_KEYS.map((key) => ({
  key,
  explicit: new RegExp(`(?:["'])?${key}(?:["'])?\\s*:`),
  shorthand: new RegExp(`(?<!\\$)(?:\\{|,)\\s*${key}\\s*(?:,|\\})`),
}));

function findBannedLogKeyInSegment(segment) {
  for (const candidate of BANNED_LOG_KEY_PATTERNS) {
    if (candidate.explicit.test(segment) || candidate.shorthand.test(segment)) {
      return candidate.key;
    }
  }
  return null;
}

const ENV_ALLOWLIST_FILES = new Set([
  "app/lib/infrastructure/env.ts",
  "next.config.ts",
  "instrumentation.ts",
  "sentry.client.config.ts",
  "sentry.edge.config.ts",
  "sentry.server.config.ts",
]);

function lineHasBootstrapException(lines, zeroBasedIndex) {
  const current = lines[zeroBasedIndex] ?? "";
  const previous = lines[zeroBasedIndex - 1] ?? "";
  return (
    current.includes("bootstrap-only") ||
    previous.includes("bootstrap-only") ||
    current.includes("env-bootstrap-exception") ||
    previous.includes("env-bootstrap-exception")
  );
}

function collectEnvDrift() {
  const offenders = [];

  for (const filePath of collectFiles(GENERAL_SCAN_PATHS)) {
    const relativePath = relativeToApp(filePath);
    if (ENV_ALLOWLIST_FILES.has(relativePath)) {
      continue;
    }

    const content = readFile(filePath);
    const lines = content.split(/\r?\n/);

    for (const match of content.matchAll(DIRECT_ENV_PATTERN)) {
      if (match.index === undefined) {
        continue;
      }

      const line = findLineNumber(content, match.index);
      if (lineHasBootstrapException(lines, line - 1)) {
        continue;
      }

      offenders.push({
        file: relativePath,
        line,
        sample: lines[line - 1]?.trim() ?? "",
      });
    }
  }

  return offenders;
}

function collectLogDrift() {
  const offenders = [];
  const spreadReviewCandidates = [];

  for (const filePath of collectFiles(SERVER_SCAN_PATHS)) {
    const lines = readLines(filePath);

    for (let index = 0; index < lines.length; index += 1) {
      if (!LOGGER_CALL_PATTERN.test(lines[index])) {
        continue;
      }

      const windowLines = [lines[index]];
      if (!lines[index].includes(");")) {
        let cursor = index + 1;
        while (cursor < lines.length && cursor <= index + 12) {
          windowLines.push(lines[cursor]);
          if (lines[cursor].includes(");")) {
            break;
          }
          cursor += 1;
        }
      }

      const segment = windowLines.join("\n");

      if (SPREAD_PROPERTY_PATTERN.test(segment)) {
        spreadReviewCandidates.push({
          file: relativeToApp(filePath),
          line: index + 1,
        });
      }

      const bannedKey = findBannedLogKeyInSegment(segment);
      if (!bannedKey) {
        continue;
      }

      offenders.push({
        file: relativeToApp(filePath),
        line: index + 1,
        key: bannedKey,
      });
    }
  }

  return {
    offenders,
    spreadReviewCandidates,
  };
}

function collectStorageDrift() {
  const offenders = [];

  for (const filePath of collectFiles(GENERAL_SCAN_PATHS)) {
    const content = readFile(filePath);
    if (!STORAGE_PATTERN.test(content)) {
      continue;
    }

    const relativePath = relativeToApp(filePath);
    const allowlisted = content.includes("SECURITY_PERSISTENCE_ALLOWLIST");
    if (allowlisted) {
      continue;
    }

    const lines = content.split(/\r?\n/);
    for (const match of content.matchAll(STORAGE_PATTERN)) {
      if (match.index === undefined) {
        continue;
      }

      offenders.push({
        file: relativePath,
        line: findLineNumber(content, match.index),
        sample: lines[findLineNumber(content, match.index) - 1]?.trim() ?? "",
      });
    }
  }

  return offenders;
}

function collectDangerousHtmlDrift() {
  const offenders = [];

  for (const filePath of collectFiles(GENERAL_SCAN_PATHS)) {
    const content = readFile(filePath);
    if (!DANGEROUS_HTML_PATTERN.test(content)) {
      continue;
    }

    const lines = content.split(/\r?\n/);
    const relativePath = relativeToApp(filePath);

    for (const match of content.matchAll(DANGEROUS_HTML_PATTERN)) {
      if (match.index === undefined) {
        continue;
      }

      const line = findLineNumber(content, match.index);
      const context = [
        lines[line - 3] ?? "",
        lines[line - 2] ?? "",
        lines[line - 1] ?? "",
      ]
        .join(" ")
        .toLowerCase();
      const hasSanitizerHint =
        context.includes("sanitize") ||
        context.includes("sanitizer") ||
        context.includes("security_xss_allowlist");

      if (hasSanitizerHint) {
        continue;
      }

      offenders.push({
        file: relativePath,
        line,
        sample: lines[line - 1]?.trim() ?? "",
      });
    }
  }

  return offenders;
}

function readOptionalRelativeFile(relativePath) {
  const absolutePath = path.join(process.cwd(), relativePath);
  if (!fs.existsSync(absolutePath)) {
    return null;
  }

  return fs.readFileSync(absolutePath, "utf8");
}

function collectUploadProductionRiskDrift() {
  const offenders = [];

  const storageSource = readOptionalRelativeFile(UPLOAD_GUARD_STORAGE_PATH);
  if (!storageSource) {
    offenders.push({
      file: UPLOAD_GUARD_STORAGE_PATH,
      check: "missing-storage-guard-module",
      message:
        "Missing storage guard module. Cannot verify production upload isolation invariants.",
    });
    return offenders;
  }

  const hasProductionLocalBlock =
    storageSource.includes('if (config.provider === "local")') &&
    storageSource.includes(
      "local storage provider is prohibited in production",
    );

  if (!hasProductionLocalBlock) {
    offenders.push({
      file: UPLOAD_GUARD_STORAGE_PATH,
      check: "missing-production-local-provider-block",
      message:
        "Production storage guard must block local storage provider usage.",
    });
  }

  const hasSameOriginGuard =
    storageSource.includes("isSameOrigin(cdnUrl, env.appUrl)") &&
    storageSource.includes("isSameOrigin(cdnUrl, env.apiUrl)") &&
    storageSource.includes("must not be served from the application origin");

  if (!hasSameOriginGuard) {
    offenders.push({
      file: UPLOAD_GUARD_STORAGE_PATH,
      check: "missing-production-same-origin-block",
      message:
        "Production storage guard must block upload delivery from app/api origins.",
    });
  }

  const envSource = readOptionalRelativeFile(UPLOAD_GUARD_ENV_PATH);
  if (envSource) {
    const hasLocalProviderDefault = envSource.includes(
      'getStringEnv("STORAGE_PROVIDER", "local")',
    );
    const hasUploadsCdnDefault = envSource.includes(
      'getStringEnv("CDN_URL", "/uploads")',
    );

    if (
      (hasLocalProviderDefault || hasUploadsCdnDefault) &&
      (!hasProductionLocalBlock || !hasSameOriginGuard)
    ) {
      offenders.push({
        file: UPLOAD_GUARD_ENV_PATH,
        check: "default-risk-without-production-guard",
        message:
          "Env defaults include local or same-origin upload settings without matching production guard coverage.",
      });
    }
  }

  const storageConfigTestSource = readOptionalRelativeFile(
    UPLOAD_GUARD_TEST_PATH,
  );
  if (!storageConfigTestSource) {
    offenders.push({
      file: UPLOAD_GUARD_TEST_PATH,
      check: "missing-storage-config-regression-tests",
      message:
        "Missing storage config regression tests for production upload isolation invariants.",
    });
    return offenders;
  }

  const hasLocalProviderProdTest = storageConfigTestSource.includes(
    "blocks the local storage provider in production",
  );
  const hasSameOriginProdTest = storageConfigTestSource.includes(
    "blocks same-origin upload delivery in production",
  );

  if (!hasLocalProviderProdTest) {
    offenders.push({
      file: UPLOAD_GUARD_TEST_PATH,
      check: "missing-local-provider-production-test",
      message:
        "Missing regression test that asserts local provider is blocked in production.",
    });
  }

  if (!hasSameOriginProdTest) {
    offenders.push({
      file: UPLOAD_GUARD_TEST_PATH,
      check: "missing-same-origin-production-test",
      message:
        "Missing regression test that asserts same-origin upload delivery is blocked in production.",
    });
  }

  return offenders;
}

function hasServerActionValidationAllowlist(
  lines,
  zeroBasedIndex,
  marker = SERVER_ACTION_VALIDATION_ALLOWLIST_MARKER,
) {
  const start = Math.max(0, zeroBasedIndex - 2);
  const end = Math.min(lines.length - 1, zeroBasedIndex + 1);

  for (let index = start; index <= end; index += 1) {
    if ((lines[index] ?? "").includes(marker)) {
      return true;
    }
  }

  return false;
}

function collectServerActionValidationPolicyDrift() {
  const offenders = [];

  for (const filePath of collectFiles(SERVER_ACTION_SCAN_PATHS)) {
    const relativePath = relativeToApp(filePath);
    const content = readFile(filePath);
    const lines = content.split(/\r?\n/);

    for (const match of content.matchAll(SERVER_ACTION_PARSE_PATTERN)) {
      if (match.index === undefined) {
        continue;
      }

      const line = findLineNumber(content, match.index);
      if (hasServerActionValidationAllowlist(lines, line - 1)) {
        continue;
      }

      offenders.push({
        file: relativePath,
        line,
        check: "zod-parse-in-server-action",
        sample: lines[line - 1]?.trim() ?? "",
      });
    }

    for (let index = 0; index < lines.length; index += 1) {
      if (!SERVER_ACTION_SAFEPARSE_PATTERN.test(lines[index])) {
        continue;
      }

      const maxLookahead = Math.min(lines.length - 1, index + 6);
      for (let cursor = index + 1; cursor <= maxLookahead; cursor += 1) {
        if (!SERVER_ACTION_THROW_NEW_ERROR_PATTERN.test(lines[cursor])) {
          continue;
        }

        if (hasServerActionValidationAllowlist(lines, cursor)) {
          continue;
        }

        offenders.push({
          file: relativePath,
          line: cursor + 1,
          check: "safeparse-followed-by-throw-new-error",
          sample: lines[cursor]?.trim() ?? "",
        });
        break;
      }
    }
  }

  return offenders;
}

function extractBalancedBraceBlock(source, openBraceIndex) {
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

function extractExportedAsyncFunctionBlock(source, actionName) {
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

function extractWithAuthExportHandlerBlock(source, exportName) {
  const exportPattern = new RegExp(
    `export\\s+const\\s+${exportName}\\s*=\\s*withAuth(?:<[^>]+>)?\\s*\\(`,
  );
  const exportMatch = exportPattern.exec(source);
  if (!exportMatch || exportMatch.index === undefined) {
    return null;
  }

  const arrowIndex = source.indexOf("=>", exportMatch.index + exportMatch[0].length);
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

function collectHighValueRouteGuardDrift() {
  const offenders = [];

  for (const rule of HIGH_VALUE_ROUTE_GUARD_RULES) {
    const source = readOptionalRelativeFile(rule.file);
    if (!source) {
      offenders.push({
        file: rule.file,
        actionName: rule.exportName,
        check: "missing-route-file",
        message:
          "High-value route file is missing; cannot verify Tier-3 guardrails.",
      });
      continue;
    }

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
      continue;
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
  }

  return offenders;
}

function collectHighValueServerActionGuardDrift() {
  const offenders = [];

  for (const rule of HIGH_VALUE_SERVER_ACTION_GUARD_RULES) {
    const source = readOptionalRelativeFile(rule.file);
    if (!source) {
      offenders.push({
        file: rule.file,
        actionName: rule.actionName,
        check: "missing-file",
        message:
          "High-value server-action file is missing; cannot verify Tier-3 guardrails.",
      });
      continue;
    }

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
      continue;
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
      continue;
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
      continue;
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
  }

  offenders.push(...collectHighValueRouteGuardDrift());

  return offenders;
}

function collectCriticalTransitionStepSequencingDrift() {
  const offenders = [];

  for (const rule of CRITICAL_TRANSITION_STEP_SEQUENCE_RULES) {
    const source = readOptionalRelativeFile(rule.file);
    if (!source) {
      offenders.push({
        file: rule.file,
        actionName: rule.actionName,
        check: "missing-file",
        message:
          "Critical transition file is missing; cannot verify step sequencing.",
      });
      continue;
    }

    const extracted = extractExportedAsyncFunctionBlock(source, rule.actionName);
    if (!extracted) {
      offenders.push({
        file: rule.file,
        actionName: rule.actionName,
        check: "missing-action",
        message:
          "Critical transition action is missing; cannot verify step sequencing.",
      });
      continue;
    }

    const { block, actionIndex } = extracted;
    let searchCursor = 0;

    for (const orderedSnippet of rule.orderedSnippets) {
      const nextIndex = block.indexOf(orderedSnippet, searchCursor);
      if (nextIndex >= 0) {
        searchCursor = nextIndex + orderedSnippet.length;
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
  }

  for (const rule of CRITICAL_VERIFICATION_ADAPTER_STEP_SEQUENCE_RULES) {
    const source = readOptionalRelativeFile(rule.file);
    if (!source) {
      offenders.push({
        file: rule.file,
        actionName: rule.exportName,
        check: "missing-file",
        message:
          "Critical verification adapter file is missing; cannot verify step sequencing.",
      });
      continue;
    }

    const extracted = extractWithAuthExportHandlerBlock(source, rule.exportName);
    if (!extracted) {
      offenders.push({
        file: rule.file,
        actionName: rule.exportName,
        check: "missing-route-export",
        message:
          "Critical verification adapter export is missing; cannot verify step sequencing.",
      });
      continue;
    }

    const { block, actionIndex } = extracted;
    let searchCursor = 0;

    for (const orderedSnippet of rule.orderedSnippets) {
      const nextIndex = block.indexOf(orderedSnippet, searchCursor);
      if (nextIndex >= 0) {
        searchCursor = nextIndex + orderedSnippet.length;
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
  }

  return offenders;
}

const logSafetyDrift = collectLogDrift();

const report = {
  generatedAt: new Date().toISOString(),
  summary: {
    envBoundary: 0,
    logSafety: 0,
    logSafetySpreadReview: 0,
    browserPersistence: 0,
    dangerousHtml: 0,
    uploadProductionRisk: 0,
    serverActionValidationPolicy: 0,
    highValueServerActionGuards: 0,
    criticalTransitionStepSequencing: 0,
    mutationPassthrough: 0,
    unsafeApiError: 0,
    getJsonInGetHandler: 0,
  },
  findings: {
    envBoundary: collectEnvDrift(),
    logSafety: logSafetyDrift.offenders,
    logSafetySpreadReview: logSafetyDrift.spreadReviewCandidates,
    browserPersistence: collectStorageDrift(),
    dangerousHtml: collectDangerousHtmlDrift(),
    uploadProductionRisk: collectUploadProductionRiskDrift(),
    serverActionValidationPolicy: collectServerActionValidationPolicyDrift(),
    highValueServerActionGuards: collectHighValueServerActionGuardDrift(),
    criticalTransitionStepSequencing:
      collectCriticalTransitionStepSequencingDrift(),
    mutationPassthrough: collectMutationPassthroughDrift(),
    unsafeApiError: collectUnsafeApiErrorDrift(),
    getJsonInGetHandler: collectGetJsonInGetHandlerDrift(),
  },
};

report.summary.envBoundary = report.findings.envBoundary.length;
report.summary.logSafety = report.findings.logSafety.length;
report.summary.logSafetySpreadReview =
  report.findings.logSafetySpreadReview.length;
report.summary.browserPersistence = report.findings.browserPersistence.length;
report.summary.dangerousHtml = report.findings.dangerousHtml.length;
report.summary.uploadProductionRisk =
  report.findings.uploadProductionRisk.length;
report.summary.serverActionValidationPolicy =
  report.findings.serverActionValidationPolicy.length;
report.summary.highValueServerActionGuards =
  report.findings.highValueServerActionGuards.length;
report.summary.criticalTransitionStepSequencing =
  report.findings.criticalTransitionStepSequencing.length;
report.summary.mutationPassthrough = report.findings.mutationPassthrough.length;
report.summary.unsafeApiError = report.findings.unsafeApiError.length;
report.summary.getJsonInGetHandler = report.findings.getJsonInGetHandler.length;

fs.writeFileSync(REPORT_OUTPUT, `${JSON.stringify(report, null, 2)}\n`, "utf8");

console.log("[security/drift-report] Generated security drift report.");
console.log(
  `[security/drift-report] envBoundary: ${report.summary.envBoundary}`,
);
console.log(`[security/drift-report] logSafety: ${report.summary.logSafety}`);
console.log(
  `[security/drift-report] logSafetySpreadReview: ${report.summary.logSafetySpreadReview}`,
);
console.log(
  `[security/drift-report] browserPersistence: ${report.summary.browserPersistence}`,
);
console.log(
  `[security/drift-report] dangerousHtml: ${report.summary.dangerousHtml}`,
);
console.log(
  `[security/drift-report] uploadProductionRisk: ${report.summary.uploadProductionRisk}`,
);
console.log(
  `[security/drift-report] serverActionValidationPolicy: ${report.summary.serverActionValidationPolicy}`,
);
console.log(
  `[security/drift-report] highValueServerActionGuards: ${report.summary.highValueServerActionGuards}`,
);
console.log(
  `[security/drift-report] criticalTransitionStepSequencing: ${report.summary.criticalTransitionStepSequencing}`,
);
console.log(
  `[security/drift-report] mutationPassthrough: ${report.summary.mutationPassthrough}`,
);
console.log(
  `[security/drift-report] unsafeApiError: ${report.summary.unsafeApiError}`,
);
console.log(
  `[security/drift-report] getJsonInGetHandler: ${report.summary.getJsonInGetHandler}`,
);
console.log(`[security/drift-report] output: ${relativeToApp(REPORT_OUTPUT)}`);

const hasFindings =
  report.summary.envBoundary > 0 ||
  report.summary.logSafety > 0 ||
  report.summary.browserPersistence > 0 ||
  report.summary.dangerousHtml > 0 ||
  report.summary.uploadProductionRisk > 0 ||
  report.summary.serverActionValidationPolicy > 0 ||
  report.summary.highValueServerActionGuards > 0 ||
  report.summary.criticalTransitionStepSequencing > 0 ||
  report.summary.mutationPassthrough > 0 ||
  report.summary.unsafeApiError > 0 ||
  report.summary.getJsonInGetHandler > 0;

if (FAIL_ON_ANY && hasFindings) {
  process.exit(1);
}
