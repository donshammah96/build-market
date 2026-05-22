import process from "node:process";
import {
  collectFiles,
  findLineNumber,
  readFile,
  relativeToApp,
} from "./security-check-utils.mjs";

const SHARED_CORS_HELPER = "app/lib/api/cors.ts";
const HEADER_SCAN_PATHS = ["app", "components", "hooks", "lib", "proxy.ts"];
const OPTIONS_SCAN_PATHS = ["app/api"];
const CORS_HEADER_PATTERN = /Access-Control-Allow-[A-Za-z-]+/g;
const OPTIONS_EXPORT_PATTERN =
  /export\s+(?:const|async\s+function|function)\s+OPTIONS\b/g;

const headerOffenders = [];
const optionsOffenders = [];

for (const filePath of collectFiles(HEADER_SCAN_PATHS)) {
  const relativePath = relativeToApp(filePath);
  if (relativePath === SHARED_CORS_HELPER) {
    continue;
  }

  const content = readFile(filePath);
  for (const match of content.matchAll(CORS_HEADER_PATTERN)) {
    if (match.index === undefined) {
      continue;
    }

    headerOffenders.push({
      file: relativePath,
      line: findLineNumber(content, match.index),
      header: match[0],
    });
  }
}

for (const filePath of collectFiles(OPTIONS_SCAN_PATHS)) {
  const content = readFile(filePath);
  const hasOptionsExport = OPTIONS_EXPORT_PATTERN.test(content);
  OPTIONS_EXPORT_PATTERN.lastIndex = 0;

  if (!hasOptionsExport) {
    continue;
  }

  const usesSharedHelper =
    content.includes("createCorsPreflightHandler") ||
    content.includes("handleCorsPreFlight");

  if (!usesSharedHelper) {
    optionsOffenders.push(relativeToApp(filePath));
  }
}

if (headerOffenders.length > 0 || optionsOffenders.length > 0) {
  console.error("[security/cors-policy] Ad hoc CORS policy drift detected.");

  for (const offender of headerOffenders) {
    console.error(
      `  - ${offender.file}:${offender.line} sets ${offender.header} outside the shared CORS helper`,
    );
  }

  for (const offender of optionsOffenders) {
    console.error(
      `  - ${offender} exports OPTIONS without using createCorsPreflightHandler()/handleCorsPreFlight()`,
    );
  }

  process.exit(1);
}

console.log(
  "[security/cors-policy] OK: CORS headers and OPTIONS handlers stay on the shared helper path.",
);
