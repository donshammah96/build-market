import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const currentDir = fileURLToPath(new URL(".", import.meta.url));
const legalDir = join(currentDir, "..", "..", "app", "legal");

const BANNED_PATTERNS = [
  { pattern: /pinky promise/i, label: "pinky promise joke copy" },
  { pattern: /teaching our lawyers/i, label: "teaching our lawyers joke copy" },
  { pattern: /lorem ipsum/i, label: "lorem ipsum dummy copy" },
  { pattern: /under construction/i, label: "under construction placeholder" },
  { pattern: /\bTODO\b/i, label: "unresolved TODO marker" },
];

function getLegalSourceFiles(directory: string): string[] {
  const results: string[] = [];
  for (const entry of readdirSync(directory)) {
    const fullPath = join(directory, entry);
    if (statSync(fullPath).isDirectory()) {
      results.push(...getLegalSourceFiles(fullPath));
    } else if (fullPath.endsWith(".tsx") || fullPath.endsWith(".ts")) {
      results.push(fullPath);
    }
  }
  return results;
}

describe("Legal Pages Production Copy Guard", () => {
  const files = getLegalSourceFiles(legalDir);

  it("finds legal source files to inspect", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  for (const file of files) {
    const relativeName = file.replace(legalDir, "").replaceAll("\\", "/");

    it(`ensures ${relativeName} contains zero prohibited placeholder or joke copy`, () => {
      const content = readFileSync(file, "utf8");

      for (const { pattern, label } of BANNED_PATTERNS) {
        const match = pattern.exec(content);
        expect(
          match,
          `Found prohibited pattern "${label}" in ${relativeName}: "${match?.[0]}"`,
        ).toBeNull();
      }
    });
  }
});
