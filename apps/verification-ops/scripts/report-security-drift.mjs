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

const tsNoCheck = collectMatches(["app", "lib"], /@ts-nocheck/g);

const envBoundaryDrift = collectMatches(
  ["app", "lib", "scripts"],
  /process\.env(?:\.|\[)/g,
  ["lib/infrastructure/env.ts"],
);

const unstructuredLogging = collectMatches(
  ["app", "lib"],
  /console\.(?:log|warn|error|debug)\s*\(/g,
  ["lib/infrastructure/logger.ts", "app/error.tsx", "app/global-error.tsx"],
);

const logSafetyDrift = collectMatches(
  ["app", "lib"],
  /\b(?:userId|clerkId|userEmail|email|phone|nationalId)\s*:/g,
).filter(
  (finding) =>
    /(?:logger|console|log|audit|details|metadata)/i.test(finding.sample) &&
    !/\b(function|class|interface|type)\b/.test(finding.sample),
);

const categories = {
  envBoundaryDrift,
  tsNoCheck,
  unstructuredLogging,
  logSafetyDrift,
};

const summary = {
  envBoundaryDrift: envBoundaryDrift.length,
  tsNoCheck: tsNoCheck.length,
  unstructuredLogging: unstructuredLogging.length,
  logSafetyDrift: logSafetyDrift.length,
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
