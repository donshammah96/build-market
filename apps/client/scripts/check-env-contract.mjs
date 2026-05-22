import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const APP_ROOT = process.cwd();
const ENV_EXAMPLE_PATH = path.join(APP_ROOT, ".env.example");

const SCAN_PATHS = [
  path.join(APP_ROOT, "app"),
  path.join(APP_ROOT, "lib"),
  path.join(APP_ROOT, "hooks"),
  path.join(APP_ROOT, "proxy.ts"),
  path.join(APP_ROOT, "next.config.ts"),
];

const FILE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".mjs"]);

const ALLOWED_UNDECLARED = new Set([
  "NODE_ENV",
  "CI",
  "NEXT_PHASE",
  "NEXT_RUNTIME",
]);

const HIGH_RISK_UNUSED_KEY_PATTERNS = [
  /SECRET/,
  /TOKEN/,
  /PASSWORD/,
  /PRIVATE/,
  /ENCRYPTION/,
  /API_KEY/,
  /ACCESS_KEY/,
  /CLIENT_SECRET/,
  /WEBHOOK_SECRET/,
  /^POSTGRES_URL$/,
  /^DATABASE_URL$/,
  /^REDIS_URL$/,
  /^REDIS_PASSWORD$/,
  /^NATS_(TOKEN|PASS|PASSWORD|USER_CREDS|CREDENTIALS)$/,
  /^CLERK_SECRET_KEY$/,
];

function walkFiles(targetPath, acc) {
  if (!fs.existsSync(targetPath)) {
    return;
  }

  const stat = fs.statSync(targetPath);
  if (stat.isFile()) {
    if (FILE_EXTENSIONS.has(path.extname(targetPath))) {
      acc.push(targetPath);
    }
    return;
  }

  const entries = fs.readdirSync(targetPath, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === "node_modules" || entry.name === ".next") {
      continue;
    }

    walkFiles(path.join(targetPath, entry.name), acc);
  }
}

function extractProcessEnvKeys(content) {
  const keys = new Set();

  const dotRegex = /process\.env\.([A-Z][A-Z0-9_]*)/g;
  for (const match of content.matchAll(dotRegex)) {
    keys.add(match[1]);
  }

  const bracketRegex = /process\.env\[(?:"|')([A-Z][A-Z0-9_]*)(?:"|')\]/g;
  for (const match of content.matchAll(bracketRegex)) {
    keys.add(match[1]);
  }

  return keys;
}

function extractEnvDefinitionKeys(content) {
  const keys = new Set();
  const envDefRegex = /name:\s*["']([A-Z][A-Z0-9_]*)["']/g;

  for (const match of content.matchAll(envDefRegex)) {
    keys.add(match[1]);
  }

  return keys;
}

function parseEnvTemplateKeys(content) {
  const keys = new Set();
  const lines = content.split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const match = trimmed.match(/^([A-Z][A-Z0-9_]*)\s*=/);
    if (match) {
      keys.add(match[1]);
    }
  }

  return keys;
}

function relativeToApp(filePath) {
  return path.relative(APP_ROOT, filePath).replace(/\\/g, "/");
}

function isHighRiskUnusedKey(key) {
  return HIGH_RISK_UNUSED_KEY_PATTERNS.some((pattern) => pattern.test(key));
}

function main() {
  if (!fs.existsSync(ENV_EXAMPLE_PATH)) {
    console.error("[env-contract] Missing .env.example file.");
    process.exit(1);
  }

  const files = [];
  for (const scanPath of SCAN_PATHS) {
    walkFiles(scanPath, files);
  }

  const usageByKey = new Map();

  for (const filePath of files) {
    const content = fs.readFileSync(filePath, "utf8");
    const processEnvKeys = extractProcessEnvKeys(content);
    const envDefinitionKeys = extractEnvDefinitionKeys(content);
    const keys = new Set([...processEnvKeys, ...envDefinitionKeys]);

    for (const key of keys) {
      if (!usageByKey.has(key)) {
        usageByKey.set(key, new Set());
      }
      usageByKey.get(key).add(relativeToApp(filePath));
    }
  }

  const usedKeys = new Set(usageByKey.keys());
  const envTemplateKeys = parseEnvTemplateKeys(
    fs.readFileSync(ENV_EXAMPLE_PATH, "utf8"),
  );

  const missingKeys = [...usedKeys]
    .filter((key) => !envTemplateKeys.has(key) && !ALLOWED_UNDECLARED.has(key))
    .sort();

  const unusedTemplateKeys = [...envTemplateKeys]
    .filter((key) => !usedKeys.has(key))
    .sort();

  const highRiskUnusedTemplateKeys = unusedTemplateKeys.filter((key) =>
    isHighRiskUnusedKey(key),
  );

  const lowRiskUnusedTemplateKeys = unusedTemplateKeys.filter(
    (key) => !isHighRiskUnusedKey(key),
  );

  if (missingKeys.length > 0) {
    console.error("[env-contract] Missing keys in .env.example:");
    for (const key of missingKeys) {
      const refs = [...usageByKey.get(key)].sort();
      console.error(`  - ${key}`);
      for (const ref of refs.slice(0, 5)) {
        console.error(`      used in: ${ref}`);
      }
      if (refs.length > 5) {
        console.error(`      ...and ${refs.length - 5} more`);
      }
    }
    process.exit(1);
  }

  if (highRiskUnusedTemplateKeys.length > 0) {
    console.error(
      "[env-contract] High-risk unused keys detected in .env.example:",
    );
    for (const key of highRiskUnusedTemplateKeys) {
      console.error(`  - ${key}`);
    }
    console.error(
      "[env-contract] Remove stale sensitive keys or add runtime usage before merging.",
    );
    process.exit(1);
  }

  console.log("[env-contract] OK: .env.example covers all process.env keys.");

  if (lowRiskUnusedTemplateKeys.length > 0) {
    console.log(
      `[env-contract] Note: ${lowRiskUnusedTemplateKeys.length} low-risk template keys are currently unused in scanned runtime paths.`,
    );
  }
}

main();
