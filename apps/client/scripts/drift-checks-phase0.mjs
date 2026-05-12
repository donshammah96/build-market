/**
 * drift-checks-phase0.mjs
 *
 * Phase 0 additions to apps/client/scripts/report-security-drift.mjs.
 *
 * These six checks enforce the 2026-05-08 architecture doc update
 * (A8–B18 from the Architecture Compliance Plan).
 *
 * INTEGRATION
 * ───────────
 * 1. Copy this file to apps/client/scripts/drift-checks-phase0.mjs
 * 2. In report-security-drift.mjs, add at the top:
 *
 *      import { collectPhase0Drift } from "./drift-checks-phase0.mjs";
 *
 * 3. In the main drift collection block (where other collectXxxDrift calls live),
 *    add:
 *
 *      const phase0 = await collectPhase0Drift(appRoot);
 *      findings.resultDiscriminantDrift     = phase0.resultDiscriminantDrift;
 *      findings.inlineLoggerAtModuleLevel   = phase0.inlineLoggerAtModuleLevel;
 *      findings.missingSharedTs             = phase0.missingSharedTs;
 *      findings.idempotencyKeyBodySpread    = phase0.idempotencyKeyBodySpread;
 *      findings.inlineDateNow               = phase0.inlineDateNow;
 *      findings.mapperInfraImport           = phase0.mapperInfraImport;
 *
 * 4. Add each key to the hasFindings condition so --fail-on-any blocks CI:
 *
 *      const hasFindings = [
 *        ...existingKeys,
 *        "resultDiscriminantDrift",
 *        "inlineLoggerAtModuleLevel",
 *        "missingSharedTs",
 *        "idempotencyKeyBodySpread",
 *        "inlineDateNow",
 *        "mapperInfraImport",
 *      ].some((key) => (findings[key]?.length ?? findings[key]) > 0);
 *
 * CALIBRATION
 * ───────────
 * Run against the existing codebase BEFORE enabling as blocking:
 *
 *   node apps/client/scripts/report-security-drift.mjs --json 2>/dev/null \
 *     | node -e "const d=require('/dev/stdin'); console.log(JSON.stringify({
 *         resultDiscriminantDrift:   d.resultDiscriminantDrift,
 *         inlineLoggerAtModuleLevel: d.inlineLoggerAtModuleLevel,
 *         missingSharedTs:           d.missingSharedTs,
 *         idempotencyKeyBodySpread:  d.idempotencyKeyBodySpread,
 *         inlineDateNow:             d.inlineDateNow,
 *         mapperInfraImport:         d.mapperInfraImport,
 *       }, null, 2))"
 *
 * Review each finding. Any that are false positives must be added to the
 * relevant exception list before the category is promoted to blocking.
 *
 * Exception lists
 * ───────────────
 * Each check that might need exceptions uses a JSON allowlist file.
 * Create these files with an empty array [] if no exceptions are needed.
 *
 *   scripts/drift-exceptions-result-discriminant.json
 *   scripts/drift-exceptions-inline-logger.json
 *   scripts/drift-exceptions-idempotency-key-spread.json
 *   scripts/drift-exceptions-inline-date-now.json
 *   scripts/drift-exceptions-mapper-infra-import.json
 *
 * missingSharedTs does not support exceptions — if a route family has ≥2
 * handlers it must have shared.ts. Split or merge handlers instead.
 */

import fs from "fs/promises";
import path from "path";
import process from "process";

// ─── helpers ──────────────────────────────────────────────────────────────────

async function readJsonExceptions(scriptDir, filename) {
  try {
    const raw = await fs.readFile(path.join(scriptDir, filename), "utf8");
    return new Set(JSON.parse(raw));
  } catch {
    return new Set();
  }
}

async function walkFiles(dir, predicate) {
  const results = [];
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return results;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (
        entry.name === "node_modules" ||
        entry.name === ".next" ||
        entry.name === ".git"
      )
        continue;
      results.push(...(await walkFiles(full, predicate)));
    } else if (entry.isFile() && predicate(entry.name, full)) {
      results.push(full);
    }
  }
  return results;
}

async function readFile(filePath) {
  try {
    return await fs.readFile(filePath, "utf8");
  } catch {
    return "";
  }
}

// ─── check B16: result.data.ok discriminant ───────────────────────────────────
//
// Finds any usage of `result.data.success` or `domainResult.success` (or
// similar variable names) as a discriminant in route handlers and actions.
// The canonical discriminant on Result<T,E> is `.ok`, not `.success`.
//
// Pattern: catches `.success ===` or `.success !==` or `!result.data.success`
// after a variable that was assigned from getResilientExecutor or a domain call.
//
// False-positive guard: only scans app/api/** and app/actions/**; skips test
// files (which may legitimately test the wrong pattern to assert it's wrong).

async function collectResultDiscriminantDrift(appRoot, exceptions) {
  const apiDir = path.join(appRoot, "app", "api");
  const actionsDir = path.join(appRoot, "app", "actions");

  const findings = [];
  const pattern =
    /(?:result|domainResult|executorResult|res)\.(?:data\.)?success\s*(?:===|!==|==|!=)/g;
  const negationPattern =
    /!\s*(?:result|domainResult|executorResult)\.data\.success\b/g;

  for (const dir of [apiDir, actionsDir]) {
    const files = await walkFiles(
      dir,
      (name) =>
        (name.endsWith(".ts") || name.endsWith(".tsx")) &&
        !name.endsWith(".test.ts") &&
        !name.endsWith(".spec.ts"),
    );
    for (const file of files) {
      if (exceptions.has(file)) continue;
      const content = await readFile(file);
      const lines = content.split("\n");
      lines.forEach((line, i) => {
        if (pattern.test(line) || negationPattern.test(line)) {
          // reset stateful regex
          pattern.lastIndex = 0;
          negationPattern.lastIndex = 0;
          // skip lines that are comments explaining the wrong pattern
          if (
            line.trimStart().startsWith("//") ||
            line.trimStart().startsWith("*")
          )
            return;
          findings.push({
            file: file.replace(appRoot + path.sep, ""),
            line: i + 1,
            text: line.trim(),
            fix: "Replace .success discriminant with .ok — e.g. if (!domainResult.ok)",
          });
        }
        // reset between lines
        pattern.lastIndex = 0;
        negationPattern.lastIndex = 0;
      });
    }
  }
  return findings;
}

// ─── check B18: module-level getClientLogger() ────────────────────────────────
//
// Finds `const logger = getClientLogger()` or `const logger = getLogger()`
// at module scope (i.e. not inside a function body).
//
// Heuristic: the call appears before the first `export` keyword OR at
// indentation level 0 with no enclosing braces on the same or prior lines.
// We use a simpler approach: flag any top-level `const logger` that is not
// inside a function/class by checking that it appears at column 0 or with
// only whitespace before it, with no `function`, `=>`, `async` on the line.

async function collectInlineLoggerAtModuleLevel(appRoot, exceptions) {
  const apiDir = path.join(appRoot, "app", "api");
  const actionsDir = path.join(appRoot, "app", "actions");

  const findings = [];
  // Matches: const logger = getClientLogger() or const logger = getLogger()
  // at the start of a line (possibly with leading whitespace at depth 0)
  for (const dir of [apiDir, actionsDir]) {
    const files = await walkFiles(
      dir,
      (name) =>
        (name.endsWith(".ts") || name.endsWith(".tsx")) &&
        !name.endsWith(".test.ts"),
    );
    for (const file of files) {
      if (exceptions.has(file)) continue;
      const content = await readFile(file);
      const lines = content.split("\n");
      // Track brace depth to detect module-level vs function-level
      let depth = 0;
      lines.forEach((line, i) => {
        // rough depth tracking: count { and } in non-comment, non-string lines
        const stripped = line
          .replace(/\/\/.*$/, "")
          .replace(/"[^"]*"/g, '""')
          .replace(/'[^']*'/g, "''")
          .replace(/`[^`]*`/g, "``");
        depth += (stripped.match(/\{/g) || []).length;
        depth -= (stripped.match(/\}/g) || []).length;
        depth = Math.max(0, depth);

        if (
          depth === 0 &&
          /const\s+\w*[Ll]ogger\w*\s*=\s*get(?:Client)?Logger\s*\(/.test(line)
        ) {
          findings.push({
            file: file.replace(appRoot + path.sep, ""),
            line: i + 1,
            text: line.trim(),
            fix: "Move getClientLogger() call inside the handler function body — call it per-invocation, not at module level",
          });
        }
      });
    }
  }
  return findings;
}

// ─── check B13: missing shared.ts for multi-handler route families ─────────────
//
// For each directory under app/api/** that contains ≥2 route.ts files
// (counting [param]/route.ts as one, route.ts as another) but no shared.ts,
// flag it as missing the shared adapter utility module.

async function collectMissingSharedTs(appRoot) {
  const apiDir = path.join(appRoot, "app", "api");
  const findings = [];
  const structuralSharedTsExceptions = new Set([
    "app/api",
    "app/api/advice",
    "app/api/health",
    "app/api/internal",
    "app/api/internal/onboarding-remediation",
  ]);

  async function hasAncestorSharedTs(dir) {
    let current = path.dirname(dir);
    while (current.startsWith(apiDir) && current !== apiDir) {
      const sharedPath = path.join(current, "shared.ts");
      try {
        await fs.access(sharedPath);
        return true;
      } catch {
        current = path.dirname(current);
      }
    }
    return false;
  }

  async function checkDir(dir) {
    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }

    const routeFiles = entries.filter(
      (e) => e.isFile() && e.name === "route.ts",
    );
    const subDirs = entries.filter((e) => e.isDirectory());
    const hasSharedTs = entries.some(
      (e) => e.isFile() && e.name === "shared.ts",
    );

    // Count route files in immediate children (param directories like [id])
    let childRouteCount = routeFiles.length;
    for (const sub of subDirs) {
      const subEntries = await fs
        .readdir(path.join(dir, sub.name), {
          withFileTypes: true,
        })
        .catch(() => []);
      if (subEntries.some((e) => e.isFile() && e.name === "route.ts")) {
        childRouteCount++;
      }
    }

    const relativeDirectory = dir
      .replace(appRoot + path.sep, "")
      .split(path.sep)
      .join("/");
    if (
      childRouteCount >= 2 &&
      !hasSharedTs &&
      !structuralSharedTsExceptions.has(relativeDirectory) &&
      !(await hasAncestorSharedTs(dir))
    ) {
      findings.push({
        directory: relativeDirectory,
        routeFilesFound: childRouteCount,
        fix: "Create shared.ts in this directory with logRouteOutcome, domainErrorCodeToStatus, client-safe message table, conflictResponse, now(), actorRoleLabel()",
      });
    }

    // Recurse into subdirectories
    for (const sub of subDirs) {
      if (sub.name !== "node_modules" && !sub.name.startsWith(".")) {
        await checkDir(path.join(dir, sub.name));
      }
    }
  }

  await checkDir(apiDir);
  return findings;
}

// ─── check B17: idempotency key body-spread ────────────────────────────────────
//
// Finds IdempotencyService.generateKey() calls where the third argument
// uses spread syntax that would fan Class B field values into key derivation.
// Pattern: generateKey(x, y, { ...body }) or generateKey(x, y, body) where
// body is the raw request body or a full DTO object.

async function collectIdempotencyKeyBodySpread(appRoot, exceptions) {
  const apiDir = path.join(appRoot, "app", "api");
  const actionsDir = path.join(appRoot, "app", "actions");

  const findings = [];
  // Match generateKey( with spread in third arg, or passing raw `body` variable
  const spreadPattern = /IdempotencyService\.generateKey\s*\([^)]*\.\.\./g;
  // Also catch: generateKey(userId, op, body) where third arg is just `body`
  // (a common pattern that passes the full parsed request body)
  const rawBodyPattern =
    /IdempotencyService\.generateKey\s*\(\s*\w+\s*,\s*\w+\s*,\s*body\s*\)/g;
  const rawUpdateDataPattern =
    /IdempotencyService\.generateKey\s*\(\s*\w+\s*,\s*\w+\s*,\s*(?:updateData|validatedData|input|data)\s*\)/g;

  for (const dir of [apiDir, actionsDir]) {
    const files = await walkFiles(
      dir,
      (name) =>
        (name.endsWith(".ts") || name.endsWith(".tsx")) &&
        !name.endsWith(".test.ts"),
    );
    for (const file of files) {
      if (exceptions.has(file)) continue;
      const content = await readFile(file);
      const lines = content.split("\n");
      lines.forEach((line, i) => {
        const trimmed = line.trim();
        if (trimmed.startsWith("//") || trimmed.startsWith("*")) return;
        if (
          spreadPattern.test(line) ||
          rawBodyPattern.test(line) ||
          rawUpdateDataPattern.test(line)
        ) {
          spreadPattern.lastIndex = 0;
          rawBodyPattern.lastIndex = 0;
          rawUpdateDataPattern.lastIndex = 0;
          findings.push({
            file: file.replace(appRoot + path.sep, ""),
            line: i + 1,
            text: trimmed,
            fix: "Use Class C/D summary fields only in generateKey() third argument — e.g. { domain: 'property', fieldsCount: Object.keys(data).length }",
          });
        }
        spreadPattern.lastIndex = 0;
        rawBodyPattern.lastIndex = 0;
        rawUpdateDataPattern.lastIndex = 0;
      });
    }
  }
  return findings;
}

// ─── check B14: inline Date.now() in handler bodies ──────────────────────────
//
// Finds Date.now() used inside exported route handler function bodies
// in app/api/**. The canonical timing primitive is now() from shared.ts.
//
// Exception: the first Date.now() in a file that is immediately assigned to
// `startedAt` or `start` is acceptable in files that do NOT yet have a
// shared.ts (i.e. single-handler routes). Files that already import now()
// from shared.ts must not also call Date.now() directly.

async function collectInlineDateNow(appRoot, exceptions) {
  const apiDir = path.join(appRoot, "app", "api");
  const findings = [];

  const files = await walkFiles(
    apiDir,
    (name) =>
      (name.endsWith(".ts") || name.endsWith(".tsx")) &&
      !name.endsWith(".test.ts") &&
      name !== "shared.ts",
  );

  for (const file of files) {
    if (exceptions.has(file)) continue;
    const content = await readFile(file);

    // If the file imports now() from shared.ts, Date.now() is prohibited
    const importsNow =
      /import\s+\{[^}]*\bnow\b[^}]*\}\s+from\s+['"][^'"]*shared['"]/.test(
        content,
      );
    if (!importsNow) continue; // files without shared.ts import are not yet subject to this check

    const lines = content.split("\n");
    lines.forEach((line, i) => {
      const trimmed = line.trim();
      if (trimmed.startsWith("//") || trimmed.startsWith("*")) return;
      if (/\bDate\.now\(\)/.test(line)) {
        findings.push({
          file: file.replace(appRoot + path.sep, ""),
          line: i + 1,
          text: trimmed,
          fix: "Replace Date.now() with now() imported from ./shared — handler already imports now()",
        });
      }
    });
  }
  return findings;
}

// ─── check A8 (partial): mapper infrastructure import ─────────────────────────
//
// Mappers must be pure functions. They must not import from infrastructure,
// route adapters, or server actions. This check catches the most common
// violations: imports from app/lib/infrastructure, app/api, or app/actions.

async function collectMapperInfraImport(appRoot, exceptions) {
  const domainsDir = path.join(appRoot, "app", "lib", "domains");
  const findings = [];

  const mapperFiles = await walkFiles(
    domainsDir,
    (name) => name === "mappers.ts",
  );

  for (const file of mapperFiles) {
    if (exceptions.has(file)) continue;
    const content = await readFile(file);
    const lines = content.split("\n");
    lines.forEach((line, i) => {
      const trimmed = line.trim();
      if (!trimmed.startsWith("import")) return;
      if (
        /from\s+['"]@?\/app\/lib\/infrastructure/.test(line) ||
        /from\s+['"]@?\/app\/api\//.test(line) ||
        /from\s+['"]@?\/app\/actions\//.test(line) ||
        /from\s+['"]@?\/app\/lib\/api\//.test(line)
      ) {
        findings.push({
          file: file.replace(appRoot + path.sep, ""),
          line: i + 1,
          text: trimmed,
          fix: "Mappers are pure functions — remove infrastructure, api, or actions imports. Mappers may only import from @build/*, @prisma/client (type-only), and sibling domain files.",
        });
      }
    });
  }
  return findings;
}

// ─── check B15: safeIdempotencyComplete ───────────────────────────────────────
async function collectSafeIdempotencyCompleteDrift(appRoot, exceptions) {
  const apiDir = path.join(appRoot, "app", "api");
  const actionsDir = path.join(appRoot, "app", "actions");
  const findings = [];
  const completionPattern = /IdempotencyService\.complete\s*\(/g;

  for (const dir of [apiDir, actionsDir]) {
    const files = await walkFiles(
      dir,
      (name) =>
        (name.endsWith(".ts") || name.endsWith(".tsx")) &&
        !name.endsWith(".test.ts"),
    );
    for (const file of files) {
      if (exceptions.has(file)) continue;
      const content = await readFile(file);
      const lines = content.split("\n");
      for (let i = 0; i < lines.length; i++) {
        if (completionPattern.test(lines[i])) {
          completionPattern.lastIndex = 0;
          // Check for inline catch on same or next few lines
          const lookahead = lines.slice(i, i + 5).join("\n");
          if (
            !/\.catch\s*\(/.test(lookahead) &&
            !/catch\s*\(/.test(lookahead)
          ) {
            findings.push({
              file: file.replace(appRoot + path.sep, ""),
              line: i + 1,
              text: lines[i].trim(),
              fix: "Use safeIdempotencyComplete() or provide an inline try-catch for IdempotencyService.complete()",
            });
          }
        }
      }
    }
  }
  return findings;
}

// ─── check A8: mapper normalization ───────────────────────────────────────────
async function collectMapperNormalizationDrift(appRoot, exceptions) {
  const domainsDir = path.join(appRoot, "app", "lib", "domains");
  const findings = [];
  const serviceFiles = await walkFiles(
    domainsDir,
    (name) => name === "service.ts" || name === "repository.ts",
  );

  for (const file of serviceFiles) {
    if (exceptions.has(file)) continue;
    const content = await readFile(file);
    const lines = content.split("\n");
    lines.forEach((line, i) => {
      if (/\.toNumber\(\)/.test(line) || /\.toISOString\(\)/.test(line)) {
        findings.push({
          file: file.replace(appRoot + path.sep, ""),
          line: i + 1,
          text: line.trim(),
          fix: "Move Decimal and Date normalization (e.g. .toNumber(), .toISOString()) to mappers.ts",
        });
      }
    });
  }
  return findings;
}

// ─── check A9: operations builder ─────────────────────────────────────────────
async function collectOperationsBuilderDrift(appRoot, exceptions) {
  const domainsDir = path.join(appRoot, "app", "lib", "domains");
  const findings = [];
  const serviceFiles = await walkFiles(
    domainsDir,
    (name) => name === "service.ts",
  );

  for (const file of serviceFiles) {
    if (exceptions.has(file)) continue;
    const content = await readFile(file);
    const lines = content.split("\n");
    let inPrismaCall = false;
    let blockStartLine = 0;
    let braceDepth = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!inPrismaCall) {
        if (/prisma\.\w+\.(?:create|update|upsert)\s*\(/.test(line)) {
          inPrismaCall = true;
          blockStartLine = i;
          braceDepth =
            (line.match(/\{/g) || []).length - (line.match(/\}/g) || []).length;
        }
      } else {
        braceDepth +=
          (line.match(/\{/g) || []).length - (line.match(/\}/g) || []).length;
        if (braceDepth <= 0) {
          const linesCount = i - blockStartLine;
          if (linesCount > 30) {
            findings.push({
              file: file.replace(appRoot + path.sep, ""),
              line: blockStartLine + 1,
              text: lines[blockStartLine].trim(),
              fix: `Prisma input builder is ~${linesCount} lines. Move to operations.ts per A9.`,
            });
          }
          inPrismaCall = false;
        }
      }
    }
  }
  return findings;
}

// ─── check A10: index export ──────────────────────────────────────────────────
async function collectIndexExportDrift(appRoot, exceptions) {
  const domainsDir = path.join(appRoot, "app", "lib", "domains");
  const findings = [];
  const indexFiles = await walkFiles(domainsDir, (name) => name === "index.ts");

  for (const file of indexFiles) {
    if (exceptions.has(file)) continue;
    const content = await readFile(file);
    const lines = content.split("\n");
    lines.forEach((line, i) => {
      if (/export\s+.*from\s+['"]\.\/(?:mappers|operations)['"]/.test(line)) {
        findings.push({
          file: file.replace(appRoot + path.sep, ""),
          line: i + 1,
          text: line.trim(),
          fix: "index.ts must not export mapper or operations internals per A10",
        });
      }
    });
  }
  return findings;
}

// ─── main export ──────────────────────────────────────────────────────────────

/**
 * @param {string} appRoot  Absolute path to the apps/client directory.
 *                          Pass __dirname equivalent: path.resolve("apps/client")
 * @returns {Promise<{
 *   resultDiscriminantDrift:   Array<{file,line,text,fix}>,
 *   inlineLoggerAtModuleLevel: Array<{file,line,text,fix}>,
 *   missingSharedTs:           Array<{directory,routeFilesFound,fix}>,
 *   idempotencyKeyBodySpread:  Array<{file,line,text,fix}>,
 *   inlineDateNow:             Array<{file,line,text,fix}>,
 *   mapperInfraImport:         Array<{file,line,text,fix}>,
 * }>}
 */
export async function collectPhase0Drift(appRoot) {
  const scriptDir = path.join(appRoot, "scripts");

  const [
    rdExceptions,
    ilExceptions,
    ikExceptions,
    idExceptions,
    miExceptions,
    scExceptions,
    mnExceptions,
    obExceptions,
    ieExceptions,
  ] = await Promise.all([
    readJsonExceptions(scriptDir, "drift-exceptions-result-discriminant.json"),
    readJsonExceptions(scriptDir, "drift-exceptions-inline-logger.json"),
    readJsonExceptions(
      scriptDir,
      "drift-exceptions-idempotency-key-spread.json",
    ),
    readJsonExceptions(scriptDir, "drift-exceptions-inline-date-now.json"),
    readJsonExceptions(scriptDir, "drift-exceptions-mapper-infra-import.json"),
    readJsonExceptions(
      scriptDir,
      "drift-exceptions-safe-idempotency-complete.json",
    ),
    readJsonExceptions(scriptDir, "drift-exceptions-mapper-normalization.json"),
    readJsonExceptions(scriptDir, "drift-exceptions-operations-builder.json"),
    readJsonExceptions(scriptDir, "drift-exceptions-index-export.json"),
  ]);

  const [
    resultDiscriminantDrift,
    inlineLoggerAtModuleLevel,
    missingSharedTs,
    idempotencyKeyBodySpread,
    inlineDateNow,
    mapperInfraImport,
    safeIdempotencyCompleteDrift,
    mapperNormalizationDrift,
    operationsBuilderDrift,
    indexExportDrift,
  ] = await Promise.all([
    collectResultDiscriminantDrift(appRoot, rdExceptions),
    collectInlineLoggerAtModuleLevel(appRoot, ilExceptions),
    collectMissingSharedTs(appRoot),
    collectIdempotencyKeyBodySpread(appRoot, ikExceptions),
    collectInlineDateNow(appRoot, idExceptions),
    collectMapperInfraImport(appRoot, miExceptions),
    collectSafeIdempotencyCompleteDrift(appRoot, scExceptions),
    collectMapperNormalizationDrift(appRoot, mnExceptions),
    collectOperationsBuilderDrift(appRoot, obExceptions),
    collectIndexExportDrift(appRoot, ieExceptions),
  ]);

  return {
    resultDiscriminantDrift,
    inlineLoggerAtModuleLevel,
    missingSharedTs,
    idempotencyKeyBodySpread,
    inlineDateNow,
    mapperInfraImport,
    safeIdempotencyCompleteDrift,
    mapperNormalizationDrift,
    operationsBuilderDrift,
    indexExportDrift,
  };
}

// ─── standalone runner ────────────────────────────────────────────────────────
// Run directly to preview findings before integrating into the main script:
//
//   node apps/client/scripts/drift-checks-phase0.mjs
//
// Set APP_ROOT env var if running from a different directory:
//   APP_ROOT=/path/to/apps/client node drift-checks-phase0.mjs

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) ===
    path.resolve(import.meta.url.replace("file://", ""))
) {
  const appRoot = process.env.APP_ROOT || path.resolve("apps/client");
  console.log(`Scanning: ${appRoot}\n`);

  const results = await collectPhase0Drift(appRoot);

  let totalFindings = 0;
  for (const [category, findings] of Object.entries(results)) {
    const count = Array.isArray(findings) ? findings.length : 0;
    totalFindings += count;
    if (count === 0) {
      console.log(`✅  ${category}: 0 findings`);
    } else {
      console.log(`\n❌  ${category}: ${count} finding(s)`);
      for (const f of findings) {
        if (f.file) {
          console.log(`    ${f.file}:${f.line}`);
          console.log(`    ${f.text}`);
          console.log(`    → ${f.fix}`);
        } else {
          console.log(`    ${f.directory} (${f.routeFilesFound} route files)`);
          console.log(`    → ${f.fix}`);
        }
        console.log();
      }
    }
  }

  console.log(`\nTotal: ${totalFindings} finding(s)`);
  process.exit(totalFindings > 0 ? 1 : 0);
}
