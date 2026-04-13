import process from "node:process";
import {
  collectFiles,
  findLineNumber,
  relativeToApp,
  readFile,
} from "./security-check-utils.mjs";

const SCAN_PATHS = [
  "components/forms",
  "components/shared",
  "components/providers",
  "components/professional",
  "app/onboarding",
];
const STORAGE_PATTERN =
  /\b(?:window\.)?(?:localStorage|sessionStorage)\.(?:getItem|setItem|removeItem|clear)\b/g;
const ALLOWLIST_MARKER = "SECURITY_PERSISTENCE_ALLOWLIST";

const offenders = [];

function hasAllowlistMarkerNearLine(lines, lineNumber) {
  const start = Math.max(0, lineNumber - 3);
  const end = Math.min(lines.length - 1, lineNumber + 1);

  for (let index = start; index <= end; index += 1) {
    if ((lines[index] ?? "").includes(ALLOWLIST_MARKER)) {
      return true;
    }
  }

  return false;
}

for (const filePath of collectFiles(SCAN_PATHS)) {
  const content = readFile(filePath);

  const storageMatches = [...content.matchAll(STORAGE_PATTERN)];
  if (storageMatches.length === 0) {
    continue;
  }

  const lines = content.split(/\r?\n/);
  const relativePath = relativeToApp(filePath);
  for (const match of storageMatches) {
    if (match.index === undefined) {
      continue;
    }

    const line = findLineNumber(content, match.index);
    if (hasAllowlistMarkerNearLine(lines, line)) {
      continue;
    }

    offenders.push({
      file: relativePath,
      line,
      sample: lines[line - 1]?.trim() ?? "",
    });
  }
}

if (offenders.length > 0) {
  console.error(
    "[security/browser-persistence] Browser storage use in sensitive surfaces requires callsite SECURITY_PERSISTENCE_ALLOWLIST markers:",
  );
  for (const offender of offenders) {
    console.error(
      `  - ${offender.file}:${offender.line} -> ${offender.sample}`,
    );
  }
  process.exit(1);
}

console.log(
  "[security/browser-persistence] OK: sensitive browser persistence is explicitly allowlisted.",
);
