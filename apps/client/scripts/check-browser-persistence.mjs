import process from "node:process";
import {
  collectFiles,
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
  /\b(?:window\.)?(?:localStorage|sessionStorage)\.(?:getItem|setItem|removeItem|clear)\b/;
const ALLOWLIST_MARKER = "SECURITY_PERSISTENCE_ALLOWLIST";

const offenders = [];

for (const filePath of collectFiles(SCAN_PATHS)) {
  const content = readFile(filePath);

  if (!STORAGE_PATTERN.test(content)) {
    continue;
  }

  if (!content.includes(ALLOWLIST_MARKER)) {
    offenders.push(relativeToApp(filePath));
  }
}

if (offenders.length > 0) {
  console.error(
    "[security/browser-persistence] Browser storage use in sensitive surfaces requires SECURITY_PERSISTENCE_ALLOWLIST:",
  );
  for (const offender of offenders) {
    console.error(`  - ${offender}`);
  }
  process.exit(1);
}

console.log(
  "[security/browser-persistence] OK: sensitive browser persistence is explicitly allowlisted.",
);
