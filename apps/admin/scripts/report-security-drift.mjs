import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const appRoot = process.cwd();
const strict = process.argv.includes("--strict");
const scanExtensions = new Set([".ts", ".tsx", ".js", ".mjs"]);
const ignoredDirs = new Set(["node_modules", ".next", "coverage", "dist"]);

function walk(relativePath, files = []) {
  const target = path.join(appRoot, relativePath);
  if (!fs.existsSync(target)) return files;

  const stat = fs.statSync(target);
  if (stat.isFile()) {
    if (scanExtensions.has(path.extname(target))) files.push(target);
    return files;
  }

  for (const entry of fs.readdirSync(target, { withFileTypes: true })) {
    if (!ignoredDirs.has(entry.name)) {
      walk(path.join(relativePath, entry.name), files);
    }
  }
  return files;
}

function relative(filePath) {
  return path.relative(appRoot, filePath).replace(/\\/g, "/");
}

function read(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function lineNumber(content, index) {
  return content.slice(0, index).split(/\r?\n/).length;
}

function collectMatches(paths, pattern, ignore = []) {
  const findings = [];
  for (const file of paths.flatMap((target) => walk(target))) {
    const rel = relative(file);
    if (ignore.includes(rel)) continue;

    const content = read(file);
    const lines = content.split(/\r?\n/);
    for (const match of content.matchAll(pattern)) {
      const line = lineNumber(content, match.index ?? 0);
      const sample = lines[line - 1]?.trim() ?? "";
      if (sample.includes("bootstrap-only:")) continue;
      findings.push({
        file: rel,
        line,
        sample,
      });
    }
  }
  return findings;
}

function uniqueFiles(findings) {
  return [...new Set(findings.map((finding) => finding.file))].sort();
}

const actionFiles = walk("src/actions/admin")
  .map(relative)
  .filter(
    (file) =>
      !file.includes("__tests__/") &&
      !file.startsWith("src/actions/admin/_core/") &&
      !file.endsWith("route.ts") &&
      !file.endsWith("shared.ts") &&
      !file.endsWith("types.ts") &&
      !file.endsWith("idempotency.ts"),
  );

const directPrismaInActions = collectMatches(
  ["src/actions/admin"],
  /\bprisma\./g,
).filter((finding) => !finding.file.includes("__tests__/"));

const zodParseDrift = collectMatches(
  ["src/actions/admin"],
  /\.parse\s*\(/g,
).filter((finding) => !finding.sample.includes("JSON.parse"));

const tsNoCheck = collectMatches(["src"], /@ts-nocheck/g);

const adminEnvBoundaryDrift = collectMatches(
  ["src", "scripts"],
  /process\.env(?:\.|\[)/g,
  ["src/lib/infrastructure/env.ts"],
);

const unstructuredLogging = collectMatches(
  ["src/actions", "src/lib"],
  /console\.(?:log|warn|error|debug)\s*\(/g,
  [
    "src/lib/infrastructure/logger.ts",
    "src/lib/infrastructure/sms.ts",
    "src/lib/auth-sync.ts",
  ],
);

const logSafetyDrift = collectMatches(
  ["src/actions", "src/lib"],
  /\b(?:userId|clerkId|userEmail|email|phone|nationalId)\s*:/g,
).filter(
  (finding) =>
    /(?:logger|console|log|audit|details|metadata)/i.test(finding.sample) &&
    !/\b(function|class|interface|type)\b/.test(finding.sample),
);

const unsafeMutations = actionFiles
  .filter((file) => {
    const content = read(path.join(appRoot, file));
    const exportsAction = /export\s+(?:async\s+function|const)\s+\w+/.test(
      content,
    );
    return exportsAction && !content.includes("safeAction(");
  })
  .map((file) => ({ file, line: 1, sample: "export without safeAction(" }));

const missingAuditLog = actionFiles
  .filter((file) =>
    /(delete|remove|verify|reject|approve|export|role)/i.test(file),
  )
  .filter((file) => {
    const content = read(path.join(appRoot, file));
    return (
      !content.includes("logAdminAction") && !/\bauditLog\s*:/.test(content)
    );
  })
  .map((file) => ({
    file,
    line: 1,
    sample: "high-risk action file without audit coverage",
  }));

const categories = {
  adminEnvBoundaryDrift,
  directPrismaInActions,
  unsafeMutations,
  zodParseDrift,
  tsNoCheck,
  unstructuredLogging,
  logSafetyDrift,
  missingAuditLog,
};

const summary = {
  adminEnvBoundaryDrift: adminEnvBoundaryDrift.length,
  directPrismaInActions: uniqueFiles(directPrismaInActions).length,
  unsafeMutations: unsafeMutations.length,
  zodParseDrift: zodParseDrift.length,
  tsNoCheck: tsNoCheck.length,
  unstructuredLogging: unstructuredLogging.length,
  logSafetyDrift: logSafetyDrift.length,
  missingAuditLog: missingAuditLog.length,
};

console.log(
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      strict,
      summary,
      categories,
    },
    null,
    2,
  ),
);

if (strict && Object.values(summary).some((count) => count > 0)) {
  process.exitCode = 1;
}
