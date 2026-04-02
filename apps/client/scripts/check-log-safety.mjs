import process from "node:process";
import {
  collectFiles,
  readLines,
  relativeToApp,
} from "./security-check-utils.mjs";

const SCAN_PATHS = [
  "app/lib/api/api-middleware.ts",
  "app/lib/api/professional-portal-handler.ts",
  "app/api/user/profile",
  "app/api/user/consent",
  "app/api/user/export",
  "app/api/user/deletion",
  "app/api/user/rectification",
  "app/api/professional-portal/profile",
  "app/api/onboarding",
  "app/api/uploads",
  "app/api/clerk-webhook/route.ts",
  "app/lib/domains/uploads",
  "app/lib/integrations/clerk/service.ts",
];
const BANNED_LOG_KEYS = [
  "userId",
  "clerkId",
  "userEmail",
  "email",
  "phone",
  "phoneNumber",
  "rawPhone",
  "nationalId",
  "idNumber",
];
const LOGGER_CALL_PATTERN =
  /\b(?:logger|console)\s*\.\s*(?:info|warn|error|debug|log)\s*\(/;
const SPREAD_PROPERTY_PATTERN = /\.\.\.\s*[A-Za-z_$][\w$]*/;

const BANNED_KEY_PATTERNS = BANNED_LOG_KEYS.map((key) => ({
  key,
  explicit: new RegExp(`(?:["'])?${key}(?:["'])?\\s*:`),
  shorthand: new RegExp(`(?:\\{|,)\\s*${key}\\s*(?:,|\\})`),
}));

function findBannedLogKeyInSegment(segment) {
  for (const candidate of BANNED_KEY_PATTERNS) {
    if (candidate.explicit.test(segment) || candidate.shorthand.test(segment)) {
      return candidate.key;
    }
  }
  return null;
}

const offenders = [];
const spreadReviewCandidates = [];

for (const filePath of collectFiles(SCAN_PATHS)) {
  const lines = readLines(filePath);

  for (let index = 0; index < lines.length; index += 1) {
    if (!LOGGER_CALL_PATTERN.test(lines[index])) {
      continue;
    }

    const windowLines = [lines[index]];
    let cursor = index + 1;
    while (cursor < lines.length && cursor <= index + 12) {
      windowLines.push(lines[cursor]);
      if (lines[cursor].includes(");")) {
        break;
      }
      cursor += 1;
    }

    const segment = windowLines.join("\n");
    if (SPREAD_PROPERTY_PATTERN.test(segment)) {
      spreadReviewCandidates.push({
        file: relativeToApp(filePath),
        line: index + 1,
      });
    }

    const bannedKey = findBannedLogKeyInSegment(segment);
    if (!bannedKey) {
      continue;
    }

    offenders.push({
      file: relativeToApp(filePath),
      line: index + 1,
      key: bannedKey,
    });
  }
}

if (offenders.length > 0) {
  console.error("[security/log-safety] Banned log metadata keys detected:");
  for (const offender of offenders) {
    console.error(
      `  - ${offender.file}:${offender.line} includes log field "${offender.key}"`,
    );
  }
  process.exit(1);
}

if (spreadReviewCandidates.length > 0) {
  console.warn(
    `[security/log-safety] Manual review recommended: ${spreadReviewCandidates.length} logger call(s) include spread metadata, which cannot be fully key-scanned.`,
  );
  for (const candidate of spreadReviewCandidates) {
    console.warn(
      `  - ${candidate.file}:${candidate.line} uses spread metadata (review for banned identity keys)`,
    );
  }
}

console.log(
  "[security/log-safety] OK: no banned identity fields found in structured log calls.",
);
