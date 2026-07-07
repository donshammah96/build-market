#!/usr/bin/env node
/**
 * check-security-drift.mjs
 *
 * Static "SEC-LINT" rule pass for apps/admin — the counterpart to
 * `report-security-drift.mjs`. The distinction between the two, mirroring
 * apps/client's split:
 *   - check-security-drift   -> fails CI on violations of hard rules below.
 *   - report-security-drift  -> informational; summarizes drift without
 *                                necessarily failing the build (see that
 *                                script and its `--strict` flag).
 *
 * Escape hatch: any file can opt out of a specific rule by adding a leading
 * comment of the form:
 *   // security-drift-allow: <rule-id> -- <reason>
 * This keeps false positives from turning into rubber-stamped `--strict`
 * bypasses at the CI-invocation level, which would defeat the point of a
 * dedicated check step.
 */

import { readFileSync, existsSync } from "node:fs";
import { readdir } from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd(); // expected to be apps/admin (script is invoked via `pnpm -C apps/admin run check-security-drift`)

const SCAN_DIRS = [
  "src/app",
  "src/lib",
  "src/components",
  "src/actions",
  "src/middleware.ts",
].filter((p) => existsSync(path.join(ROOT, p)));

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
    .slice(0, 20) // allowlist comment must be near the top of the file
    .some((line) => line.includes(`security-drift-allow: ${ruleId}`));
}

function relPath(p) {
  return path.relative(ROOT, p);
}

function findBalancedBlockRange(source, searchStartIndex) {
  const blockStart = source.indexOf("{", searchStartIndex);
  if (blockStart === -1) {
    return null;
  }

  let depth = 0;
  for (let index = blockStart; index < source.length; index += 1) {
    const char = source[index];
    if (char === "{") {
      depth += 1;
      continue;
    }

    if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        return {
          start: blockStart,
          end: index,
        };
      }
    }
  }

  return null;
}

// --- Rule: NEXT_PUBLIC_* env vars must not look like secrets ---
// Anything sent to the client bundle under NEXT_PUBLIC_ is, by definition,
// visible to anyone who opens devtools. Clerk's publishable key is meant to
// be public (hence the name) so it's explicitly allow-listed; anything else
// containing SECRET/TOKEN/PRIVATE is very likely a copy-paste drift from a
// server-only env var.
const PUBLIC_ENV_ALLOWLIST = new Set([
  "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
  "NEXT_PUBLIC_APP_URL",
  "NEXT_PUBLIC_API_URL",
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
        message: `${relPath(file)}: "${name}" is prefixed NEXT_PUBLIC_ (client-visible) but its name suggests it holds a secret. If it truly is public, add it to PUBLIC_ENV_ALLOWLIST in this script; otherwise drop the NEXT_PUBLIC_ prefix.`,
      });
    }
  }
}

// --- Rule: no hardcoded credential-shaped literals outside env plumbing ---
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
        message: `${relPath(file)}: matches pattern for "${id}". If this is committed test/CI-only fixture data (e.g. a docker-compose default), add "// security-drift-allow: ${id} -- <reason>" near the top of the file.`,
      });
    }
  }
}

// --- Rule: no eval / new Function on non-literal input ---
function checkDynamicCodeExecution(file, source) {
  const ruleId = "no-dynamic-code-execution";
  if (isAllowed(source, ruleId)) return;
  if (/\beval\s*\(/.test(source) || /new\s+Function\s*\(/.test(source)) {
    violations.push({
      id: ruleId,
      message: `${relPath(file)}: uses eval() or new Function(). These are almost never necessary in application code and are a common injection vector.`,
    });
  }
}

// --- Rule: dangerouslySetInnerHTML must be paired with a sanitization note ---
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
        message: `${relPath(file)}: ${lineNum}: uses dangerouslySetInnerHTML without an adjacent comment documenting how the HTML is sanitized before render (e.g. "// sanitized: <how>").`,
      });
    }
  }
}

const AUTH_REFERENCE_HINTS = [
  "auth(",
  "currentUser(",
  "requireAuth",
  "getAuthContext",
  "clerkMiddleware",
  "withAdminRole",
  "safeAction",
];

function checkRouteHandlerAuth(file, source) {
  const ruleId = "route-handler-missing-auth-reference";

  // Only scan App Router route handler files
  const isRouteHandler =
    /[\\/]src[\\/]app[\\/].*[\\/]route\.(ts|tsx|js|jsx)$/.test(file);
  if (!isRouteHandler) return;

  if (isAllowed(source, ruleId)) return;
  const hasAuthReference = AUTH_REFERENCE_HINTS.some((hint) =>
    source.includes(hint),
  );
  if (!hasAuthReference) {
    violations.push({
      id: ruleId,
      message: `${relPath(file)}: App Router route handler has no reference to an auth check (auth(), currentUser(), requireAuth, etc.). If this route is intentionally public, add "// security-drift-allow: ${ruleId} -- <reason>" at the top.`,
    });
  }
}

// --- Rule: middleware.ts must exist and wire up Clerk ---
function checkMiddlewarePresence() {
  const ruleId = "missing-clerk-middleware";
  const middlewarePath = path.join(ROOT, "src/middleware.ts");
  if (!existsSync(middlewarePath)) {
    violations.push({
      id: ruleId,
      message: `apps/admin/src/middleware.ts not found. admin depends on @clerk/nextjs; without root middleware, route-level auth checks are the only protection layer and are easy to miss on a new route.`,
    });
    return;
  }
  const source = readFileSync(middlewarePath, "utf8");
  if (isAllowed(source, ruleId)) return;
  if (!source.includes("clerkMiddleware")) {
    violations.push({
      id: ruleId,
      message: `apps/admin/src/middleware.ts exists but doesn't reference clerkMiddleware. Confirm auth is actually being enforced at the middleware layer.`,
    });
  }
}

// --- Rule: no direct process.env usage in guarded runtime files ---
function checkDirectEnv(file, source) {
  const ruleId = "no-direct-env";
  if (isAllowed(source, ruleId)) return;

  const rel = relPath(file).replace(/\\/g, "/");
  if (rel === "src/lib/infrastructure/env.ts") return;

  const matches = source.matchAll(/process\.env(?:\.|\[)/g);
  const lines = source.split(/\r?\n/);
  for (const m of matches) {
    if (m.index === undefined) continue;
    const lineNum = source.slice(0, m.index).split(/\r?\n/).length;
    const lineContent = lines[lineNum - 1] ?? "";
    if (lineContent.includes("bootstrap-only:")) continue;

    violations.push({
      id: ruleId,
      message: `${relPath(file)}: ${lineNum}: direct process.env usage detected. All runtime env reads must go through env config, unless marked with "// bootstrap-only: <reason>".`,
    });
  }
}

// --- Rule: no banned log keys (log safety check) ---
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
const SPREAD_PROPERTY_PATTERN = /\.\.\.\s*[A-Za-z_$][\w$]*/;

function checkBannedLogKeys(file, source) {
  const ruleId = "no-banned-log-keys";
  if (isAllowed(source, ruleId)) return;

  const rel = relPath(file).replace(/\\/g, "/");
  if (
    rel.includes("src/lib/infrastructure/logger.ts") ||
    rel.includes("src/lib/infrastructure/sms.ts") ||
    rel.includes("src/lib/auth-sync.ts")
  ) {
    return;
  }

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
          message: `${relPath(file)}: ${lineNum}: Logger/console call includes banned field "${patternObj.key}". Identity and sensitive data must not be logged (ADR-ADMIN-003).`,
        });
      }
    }

    if (SPREAD_PROPERTY_PATTERN.test(segment)) {
      console.warn(
        `  [WARN] ${relPath(file)}:${lineNum}: logger call includes spread metadata, which cannot be key-scanned. Manual review recommended.`,
      );
    }
  }
}

// --- Rule: browser storage persistence check ---
const PERSISTENCE_ALLOWLIST_MARKER = "SECURITY_PERSISTENCE_ALLOWLIST";

function checkBrowserStorage(file, source) {
  const ruleId = "no-unallowlisted-storage";
  if (isAllowed(source, ruleId)) return;

  const lines = source.split(/\r?\n/);
  const storagePattern =
    /\b(?:window\.)?(?:localStorage|sessionStorage)\.(?:getItem|setItem|removeItem|clear)\b/g;
  let match;
  while ((match = storagePattern.exec(source)) !== null) {
    const lineNum = source.slice(0, match.index).split(/\r?\n/).length;

    let hasMarker = false;
    const start = Math.max(0, lineNum - 4);
    const end = Math.min(lines.length - 1, lineNum);
    for (let i = start; i <= end; i++) {
      if (lines[i].includes(PERSISTENCE_ALLOWLIST_MARKER)) {
        hasMarker = true;
        break;
      }
    }

    if (!hasMarker) {
      violations.push({
        id: ruleId,
        message: `${relPath(file)}: ${lineNum}: Browser storage usage detected. Must be allowlisted with "// ${PERSISTENCE_ALLOWLIST_MARKER}".`,
      });
    }
  }
}

// --- Rule: no CORS headers or OPTION exports outside cors helper ---
const CORS_HEADER_PATTERN = /Access-Control-Allow-[A-Za-z-]+/g;
const OPTIONS_EXPORT_PATTERN =
  /export\s+(?:const|async\s+function|function)\s+OPTIONS\b/g;

function checkCorsPolicy(file, source) {
  const ruleId = "no-cors-drift";
  if (isAllowed(source, ruleId)) return;

  const rel = relPath(file).replace(/\\/g, "/");
  if (rel === "src/lib/api/cors.ts") return;

  let match;
  CORS_HEADER_PATTERN.lastIndex = 0;
  while ((match = CORS_HEADER_PATTERN.exec(source)) !== null) {
    const lineNum = source.slice(0, match.index).split(/\r?\n/).length;
    violations.push({
      id: ruleId,
      message: `${relPath(file)}: ${lineNum}: CORS header "${match[0]}" is set directly. Use the shared CORS helper in "src/lib/api/cors.ts" instead.`,
    });
  }

  if (rel.startsWith("src/app/api/") && OPTIONS_EXPORT_PATTERN.test(source)) {
    const usesHelper =
      source.includes("handleCorsPreFlight") || source.includes("corsHeaders");
    if (!usesHelper) {
      violations.push({
        id: ruleId,
        message: `${relPath(file)}: exports OPTIONS handler but does not use shared CORS preflight helper (handleCorsPreFlight or corsHeaders).`,
      });
    }
  }
}

// --- Rule: Zod mutation schema passthrough check ---
const ZOD_PASSTHROUGH_PATTERN = /\.passthrough\(\)/g;
const PASSTHROUGH_ALLOWLIST_MARKER = "SECURITY_ZOD_PASSTHROUGH_ALLOWLIST";

function checkZodPassthrough(file, source) {
  const ruleId = "zod-mutation-passthrough";
  if (isAllowed(source, ruleId)) return;

  const rel = relPath(file).replace(/\\/g, "/");
  const isMutationOrDomain =
    rel.startsWith("src/actions/") ||
    rel.startsWith("src/app/api/") ||
    rel.startsWith("src/lib/domains/");
  if (!isMutationOrDomain) return;

  const lines = source.split(/\r?\n/);
  let match;
  ZOD_PASSTHROUGH_PATTERN.lastIndex = 0;
  while ((match = ZOD_PASSTHROUGH_PATTERN.exec(source)) !== null) {
    const lineNum = source.slice(0, match.index).split(/\r?\n/).length;

    let hasMarker = false;
    const start = Math.max(0, lineNum - 4);
    const end = Math.min(lines.length - 1, lineNum);
    for (let i = start; i <= end; i++) {
      if (lines[i].includes(PASSTHROUGH_ALLOWLIST_MARKER)) {
        hasMarker = true;
        break;
      }
    }

    if (!hasMarker) {
      violations.push({
        id: ruleId,
        message: `${relPath(file)}: ${lineNum}: Zod .passthrough() detected on schema. Passthroughs are prohibited on mutation input schemas unless marked with "// ${PASSTHROUGH_ALLOWLIST_MARKER}".`,
      });
    }
  }
}

// --- Rule: unsafe apiError pass-through ---
const UNSAFE_CLIENT_MESSAGE_PATTERN =
  /\bapiError\s*\(\s*(?:error|err)\.(message|stack)\b/i;

function checkUnsafeClientErrors(file, source) {
  const ruleId = "unsafe-client-errors";
  if (isAllowed(source, ruleId)) return;

  const rel = relPath(file).replace(/\\/g, "/");
  if (rel === "src/lib/api/resilient-api.ts") return;

  const isRouteOrAction =
    rel.startsWith("src/actions/") ||
    rel.startsWith("src/app/api/") ||
    rel.startsWith("src/lib/api/");
  if (!isRouteOrAction) return;

  const matches = source.matchAll(
    /\bapiError\s*\(\s*(?:error|err)\.(message|stack)\b/gi,
  );
  for (const m of matches) {
    if (m.index === undefined) continue;
    const lineNum = source.slice(0, m.index).split(/\r?\n/).length;
    violations.push({
      id: ruleId,
      message: `${relPath(file)}: ${lineNum}: Unsafe client-facing error message pass-through detected. Do not pass raw error.message/stack directly to apiError().`,
    });
  }
}

// --- Rule: req.json() inside GET handlers ---
const EXPORTED_GET_PATTERN =
  /export\s+(?:const\s+GET\s*=\s*|async\s+function\s+GET\s*\(|function\s+GET\s*\()/g;
const REQ_JSON_PATTERN = /\b(?:req|request)\s*\.\s*json\s*\(/g;
const GET_JSON_ALLOWLIST_MARKER = "SECURITY_GET_JSON_ALLOWLIST";

function checkReqJsonInGet(file, source) {
  const ruleId = "req-json-in-get";
  if (isAllowed(source, ruleId)) return;

  const rel = relPath(file).replace(/\\/g, "/");
  if (!rel.startsWith("src/app/api/")) return;

  const lines = source.split(/\r?\n/);
  let getMatch;
  EXPORTED_GET_PATTERN.lastIndex = 0;
  while ((getMatch = EXPORTED_GET_PATTERN.exec(source)) !== null) {
    const blockRange = findBalancedBlockRange(
      source,
      getMatch.index + getMatch[0].length,
    );
    if (!blockRange) continue;

    const handlerSource = source.slice(blockRange.start, blockRange.end + 1);
    let reqJsonMatch;
    REQ_JSON_PATTERN.lastIndex = 0;
    while ((reqJsonMatch = REQ_JSON_PATTERN.exec(handlerSource)) !== null) {
      const absoluteIndex = blockRange.start + reqJsonMatch.index;
      const lineNum = source.slice(0, absoluteIndex).split(/\r?\n/).length;

      let hasMarker = false;
      const start = Math.max(0, lineNum - 4);
      const end = Math.min(lines.length - 1, lineNum);
      for (let i = start; i <= end; i++) {
        if (lines[i].includes(GET_JSON_ALLOWLIST_MARKER)) {
          hasMarker = true;
          break;
        }
      }

      if (!hasMarker) {
        violations.push({
          id: ruleId,
          message: `${relPath(file)}: ${lineNum}: req.json() inside GET handler detected. GET requests should not have body payloads. If required, mark with "// ${GET_JSON_ALLOWLIST_MARKER}".`,
        });
      }
    }
  }
}

async function main() {
  checkMiddlewarePresence();

  const files = (
    await Promise.all(
      SCAN_DIRS.filter(
        (d) => d !== "src/middleware.ts" && d !== "middleware.ts",
      ).map((d) => walk(path.join(ROOT, d))),
    )
  ).flat();

  for (const file of files) {
    const source = readFileSync(file, "utf8");
    checkPublicEnvNames(file, source);
    checkHardcodedSecrets(file, source);
    checkDynamicCodeExecution(file, source);
    checkDangerousHtml(file, source);
    checkRouteHandlerAuth(file, source);
    checkDirectEnv(file, source);
    checkBannedLogKeys(file, source);
    checkBrowserStorage(file, source);
    checkCorsPolicy(file, source);
    checkZodPassthrough(file, source);
    checkUnsafeClientErrors(file, source);
    checkReqJsonInGet(file, source);
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
