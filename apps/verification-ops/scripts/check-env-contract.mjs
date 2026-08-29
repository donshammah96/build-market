import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const appRoot = process.cwd();
const envBoundaryPath = path.join(appRoot, "lib/infrastructure/env.ts");

function readText(filePath) {
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : "";
}

function parseEnvKeys(filePath) {
  const keys = new Set();
  for (const line of readText(filePath).split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)=/);
    if (match) {
      keys.add(match[1]);
    }
  }
  return keys;
}

function collectBoundaryKeys() {
  const content = readText(envBoundaryPath);
  const keys = new Set();
  for (const match of content.matchAll(/^\s*{ name: "([A-Z0-9_]+)"/gm)) {
    keys.add(match[1]);
  }
  return keys;
}

const boundaryKeys = collectBoundaryKeys();
const templates = [".env.example", ".env.test"];
const missingByTemplate = Object.fromEntries(
  templates.map((template) => {
    const keys = parseEnvKeys(path.join(appRoot, template));
    return [template, [...boundaryKeys].filter((key) => !keys.has(key)).sort()];
  }),
);

const report = {
  boundaryKeyCount: boundaryKeys.size,
  templates: Object.fromEntries(
    templates.map((template) => [
      template,
      parseEnvKeys(path.join(appRoot, template)).size,
    ]),
  ),
  missingByTemplate,
};

console.log(JSON.stringify(report, null, 2));

if (Object.values(missingByTemplate).some((missing) => missing.length > 0)) {
  process.exitCode = 1;
}
