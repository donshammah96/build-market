import process from "node:process";
import {
  collectFiles,
  findLineNumber,
  readFile,
  relativeToApp,
} from "./security-check-utils.mjs";

const SCAN_PATHS = [
  "app/lib/api/api-middleware.ts",
  "app/lib/api/cors.ts",
  "app/lib/infrastructure/storage.ts",
  "app/lib/infrastructure/webhook-replay.ts",
  "app/jobs",
  "app/workers",
  "proxy.ts",
];
const DIRECT_ENV_PATTERN = /process\.env(?:\.|\[)/g;

const offenders = [];

for (const filePath of collectFiles(SCAN_PATHS)) {
  const content = readFile(filePath);

  for (const match of content.matchAll(DIRECT_ENV_PATTERN)) {
    if (match.index === undefined) {
      continue;
    }

    offenders.push({
      file: relativeToApp(filePath),
      line: findLineNumber(content, match.index),
    });
  }
}

if (offenders.length > 0) {
  console.error(
    "[security/env-boundary] Direct process.env usage detected in guarded runtime files:",
  );
  for (const offender of offenders) {
    console.error(`  - ${offender.file}:${offender.line}`);
  }
  process.exit(1);
}

console.log(
  "[security/env-boundary] OK: guarded runtime files use the env module.",
);
