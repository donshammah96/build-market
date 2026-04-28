import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

type ValidationPolicyViolation = {
  file: string;
  line: number;
  check: "zod-parse-in-server-action" | "safeparse-followed-by-throw-new-error";
  sample: string;
};

const SERVER_ACTION_VALIDATION_ALLOWLIST_MARKER =
  "SECURITY_SERVER_ACTION_VALIDATION_ALLOWLIST";
const SERVER_ACTION_PARSE_PATTERN = /\.parse\s*\(/g;
const SERVER_ACTION_SAFEPARSE_PATTERN = /\.safeParse\s*\(/;
const SERVER_ACTION_THROW_NEW_ERROR_PATTERN = /throw\s+new\s+Error\s*\(/;

function listServerActionFiles(rootDir: string): string[] {
  const files: string[] = [];

  function walk(dir: string) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
        continue;
      }

      if (entry.isFile() && fullPath.endsWith(".ts")) {
        files.push(fullPath);
      }
    }
  }

  walk(rootDir);
  return files.sort();
}

function findLineNumber(source: string, index: number): number {
  return source.slice(0, index).split(/\r?\n/).length;
}

function hasAllowlistMarkerNearLine(
  lines: string[],
  zeroBasedLine: number,
): boolean {
  const start = Math.max(0, zeroBasedLine - 2);
  const end = Math.min(lines.length - 1, zeroBasedLine + 1);

  for (let index = start; index <= end; index += 1) {
    if (
      (lines[index] ?? "").includes(SERVER_ACTION_VALIDATION_ALLOWLIST_MARKER)
    ) {
      return true;
    }
  }

  return false;
}

function collectServerActionValidationPolicyViolations(
  source: string,
  fileLabel: string,
): ValidationPolicyViolation[] {
  const lines = source.split(/\r?\n/);
  const offenders: ValidationPolicyViolation[] = [];

  for (const match of source.matchAll(SERVER_ACTION_PARSE_PATTERN)) {
    if (match.index === undefined) {
      continue;
    }

    const line = findLineNumber(source, match.index);
    if (hasAllowlistMarkerNearLine(lines, line - 1)) {
      continue;
    }

    offenders.push({
      file: fileLabel,
      line,
      check: "zod-parse-in-server-action",
      sample: lines[line - 1]?.trim() ?? "",
    });
  }

  for (let index = 0; index < lines.length; index += 1) {
    if (!SERVER_ACTION_SAFEPARSE_PATTERN.test(lines[index] ?? "")) {
      continue;
    }

    const maxLookahead = Math.min(lines.length - 1, index + 6);
    for (let cursor = index + 1; cursor <= maxLookahead; cursor += 1) {
      if (!SERVER_ACTION_THROW_NEW_ERROR_PATTERN.test(lines[cursor] ?? "")) {
        continue;
      }

      if (hasAllowlistMarkerNearLine(lines, cursor)) {
        continue;
      }

      offenders.push({
        file: fileLabel,
        line: cursor + 1,
        check: "safeparse-followed-by-throw-new-error",
        sample: lines[cursor]?.trim() ?? "",
      });
      break;
    }
  }

  return offenders;
}

describe("ADD-009 server-action validation policy", () => {
  it("flags zod parse usage in server-action code", () => {
    const source = [
      "export async function handler() {",
      "  const parsed = QuerySchema.parse(input);",
      "  return parsed;",
      "}",
    ].join("\n");

    const offenders = collectServerActionValidationPolicyViolations(
      source,
      "sample/actions/parse.ts",
    );

    expect(offenders).toEqual([
      {
        file: "sample/actions/parse.ts",
        line: 2,
        check: "zod-parse-in-server-action",
        sample: "const parsed = QuerySchema.parse(input);",
      },
    ]);
  });

  it("flags safeParse flows that still throw new Error", () => {
    const source = [
      "export async function handler() {",
      "  const validated = Schema.safeParse(input);",
      "  if (!validated.success) {",
      '    throw new Error(validated.error.issues[0]?.message ?? "Invalid payload");',
      "  }",
      "  return validated.data;",
      "}",
    ].join("\n");

    const offenders = collectServerActionValidationPolicyViolations(
      source,
      "sample/actions/safeparse-throw.ts",
    );

    expect(offenders).toEqual([
      {
        file: "sample/actions/safeparse-throw.ts",
        line: 4,
        check: "safeparse-followed-by-throw-new-error",
        sample:
          'throw new Error(validated.error.issues[0]?.message ?? "Invalid payload");',
      },
    ]);
  });

  it("allows safeParse flows that use structured action failures", () => {
    const source = [
      "export async function handler() {",
      "  const validated = Schema.safeParse(input);",
      "  if (!validated.success) {",
      '    throwActionFailure(createActionFailure("validation_error", "Invalid payload", 400, validated.error.issues));',
      "  }",
      "  return validated.data;",
      "}",
    ].join("\n");

    const offenders = collectServerActionValidationPolicyViolations(
      source,
      "sample/actions/safeparse-structured.ts",
    );

    expect(offenders).toEqual([]);
  });

  it("reports no ADD-009 policy drift in app/actions", () => {
    const actionsRoot = path.join(process.cwd(), "app", "actions");
    const actionFiles = listServerActionFiles(actionsRoot);

    const offenders = actionFiles.flatMap((filePath) => {
      const source = fs.readFileSync(filePath, "utf8");
      const fileLabel = path
        .relative(process.cwd(), filePath)
        .replace(/\\/g, "/");
      return collectServerActionValidationPolicyViolations(source, fileLabel);
    });

    expect(offenders).toEqual([]);
  });
});
