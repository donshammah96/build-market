import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const currentDir = fileURLToPath(new URL(".", import.meta.url));
const appDir = join(currentDir, "..", "..", "app");
const componentsDir = join(currentDir, "..", "..", "components");

const BANNED_CUSTODIAL_PATTERNS = [
  { pattern: /\bescrow\b/i, label: "escrow claim" },
  { pattern: /bank-grade escrow/i, label: "bank-grade escrow marketing claim" },
  { pattern: /custodial wallet/i, label: "custodial wallet claim" },
  { pattern: /safeguarded funds/i, label: "safeguarded funds claim" },
  { pattern: /secure hold/i, label: "secure hold funds claim" },
  { pattern: /we hold your funds/i, label: "holding funds claim" },
  { pattern: /funds held in escrow/i, label: "funds held in escrow claim" },
];

/**
 * Scans public frontend routes and components, excluding /legal/**, /api/**, and /lib/**.
 * /legal/** is explicitly reviewed by legal counsel and must name "escrow" to disclaim it
 * (e.g. "BuildMarket does not hold funds in escrow or provide custodial accounts").
 */
function getPublicSourceFiles(directory: string): string[] {
  const results: string[] = [];
  if (!directory) return results;

  for (const entry of readdirSync(directory)) {
    const fullPath = join(directory, entry);
    const normalized = fullPath.replaceAll("\\", "/");

    // Skip legal disclaimers, backend API/action adapters, and internal domain libraries
    if (
      normalized.includes("/app/legal") ||
      normalized.includes("/app/api") ||
      normalized.includes("/app/actions") ||
      normalized.includes("/app/lib") ||
      normalized.includes("/node_modules") ||
      normalized.includes("/.next")
    ) {
      continue;
    }

    if (statSync(fullPath).isDirectory()) {
      results.push(...getPublicSourceFiles(fullPath));
    } else if (
      fullPath.endsWith(".tsx") ||
      (fullPath.endsWith(".ts") && !fullPath.includes(".test."))
    ) {
      results.push(fullPath);
    }
  }
  return results;
}

describe("Non-Custodial Marketplace Marketing & Copy Guard", () => {
  const publicAppFiles = getPublicSourceFiles(appDir);
  const componentFiles = getPublicSourceFiles(componentsDir);
  const allTargetFiles = [...publicAppFiles, ...componentFiles];

  it("identifies public marketing, onboarding, and component files to inspect", () => {
    expect(allTargetFiles.length).toBeGreaterThan(0);
  });

  for (const file of allTargetFiles) {
    const relativeName = file
      .replace(join(currentDir, "..", ".."), "")
      .replaceAll("\\", "/");

    it(`ensures ${relativeName} contains zero prohibited custodial or escrow marketing claims`, () => {
      const content = readFileSync(file, "utf8");

      for (const { pattern, label } of BANNED_CUSTODIAL_PATTERNS) {
        const match = pattern.exec(content);
        expect(
          match,
          `Found prohibited pattern "${label}" in ${relativeName}: "${match?.[0]}"`,
        ).toBeNull();
      }
    });
  }
});
