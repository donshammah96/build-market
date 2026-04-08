import {
  collectFiles,
  findLineNumber,
  readFile,
  relativeToApp,
} from "./security-check-utils.mjs";

const MUTATION_SCHEMA_SCAN_PATHS = [
  "app/api",
  "app/actions",
  "app/lib/domains",
  "lib/services",
];

const API_ERROR_SCAN_PATHS = ["app/api", "app/actions", "app/lib/api"];
const GET_HANDLER_SCAN_PATHS = ["app/api"];
const DANGEROUS_HTML_SCAN_PATHS = ["app", "components", "hooks", "lib"];
const PERSISTENCE_SCAN_PATHS = ["app", "components", "hooks", "lib"];

const ZOD_PASSTHROUGH_PATTERN = /\.passthrough\(\)/g;
const UNSAFE_CLIENT_MESSAGE_PATTERNS = [
  {
    pattern:
      /\bapiError\s*\(\s*error\.(message|stack)\s*(?:(?:\|\||\?\?)\s*[^,)]*)?(?:,|\))/g,
    kind: "apiError",
  },
  {
    pattern:
      /\bcreateActionFailure\s*\(\s*[^,\n]+,\s*error\.(message|stack)\s*(?:(?:\|\||\?\?)\s*[^,)]*)?(?:,|\))/g,
    kind: "createActionFailure",
  },
];
const EXPORTED_GET_PATTERN =
  /export\s+(?:const\s+GET\s*=\s*|async\s+function\s+GET\s*\(|function\s+GET\s*\()/g;
const REQ_JSON_PATTERN = /\b(?:req|request)\s*\.\s*json\s*\(/g;
const DANGEROUS_HTML_PATTERN = /\bdangerouslySetInnerHTML\b/g;
const STORAGE_WRITE_PATTERN =
  /\b(?:window\.)?(?:localStorage|sessionStorage)\.(?:setItem|removeItem|clear)\b/g;

const PASSTHROUGH_ALLOWLIST_MARKER = "SECURITY_ZOD_PASSTHROUGH_ALLOWLIST";
const GET_JSON_ALLOWLIST_MARKER = "SECURITY_GET_JSON_ALLOWLIST";
const XSS_ALLOWLIST_MARKER = "SECURITY_XSS_ALLOWLIST";
const PERSISTENCE_ALLOWLIST_MARKER = "SECURITY_PERSISTENCE_ALLOWLIST";

const SENSITIVE_STORAGE_FLOW_PATTERN =
  /(?:onboarding|profile|payment|finance|checkout|escrow)/i;

function hasAllowlistMarkerNearLine(lines, lineNumber, marker) {
  const start = Math.max(0, lineNumber - 3);
  const end = Math.min(lines.length - 1, lineNumber + 1);

  for (let index = start; index <= end; index += 1) {
    if ((lines[index] ?? "").includes(marker)) {
      return true;
    }
  }

  return false;
}

function hasSanitizerOrReviewHint(lines, lineNumber) {
  const start = Math.max(0, lineNumber - 3);
  const end = Math.min(lines.length - 1, lineNumber + 1);
  const context = lines
    .slice(start, end + 1)
    .join(" ")
    .toLowerCase();

  return (
    context.includes("sanitize") ||
    context.includes("sanitizer") ||
    context.includes("review")
  );
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

export function collectMutationPassthroughDrift() {
  const offenders = [];

  for (const filePath of collectFiles(MUTATION_SCHEMA_SCAN_PATHS)) {
    const content = readFile(filePath);
    const lines = content.split(/\r?\n/);
    const relativePath = relativeToApp(filePath);

    for (const match of content.matchAll(ZOD_PASSTHROUGH_PATTERN)) {
      if (match.index === undefined) {
        continue;
      }

      const line = findLineNumber(content, match.index);
      if (
        hasAllowlistMarkerNearLine(lines, line, PASSTHROUGH_ALLOWLIST_MARKER)
      ) {
        continue;
      }

      offenders.push({
        file: relativePath,
        line,
        sample: lines[line - 1]?.trim() ?? "",
      });
    }
  }

  return offenders;
}

export function collectUnsafeApiErrorDrift() {
  const offenders = [];

  for (const filePath of collectFiles(API_ERROR_SCAN_PATHS)) {
    const content = readFile(filePath);
    if (
      !content.includes("apiError") &&
      !content.includes("createActionFailure")
    ) {
      continue;
    }

    const lines = content.split(/\r?\n/);
    const relativePath = relativeToApp(filePath);

    for (const { pattern, kind } of UNSAFE_CLIENT_MESSAGE_PATTERNS) {
      for (const match of content.matchAll(pattern)) {
        if (match.index === undefined) {
          continue;
        }

        const line = findLineNumber(content, match.index);
        offenders.push({
          file: relativePath,
          line,
          sample: lines[line - 1]?.trim() ?? "",
          source: `${kind}: error.${match[1]}`,
        });
      }
    }
  }

  return offenders;
}

export function collectGetJsonInGetHandlerDrift() {
  const offenders = [];

  for (const filePath of collectFiles(GET_HANDLER_SCAN_PATHS)) {
    const content = readFile(filePath);
    const lines = content.split(/\r?\n/);
    const relativePath = relativeToApp(filePath);

    for (const getMatch of content.matchAll(EXPORTED_GET_PATTERN)) {
      if (getMatch.index === undefined) {
        continue;
      }

      const blockRange = findBalancedBlockRange(
        content,
        getMatch.index + getMatch[0].length,
      );
      if (!blockRange) {
        continue;
      }

      const handlerSource = content.slice(blockRange.start, blockRange.end + 1);
      for (const reqJsonMatch of handlerSource.matchAll(REQ_JSON_PATTERN)) {
        if (reqJsonMatch.index === undefined) {
          continue;
        }

        const absoluteIndex = blockRange.start + reqJsonMatch.index;
        const line = findLineNumber(content, absoluteIndex);

        if (
          hasAllowlistMarkerNearLine(lines, line, GET_JSON_ALLOWLIST_MARKER)
        ) {
          continue;
        }

        offenders.push({
          file: relativePath,
          line,
          sample: lines[line - 1]?.trim() ?? "",
        });
      }
    }
  }

  return offenders;
}

export function collectDangerousHtmlDrift() {
  const offenders = [];

  for (const filePath of collectFiles(DANGEROUS_HTML_SCAN_PATHS)) {
    const content = readFile(filePath);
    if (!content.includes("dangerouslySetInnerHTML")) {
      continue;
    }

    const lines = content.split(/\r?\n/);
    const relativePath = relativeToApp(filePath);

    for (const match of content.matchAll(DANGEROUS_HTML_PATTERN)) {
      if (match.index === undefined) {
        continue;
      }

      const line = findLineNumber(content, match.index);
      if (hasAllowlistMarkerNearLine(lines, line, XSS_ALLOWLIST_MARKER)) {
        continue;
      }

      if (hasSanitizerOrReviewHint(lines, line)) {
        continue;
      }

      offenders.push({
        file: relativePath,
        line,
        sample: lines[line - 1]?.trim() ?? "",
      });
    }
  }

  return offenders;
}

export function collectSensitiveStorageWriteDrift() {
  const offenders = [];

  for (const filePath of collectFiles(PERSISTENCE_SCAN_PATHS)) {
    const content = readFile(filePath);
    if (
      !content.includes("localStorage") &&
      !content.includes("sessionStorage")
    ) {
      continue;
    }

    const relativePath = relativeToApp(filePath);
    if (!SENSITIVE_STORAGE_FLOW_PATTERN.test(relativePath)) {
      continue;
    }

    if (content.includes(PERSISTENCE_ALLOWLIST_MARKER)) {
      continue;
    }

    const lines = content.split(/\r?\n/);

    for (const match of content.matchAll(STORAGE_WRITE_PATTERN)) {
      if (match.index === undefined) {
        continue;
      }

      const line = findLineNumber(content, match.index);
      offenders.push({
        file: relativePath,
        line,
        sample: lines[line - 1]?.trim() ?? "",
      });
    }
  }

  return offenders;
}
