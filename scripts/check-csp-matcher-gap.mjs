#!/usr/bin/env node
/**
 * check-csp-matcher-gap.mjs
 *
 * Enforces the invariant documented in STRICT_CSP_IMPLEMENTATION_PLAN.md:
 * next-config-csp.ts (tier 2, static fallback CSP) must be provably
 * unreachable for real page traffic. The only way it currently gets
 * reached is if middleware.ts's matcher excludes a route class — in
 * practice, literal `.html` files (the `html?` token in the matcher's
 * negative lookahead).
 *
 * This check fails the build if:
 *   1. middleware.ts's matcher negative-lookahead contains `html?`
 *      (i.e. .html files are excluded from middleware, hence from the
 *      strict per-request CSP) AND there is no
 *      `csp-html-allowlist.json` declaring which specific files that's
 *      intentional for, OR
 *   2. an .html file exists under `public/` (or another configured static
 *      root) that is NOT listed in csp-html-allowlist.json.
 *
 * Rationale: a route that skips the CSP middleware very likely also skips
 * the AUTH middleware (same matcher, same gate). This check exists to make
 * "does this route go through middleware" a CI-enforced fact, not a
 * code-review assumption.
 *
 * Usage:
 *   node scripts/check-csp-matcher-gap.mjs
 *
 * Exit codes:
 *   0 - no gap, or gap is fully allowlisted
 *   1 - un-allowlisted gap found (fails CI)
 *
 * Config:
 *   Set MIDDLEWARE_PATH / PUBLIC_DIR / ALLOWLIST_PATH env vars to override
 *   defaults if your repo layout differs from the ones below.
 */

import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

/**
 * Minimal recursive **   / *.html walker. Avoids depending on node:fs's
 * globSync (Node 22+ only) or pulling in an external glob package just for
 * one CI check.
 */
function findHtmlFilesRecursive(dir) {
  /** @type {string[]} */
  const results = [];
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return results;
  }
  for (const entry of entries) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      results.push(...findHtmlFilesRecursive(full));
    } else if (stat.isFile() && entry.toLowerCase().endsWith(".html")) {
      results.push(full);
    }
  }
  return results;
}

const REPO_ROOT = process.cwd();
const MIDDLEWARE_PATH =
  process.env.MIDDLEWARE_PATH ?? join(REPO_ROOT, "apps", "client", "middleware.ts");
const PUBLIC_DIR =
  process.env.PUBLIC_DIR ?? join(REPO_ROOT, "apps", "client", "public");
const ALLOWLIST_PATH =
  process.env.ALLOWLIST_PATH ??
  join(REPO_ROOT, "apps", "client", "csp-html-allowlist.json");

/** @type {string[]} */
const errors = [];

function loadAllowlist() {
  if (!existsSync(ALLOWLIST_PATH)) {
    return null; // distinguish "no file" from "empty allowlist"
  }
  try {
    const raw = JSON.parse(readFileSync(ALLOWLIST_PATH, "utf8"));
    if (!Array.isArray(raw)) {
      errors.push(
        `${relative(REPO_ROOT, ALLOWLIST_PATH)} must be a JSON array of ` +
          `repo-relative paths, e.g. ["public/status.html"]. Got: ${typeof raw}`,
      );
      return [];
    }
    return raw;
  } catch (err) {
    errors.push(
      `Failed to parse ${relative(REPO_ROOT, ALLOWLIST_PATH)}: ${
        /** @type {Error} */ (err).message
      }`,
    );
    return [];
  }
}

function checkMatcherExcludesHtml() {
  if (!existsSync(MIDDLEWARE_PATH)) {
    return null;
  }

  const src = readFileSync(MIDDLEWARE_PATH, "utf8");

  // Find the `config.matcher` array literal and inspect its string entries.
  // Deliberately simple (regex over the source) rather than a full TS parse —
  // this only needs to catch the one pattern we're guarding against, and a
  // false negative here is caught downstream by the public/ scan anyway.
  const matcherBlockMatch = src.match(/matcher\s*:\s*\[([\s\S]*?)\]/);
  if (!matcherBlockMatch) {
    errors.push(
      `Could not locate 'matcher: [...]' in ${relative(REPO_ROOT, MIDDLEWARE_PATH)}. ` +
        `If the matcher config moved, update MATCHER detection in this script.`,
    );
    return null;
  }

  const matcherSource = matcherBlockMatch[1];
  return /html\?/.test(matcherSource);
}

function findPublicHtmlFiles() {
  if (!existsSync(PUBLIC_DIR)) return [];
  return findHtmlFilesRecursive(PUBLIC_DIR).map((f) => relative(REPO_ROOT, f));
}

function main() {
  const excludesHtml = checkMatcherExcludesHtml();
  const allowlist = loadAllowlist();
  const publicHtmlFiles = findPublicHtmlFiles();

  if (excludesHtml === true && allowlist === null) {
    errors.push(
      `middleware.ts excludes .html files from the CSP/auth matcher, but ` +
        `no ${relative(REPO_ROOT, ALLOWLIST_PATH)} exists to declare that ` +
        `as intentional. Either:\n` +
        `  (a) remove 'html?' from the matcher's negative lookahead so .html ` +
        `      routes get the strict per-request CSP (and auth) like every ` +
        `      other route — the recommended fix if you don't serve static ` +
        `      HTML, or\n` +
        `  (b) create ${relative(REPO_ROOT, ALLOWLIST_PATH)} as a JSON array ` +
        `      explicitly listing the .html paths that are intentionally ` +
        `      served outside middleware (e.g. ["public/status.html"]).`,
    );
  }

  if (publicHtmlFiles.length > 0) {
    const allowed = new Set(allowlist ?? []);
    const unlisted = publicHtmlFiles.filter((f) => !allowed.has(f));
    if (unlisted.length > 0) {
      errors.push(
        `Found .html file(s) in public/ not listed in ` +
          `${relative(REPO_ROOT, ALLOWLIST_PATH)}:\n` +
          unlisted.map((f) => `  - ${f}`).join("\n") +
          `\nThese files bypass middleware.ts, meaning they get the WEAKER ` +
          `static fallback CSP (next-config-csp.ts) instead of the strict ` +
          `nonce-based policy — and likely bypass auth middleware too. ` +
          `Either remove them, route them through middleware, or add them ` +
          `to the allowlist with a comment explaining why they're exempt.`,
      );
    }
  }

  if (errors.length > 0) {
    console.error("\n❌ CSP matcher gap check failed:\n");
    for (const e of errors) {
      console.error(e + "\n");
    }
    process.exit(1);
  }

  console.log(
    "✅ CSP matcher gap check passed — no un-allowlisted routes bypass middleware.",
  );
}

main();
