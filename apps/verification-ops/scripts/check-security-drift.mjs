#!/usr/bin/env node
/**
 * check-security-drift.mjs (apps/verification-ops)
 * =================================================
 * Static "SEC-LINT" rule pass for apps/verification-ops.
 * Fails CI on violations of core security rules:
 *   - Direct process.env reads outside lib/infrastructure/env.ts
 *   - Banned log keys (identity/PII data in loggers or console calls)
 *   - Hardcoded secret literals
 *   - Secret-shaped NEXT_PUBLIC_* env vars
 *   - Dynamic code execution (eval, new Function)
 *   - Unsanitized dangerouslySetInnerHTML
 *   - Missing middleware / Clerk configuration
 *
 * Escape hatch:
 *   // security-drift-allow: <rule-id> -- <reason>
 */

import { readFileSync, existsSync } from "node:fs";
import { readdir } from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();

const SCAN_DIRS = ["app", "lib", "middleware.ts"].filter((p) =>
  existsSync(path.join(ROOT, p)),
);

const EXCLUDE_DIR_NAMES = new Set([
  "node_modules",
  ".next",
  ".turbo",
  "dist",
  "coverage",
  "__tests__",
]);

/** @type {{id: string, message: string}[]} */
const violations = [];

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (EXCLUDE_DIR_NAMES.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walk(full)));
    } else if (/\.(ts|tsx|js|jsx)$/.test(entry.name)) {
      files.push(full);
    }
  }
  return files;
}

function isAllowed(source, ruleId) {
  return source
    .split("\n")
    .slice(0, 20)
    .some((line) => line.includes(`security-drift-allow: ${ruleId}`));
}

function relPath(p) {
  return path.relative(ROOT, p);
}

// --- Rule: NEXT_PUBLIC_* env vars must not look like secrets ---
const PUBLIC_ENV_ALLOWLIST = new Set([
  "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
  "NEXT_PUBLIC_CLERK_SIGN_IN_URL",
  "NEXT_PUBLIC_CLERK_IS_SATELLITE",
  "NEXT_PUBLIC_CLERK_DOMAIN",
  "NEXT_PUBLIC_CLERK_PRIMARY_SIGN_IN_URL",
  "NEXT_PUBLIC_VERIFICATION_OPS_URL",
]);
const SECRET_SHAPED = /(SECRET|PRIVATE|TOKEN|PASSWORD|CREDENTIAL)/i;

function checkPublicEnvNames(file, source) {
  const ruleId = "no-secret-shaped-public-env";
  if (isAllowed(source, ruleId)) return;
  const matches = source.matchAll(/NEXT_PUBLIC_[A-Z0-9_]+/g);
  for (const m of matches) {
    const name = m[0];
    if (PUBLIC_ENV_ALLOWLIST.has(name)) continue;
    if (SECRET_SHAPED.test(name)) {
      violations.push({
        id: ruleId,
        message: `${relPath(file)}: "${name}" is prefixed NEXT_PUBLIC_ but its name suggests a secret. Add to PUBLIC_ENV_ALLOWLIST if public, or drop NEXT_PUBLIC_ prefix.`,
      });
    }
  }
}

// --- Rule: no hardcoded credential-shaped literals ---
const HARDCODED_PATTERNS = [
  { id: "aws-access-key-id", re: /AKIA[0-9A-Z]{16}/ },
  { id: "private-key-block", re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  {
    id: "credentialed-connection-string",
    re: /(postgres(?:ql)?|redis|mongodb):\/\/[^:\s'"]+:[^@\s'"]+@/i,
  },
];

function checkHardcodedSecrets(file, source) {
  for (const { id, re } of HARDCODED_PATTERNS) {
    if (isAllowed(source, id)) continue;
    if (re.test(source)) {
      violations.push({
        id,
        message: `${relPath(file)}: matches pattern for "${id}". If test fixture, add "// security-drift-allow: ${id} -- <reason>".`,
      });
    }
  }
}

// --- Rule: no eval / new Function ---
function checkDynamicCodeExecution(file, source) {
  const ruleId = "no-dynamic-code-execution";
  if (isAllowed(source, ruleId)) return;
  if (/\beval\s*\(/.test(source) || /new\s+Function\s*\(/.test(source)) {
    violations.push({
      id: ruleId,
      message: `${relPath(file)}: uses eval() or new Function().`,
    });
  }
}

// --- Rule: dangerouslySetInnerHTML ---
const XSS_ALLOWLIST_MARKER = "SECURITY_XSS_ALLOWLIST";

function checkDangerousHtml(file, source) {
  const ruleId = "dangerously-set-inner-html-unsanitized";
  if (isAllowed(source, ruleId)) return;

  const lines = source.split(/\r?\n/);
  const matches = source.matchAll(/\bdangerouslySetInnerHTML\b/g);
  for (const m of matches) {
    if (m.index === undefined) continue;
    const lineNum = source.slice(0, m.index).split(/\r?\n/).length;

    let allowed = false;
    const start = Math.max(0, lineNum - 4);
    const end = Math.min(lines.length - 1, lineNum);
    for (let i = start; i <= end; i++) {
      const lineContent = lines[i] ?? "";
      const lower = lineContent.toLowerCase();
      if (
        lineContent.includes(XSS_ALLOWLIST_MARKER) ||
        lineContent.includes("sanitized:") ||
        lower.includes("sanitize") ||
        lower.includes("sanitizer") ||
        lower.includes("review")
      ) {
        allowed = true;
        break;
      }
    }

    if (!allowed) {
      violations.push({
        id: ruleId,
        message: `${relPath(file)}: ${lineNum}: uses dangerouslySetInnerHTML without sanitization comment.`,
      });
    }
  }
}

// --- Rule: middleware.ts presence ---
function checkMiddlewarePresence() {
  const ruleId = "missing-clerk-middleware";
  const middlewarePath = path.join(ROOT, "middleware.ts");
  if (!existsSync(middlewarePath)) {
    violations.push({
      id: ruleId,
      message: `apps/verification-ops/middleware.ts not found.`,
    });
    return;
  }
  const source = readFileSync(middlewarePath, "utf8");
  if (isAllowed(source, ruleId)) return;
  if (!source.includes("clerkMiddleware")) {
    violations.push({
      id: ruleId,
      message: `apps/verification-ops/middleware.ts does not reference clerkMiddleware.`,
    });
  }
}

// --- Rule: no direct process.env usage ---
function checkDirectEnv(file, source) {
  const ruleId = "no-direct-env";
  if (isAllowed(source, ruleId)) return;

  const rel = relPath(file).replace(/\\/g, "/");
  if (rel === "lib/infrastructure/env.ts") return;

  const matches = source.matchAll(/process\.env(?:\.|\[)/g);
  const lines = source.split(/\r?\n/);
  for (const m of matches) {
    if (m.index === undefined) continue;
    const lineNum = source.slice(0, m.index).split(/\r?\n/).length;
    const lineContent = lines[lineNum - 1] ?? "";
    if (lineContent.includes("bootstrap-only:")) continue;

    violations.push({
      id: ruleId,
      message: `${relPath(file)}: ${lineNum}: direct process.env usage detected. Read via lib/infrastructure/env.ts or mark "// bootstrap-only: <reason>".`,
    });
  }
}

// --- Rule: banned log keys ---
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

const BANNED_KEY_PATTERNS = BANNED_LOG_KEYS.map((key) => ({
  key,
  explicit: new RegExp(`(?:["'])?${key}(?:["'])?\\s*:`),
  shorthand: new RegExp(`(?:\\{|,)\\s*${key}\\s*(?:,|\\})`),
}));

const LOGGER_CALL_PATTERN =
  /\b(?:logger|console)\s*\.\s*(?:info|warn|error|debug|log)\s*\(/g;

function checkBannedLogKeys(file, source) {
  const ruleId = "no-banned-log-keys";
  if (isAllowed(source, ruleId)) return;

  const lines = source.split(/\r?\n/);
  let match;
  LOGGER_CALL_PATTERN.lastIndex = 0;
  while ((match = LOGGER_CALL_PATTERN.exec(source)) !== null) {
    const startIndex = match.index;
    const lineNum = source.slice(0, startIndex).split(/\r?\n/).length;

    const windowLines = [lines[lineNum - 1]];
    let cursor = lineNum;
    while (cursor < lines.length && cursor <= lineNum + 11) {
      windowLines.push(lines[cursor]);
      if (lines[cursor].includes(");")) {
        break;
      }
      cursor += 1;
    }
    const segment = windowLines.join("\n");

    for (const patternObj of BANNED_KEY_PATTERNS) {
      if (
        patternObj.explicit.test(segment) ||
        patternObj.shorthand.test(segment)
      ) {
        violations.push({
          id: ruleId,
          message: `${relPath(file)}: ${lineNum}: Logger/console call includes banned field "${patternObj.key}".`,
        });
      }
    }
  }
}

function checkIgnoreBuildErrors() {
  const ruleId = "no-ignore-build-errors";
  const configPath = path.join(ROOT, "next.config.ts");
  if (!existsSync(configPath)) return;
  const source = readFileSync(configPath, "utf8");
  if (isAllowed(source, ruleId)) return;
  if (/ignoreBuildErrors\s*:\s*true/.test(source)) {
    violations.push({
      id: ruleId,
      message: `apps/verification-ops/next.config.ts has typescript.ignoreBuildErrors set to true.`,
    });
  }
}

async function main() {
  checkMiddlewarePresence();
  checkIgnoreBuildErrors();

  const files = (
    await Promise.all(
      SCAN_DIRS.filter((d) => d !== "middleware.ts").map((d) =>
        walk(path.join(ROOT, d)),
      ),
    )
  ).flat();

  if (existsSync(path.join(ROOT, "middleware.ts"))) {
    files.push(path.join(ROOT, "middleware.ts"));
  }

  for (const file of files) {
    const source = readFileSync(file, "utf8");
    checkPublicEnvNames(file, source);
    checkHardcodedSecrets(file, source);
    checkDynamicCodeExecution(file, source);
    checkDangerousHtml(file, source);
    checkDirectEnv(file, source);
    checkBannedLogKeys(file, source);
  }

  if (violations.length > 0) {
    console.error(
      `\nSecurity drift check failed: ${violations.length} violation(s) found.\n`,
    );
    for (const v of violations) {
      console.error(`  [${v.id}] ${v.message}`);
    }
    console.error("");
    process.exit(1);
  }

  console.log(
    `Security drift check passed (${files.length} files scanned, 0 violations).`,
  );
}

main().catch((err) => {
  console.error("check-security-drift.mjs crashed:", err);
  process.exit(1);
});
