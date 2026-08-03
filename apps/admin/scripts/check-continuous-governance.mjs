#!/usr/bin/env node
/**
 * check-continuous-governance.mjs
 *
 * Continuous Governance Linter for apps/admin (Phase 4).
 *
 * Verifies:
 * 1. Feature Flag Lifespan & Retirement Governance:
 *    - All flags in `FEATURE_FLAG_LIFECYCLE_METADATA` have required metadata fields.
 *    - Flags stay within maxLifetimeDays and do not exceed target retirement dates.
 * 2. High-Risk Action Audit Coverage:
 *    - High-risk operations listed in `high-risk-admin-registry.mjs` are registered.
 * 3. Dependency Security Patch SLOs:
 *    - Monorepo `pnpm-workspace.yaml` maintains active overrides for known GHSA vulnerabilities.
 */

import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { HIGH_RISK_ADMIN_ACTIONS } from "./high-risk-admin-registry.mjs";

const ROOT = process.cwd(); // expected to be apps/admin
const MONOREPO_ROOT = path.resolve(ROOT, "../..");

const violations = [];

function addViolation(rule, message) {
  violations.push({ rule, message });
}

/**
 * 1. Feature Flag Lifespan & Expiry Check
 */
function checkFeatureFlagGovernance() {
  const flagsFilePath = path.join(ROOT, "src/lib/config/feature-flags.ts");
  if (!existsSync(flagsFilePath)) {
    addViolation("feature-flag-governance", "feature-flags.ts missing");
    return;
  }

  const content = readFileSync(flagsFilePath, "utf8");

  // Extract AdminFeatureFlag keys
  const enumMatch = content.match(
    /export const AdminFeatureFlag\s*=\s*\{([\s\S]*?)\}\s*as const;/,
  );
  if (!enumMatch) {
    addViolation(
      "feature-flag-governance",
      "AdminFeatureFlag declaration missing or malformed",
    );
    return;
  }

  const enumBlock = enumMatch[1];
  const declaredFlagKeys = Array.from(
    enumBlock.matchAll(/([A-Z0-9_]+):\s*"([^"]+)"/g),
  ).map((m) => m[1]);

  // Extract FEATURE_FLAG_LIFECYCLE_METADATA block
  const match = content.match(
    /FEATURE_FLAG_LIFECYCLE_METADATA[\s\S]*?=\s*(\{[\s\S]*?\n\};)/,
  );
  if (!match) {
    addViolation(
      "feature-flag-governance",
      "FEATURE_FLAG_LIFECYCLE_METADATA missing or malformed",
    );
    return;
  }

  const metadataBlock = match[1];

  // Verify that every declared flag key exists in metadata dictionary
  for (const flagKey of declaredFlagKeys) {
    if (!metadataBlock.includes(`AdminFeatureFlag.${flagKey}`)) {
      addViolation(
        "feature-flag-metadata-missing",
        `Declared feature flag AdminFeatureFlag.${flagKey} is missing lifecycle metadata in FEATURE_FLAG_LIFECYCLE_METADATA.`,
      );
    }
  }

  // Parse entries from code static text
  const flagRegex =
    /\[AdminFeatureFlag\.([A-Z0-9_]+)\]:\s*\{[\s\S]*?owner:\s*"([^"]+)"[\s\S]*?createdAt:\s*"([^"]+)"[\s\S]*?targetRetirementDate:\s*"([^"]+)"[\s\S]*?maxLifetimeDays:\s*(\d+)[\s\S]*?description:\s*"([^"]+)"/g;

  let flagMatch;
  let flagCount = 0;
  const now = new Date();

  while ((flagMatch = flagRegex.exec(content)) !== null) {
    flagCount += 1;
    const [
      ,
      key,
      owner,
      createdAtStr,
      targetRetirementStr,
      maxLifetimeStr,
      description,
    ] = flagMatch;

    const createdAt = new Date(createdAtStr);
    const targetRetirement = new Date(targetRetirementStr);
    const maxLifetimeDays = parseInt(maxLifetimeStr, 10);

    if (isNaN(createdAt.getTime())) {
      addViolation(
        "feature-flag-governance",
        `Flag ${key} has invalid createdAt date: ${createdAtStr}`,
      );
    }

    if (isNaN(targetRetirement.getTime())) {
      addViolation(
        "feature-flag-governance",
        `Flag ${key} has invalid targetRetirementDate: ${targetRetirementStr}`,
      );
    }

    if (!owner || owner.trim() === "") {
      addViolation(
        "feature-flag-governance",
        `Flag ${key} has no assigned owner`,
      );
    }

    if (!description || description.trim() === "") {
      addViolation("feature-flag-governance", `Flag ${key} has no description`);
    }

    // Lifetime duration check
    const daysSinceCreation = Math.floor(
      (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24),
    );
    if (daysSinceCreation > maxLifetimeDays) {
      addViolation(
        "feature-flag-expiry",
        `Flag AdminFeatureFlag.${key} (owner: ${owner}) exceeded maximum approved lifetime (${daysSinceCreation} days active > ${maxLifetimeDays} days max). Retire flag per RETIREMENT.md.`,
      );
    }

    // Target retirement date check
    if (now.getTime() > targetRetirement.getTime() + 86400000) {
      addViolation(
        "feature-flag-retirement-overdue",
        `Flag AdminFeatureFlag.${key} (owner: ${owner}) passed target retirement date of ${targetRetirementStr}. Execute retirement per RETIREMENT.md.`,
      );
    }
  }

  if (flagCount === 0) {
    addViolation(
      "feature-flag-governance",
      "No feature flag metadata entries parsed from FEATURE_FLAG_LIFECYCLE_METADATA",
    );
  }
}

/**
 * 2. High-Risk Action & Audit Registry Coverage Check
 */
function checkHighRiskActionCoverage() {
  if (!HIGH_RISK_ADMIN_ACTIONS || HIGH_RISK_ADMIN_ACTIONS.length === 0) {
    addViolation(
      "high-risk-audit-coverage",
      "HIGH_RISK_ADMIN_ACTIONS is empty or undefined",
    );
    return;
  }

  for (const item of HIGH_RISK_ADMIN_ACTIONS) {
    if (
      !item.actionName ||
      !item.category ||
      !item.maxAgeSeconds ||
      !item.rateLimitNamespace
    ) {
      addViolation(
        "high-risk-audit-coverage",
        `Incomplete high-risk action registry entry: ${JSON.stringify(item)}`,
      );
    }
    if (item.maxAgeSeconds > 300) {
      addViolation(
        "high-risk-audit-coverage",
        `High-risk action ${item.actionName} maxAgeSeconds (${item.maxAgeSeconds}s) exceeds maximum 300s freshness window`,
      );
    }
  }
}

/**
 * 3. Dependency Security Patch SLO Assertion Check
 */
function checkDependencyPatchSlo() {
  const workspaceYamlPath = path.join(MONOREPO_ROOT, "pnpm-workspace.yaml");
  if (!existsSync(workspaceYamlPath)) {
    // If not running in workspace root, skip or warn
    return;
  }

  const workspaceYaml = readFileSync(workspaceYamlPath, "utf8");

  const requiredOverrides = [
    { pkg: "brace-expansion", expected: "2.1.3" },
    { pkg: "protobufjs", expected: ">=8.6.6" },
    { pkg: "ws", expected: ">=8.20.1" },
  ];

  for (const { pkg, expected } of requiredOverrides) {
    if (!workspaceYaml.includes(pkg) || !workspaceYaml.includes(expected)) {
      addViolation(
        "dependency-patch-slo",
        `Monorepo workspace overrides missing required security patch for ${pkg} (${expected})`,
      );
    }
  }
}

function main() {
  console.log("Running apps/admin Continuous Governance Checks (Phase 4)...");

  checkFeatureFlagGovernance();
  checkHighRiskActionCoverage();
  checkDependencyPatchSlo();

  if (violations.length > 0) {
    console.error("\n❌ CONTINUOUS GOVERNANCE VIOLATIONS FOUND:\n");
    for (const v of violations) {
      console.error(`  [${v.rule}] ${v.message}`);
    }
    console.error(`\nTotal violations: ${violations.length}\n`);
    process.exit(1);
  }

  console.log(
    "✅ Continuous governance checks passed cleanly with 0 violations.\n",
  );
  process.exit(0);
}

main();
