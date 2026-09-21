#!/usr/bin/env node
/**
 * check-package-manager-consistency.mjs
 *
 * Why this exists:
 * Vercel resolves the toolchain (corepack packageManager + engines.node) from the
 * nearest package.json to the configured "Root Directory" of a project, walking
 * up toward the repo root only if a field is missing. Because apps/client and
 * apps/admin are deployed as separate Vercel projects with Root Directory set to
 * their own folder, a packageManager or engines.node value declared in an app's
 * own package.json wins over the monorepo root — even if it silently drifted out
 * of sync with the version the pnpm-lock.yaml was actually generated with.
 *
 * That drift is invisible in GitHub Actions CI, because CI always installs from
 * the repo root and therefore always reads the root package.json's packageManager
 * field. It only surfaces on Vercel, as a frozen-lockfile / resolution mismatch
 * failure, or as silently-different-Node-runtime behavior in production.
 *
 * This script fails fast, in CI, before that gap can reach Vercel.
 */

import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..");

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function findWorkspacePackageJsonPaths() {
  const paths = [];
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

const rootPkg = readJson(join(repoRoot, "package.json"));
const rootPackageManager = rootPkg.packageManager;
const rootEnginesNode = rootPkg.engines?.node;

if (!rootPackageManager) {
  console.error(
    "check-package-manager-consistency: root package.json has no \"packageManager\" field. " +
      "This is required so corepack pins one exact pnpm version repo-wide.",
  );
  process.exit(1);
}

const findings = [];

for (const pkgPath of findWorkspacePackageJsonPaths()) {
  const pkg = readJson(pkgPath);
  const relPath = pkgPath.replace(repoRoot + "/", "");

  if (pkg.packageManager && pkg.packageManager !== rootPackageManager) {
    findings.push(
      `${relPath}: packageManager "${pkg.packageManager}" does not match root "${rootPackageManager}". ` +
        `Vercel builds this package with its own Root Directory set, so it will read THIS file's ` +
        `packageManager, not the root's — a silent pnpm-version mismatch against the lockfile.`,
    );
  }

  const pkgEnginesNode = pkg.engines?.node;
  if (pkgEnginesNode && rootEnginesNode && pkgEnginesNode !== rootEnginesNode) {
    findings.push(
      `${relPath}: engines.node "${pkgEnginesNode}" does not match root engines.node "${rootEnginesNode}". ` +
        `Vercel resolves the Node runtime from this file when it is the project's Root Directory.`,
    );
  }
}

if (findings.length > 0) {
  console.error("\nWorkspace packageManager / engines.node drift detected:\n");
  for (const finding of findings) {
    console.error(`  - ${finding}`);
  }
  console.error(
    `\nFix: set the field(s) above to match the root exactly, or remove the field from the ` +
      `nested package.json so it inherits from root.\n`,
  );
  process.exit(1);
}

console.log(
  `check-package-manager-consistency: OK — all workspace packages agree with root ` +
    `(packageManager="${rootPackageManager}"${rootEnginesNode ? `, engines.node="${rootEnginesNode}"` : ""}).`,
);
