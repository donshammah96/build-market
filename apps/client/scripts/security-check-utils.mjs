import fs from "node:fs";
import path from "node:path";
import process from "node:process";

export const APP_ROOT = process.cwd();
export const DEFAULT_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".mjs"]);
const IGNORED_DIRS = new Set([
  "node_modules",
  ".next",
  "coverage",
  "dist",
  "build",
  "__tests__",
]);

function walkFiles(targetPath, acc, extensions) {
  if (!fs.existsSync(targetPath)) {
    return;
  }

  const stat = fs.statSync(targetPath);
  if (stat.isFile()) {
    if (extensions.has(path.extname(targetPath))) {
      acc.push(targetPath);
    }
    return;
  }

  const entries = fs.readdirSync(targetPath, { withFileTypes: true });
  for (const entry of entries) {
    if (IGNORED_DIRS.has(entry.name)) {
      continue;
    }

    walkFiles(path.join(targetPath, entry.name), acc, extensions);
  }
}

export function collectFiles(relativePaths, extensions = DEFAULT_EXTENSIONS) {
  const files = [];
  for (const relativePath of relativePaths) {
    walkFiles(path.join(APP_ROOT, relativePath), files, extensions);
  }
  return files.sort();
}

export function relativeToApp(filePath) {
  return path.relative(APP_ROOT, filePath).replace(/\\/g, "/");
}

export function readFile(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

export function readLines(filePath) {
  return readFile(filePath).split(/\r?\n/);
}

export function findLineNumber(content, matchIndex) {
  return content.slice(0, matchIndex).split(/\r?\n/).length;
}
