#!/usr/bin/env node
/**
 * check-catalog-consistency.mjs
 *
 * Why this exists:
 * In a pnpm monorepo using workspace catalogs, any dependency defined in
 * pnpm-workspace.yaml's catalog MUST use "catalog:" in package.json files.
 *
 * If a developer or automated tool (e.g. Dependabot/Renovate) adds a raw
 * version string (e.g. "next": "16.2.11") into a package.json manifest, pnpm
 * will treat the specifier as mismatched against a lockfile built with "catalog:",
 * resulting in ERR_PNPM_OUTDATED_LOCKFILE in CI frozen-lockfile builds.
 *
 * This zero-dependency script parses pnpm-workspace.yaml catalog keys and asserts
 * that every workspace package.json uses "catalog:" for those dependencies.
 * Fails fast in CI (<100ms) before dependency installation.
 */

import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..");

function readWorkspaceCatalogKeys() {
  const workspaceYamlPath = join(repoRoot, "pnpm-workspace.yaml");
  if (!existsSync(workspaceYamlPath)) {
    console.error("check-catalog-consistency: pnpm-workspace.yaml not found.");
    process.exit(1);
  }

  const content = readFileSync(workspaceYamlPath, "utf8");
  const catalogKeys = new Set();

  let inCatalogSection = false;
  for (const line of content.split("\n")) {
    const trimmed = line.trimEnd();
    if (trimmed.startsWith("catalog:")) {
      inCatalogSection = true;
      continue;
    }
    // Stop reading catalog when hitting another top-level section (unindented key ending in :)
    if (inCatalogSection && /^[a-zA-Z0-9_-]+:/.test(trimmed) && !trimmed.startsWith("  ")) {
      break;
    }
    if (inCatalogSection) {
      // Match lines indented with 2 spaces defining a key: value (e.g. "  next: 16.2.11" or "  \"@clerk/nextjs\": ^7.3.3")
      const match = line.match(/^ {2}(?:"([^"]+)"|'([^']+)'|([@a-zA-Z0-9_./-]+)):\s*.+/);
      if (match) {
        const key = match[1] || match[2] || match[3];
        if (key && !key.startsWith("#")) {
          catalogKeys.add(key);
        }
      }
    }
  }

  return catalogKeys;
}

function findWorkspacePackageJsonPaths() {
  const paths = [join(repoRoot, "package.json")];
  for (const group of ["apps", "packages"]) {
    const groupDir = join(repoRoot, group);
    if (!existsSync(groupDir)) continue;
    for (const entry of readdirSync(groupDir)) {
      const entryDir = join(groupDir, entry);
      if (!statSync(entryDir).isDirectory()) continue;
      const pkgPath = join(entryDir, "package.json");
      if (existsSync(pkgPath)) {
        paths.push(pkgPath);
      }
    }
  }
  return paths;
}

const catalogKeys = readWorkspaceCatalogKeys();

if (catalogKeys.size === 0) {
  console.error("check-catalog-consistency: No catalog entries found in pnpm-workspace.yaml.");
  process.exit(1);
}

const dependencySections = [
  "dependencies",
  "devDependencies",
  "peerDependencies",
  "optionalDependencies",
];

const findings = [];

for (const pkgPath of findWorkspacePackageJsonPaths()) {
  const relPath = pkgPath.replace(repoRoot, "").replace(/^[/\\]/, "").replace(/\\/g, "/");
  const pkgContent = JSON.parse(readFileSync(pkgPath, "utf8"));

  for (const section of dependencySections) {
    const deps = pkgContent[section];
    if (!deps) continue;

    for (const [depName, specifier] of Object.entries(deps)) {
      if (catalogKeys.has(depName) && specifier !== "catalog:") {
        findings.push(
          `${relPath} [${section}]: "${depName}" is declared as "${specifier}", but is defined in pnpm-workspace.yaml catalog. Must be "catalog:".`,
        );
      }
    }
  }
}

if (findings.length > 0) {
  console.error("\nWorkspace pnpm catalog specifier drift detected:\n");
  for (const finding of findings) {
    console.error(`  - ${finding}`);
  }
  console.error(
    `\nFix: change the dependency specifier in the package.json file(s) above to "catalog:", ` +
      `or update pnpm-workspace.yaml if modifying the repository-wide catalog version.\n`,
  );
  process.exit(1);
}

console.log(
  `check-catalog-consistency: OK — checked ${catalogKeys.size} catalog dependencies across workspace manifests. All specifiers match "catalog:".`,
);
