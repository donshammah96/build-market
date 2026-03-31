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

const LOGGER_CALL_PATTERN =
  /\b(?:logger|console)\s*\.\s*(?:info|warn|error|debug|log)\s*\(/;
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
const BANNED_LOG_KEY_PATTERN = new RegExp(
  `\\b(${BANNED_LOG_KEYS.join("|")})\\s*:`,
);

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

  for (const filePath of collectFiles(SERVER_SCAN_PATHS)) {
    const lines = readLines(filePath);

    for (let index = 0; index < lines.length; index += 1) {
      if (!LOGGER_CALL_PATTERN.test(lines[index])) {
        continue;
      }

      const windowLines = [lines[index]];
      let cursor = index + 1;
      while (cursor < lines.length && cursor <= index + 12) {
        windowLines.push(lines[cursor]);
        if (lines[cursor].includes(");")) {
          break;
        }
        cursor += 1;
      }

      const segment = windowLines.join("\n");
      const keyMatch = segment.match(BANNED_LOG_KEY_PATTERN);
      if (!keyMatch) {
        continue;
      }

      offenders.push({
        file: relativeToApp(filePath),
        line: index + 1,
        key: keyMatch[1],
      });
    }
  }

  return offenders;
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

const report = {
  generatedAt: new Date().toISOString(),
  summary: {
    envBoundary: 0,
    logSafety: 0,
    browserPersistence: 0,
    dangerousHtml: 0,
  },
  findings: {
    envBoundary: collectEnvDrift(),
    logSafety: collectLogDrift(),
    browserPersistence: collectStorageDrift(),
    dangerousHtml: collectDangerousHtmlDrift(),
  },
};

report.summary.envBoundary = report.findings.envBoundary.length;
report.summary.logSafety = report.findings.logSafety.length;
report.summary.browserPersistence = report.findings.browserPersistence.length;
report.summary.dangerousHtml = report.findings.dangerousHtml.length;

fs.writeFileSync(REPORT_OUTPUT, `${JSON.stringify(report, null, 2)}\n`, "utf8");

console.log("[security/drift-report] Generated security drift report.");
console.log(
  `[security/drift-report] envBoundary: ${report.summary.envBoundary}`,
);
console.log(`[security/drift-report] logSafety: ${report.summary.logSafety}`);
console.log(
  `[security/drift-report] browserPersistence: ${report.summary.browserPersistence}`,
);
console.log(
  `[security/drift-report] dangerousHtml: ${report.summary.dangerousHtml}`,
);
console.log(`[security/drift-report] output: ${relativeToApp(REPORT_OUTPUT)}`);

const hasFindings =
  report.summary.envBoundary > 0 ||
  report.summary.logSafety > 0 ||
  report.summary.browserPersistence > 0 ||
  report.summary.dangerousHtml > 0;

if (FAIL_ON_ANY && hasFindings) {
  process.exit(1);
}
