#!/usr/bin/env node

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const scriptRoot = join(fileURLToPath(new URL("..", import.meta.url)));
const requiredStatusFields = [
  "Status:",
  "Scope:",
  "Evidence date:",
  "Git SHA:",
  "Environment:",
  "Commands and results:",
  "Owner:",
  "Known exclusions:",
  "Next review:",
];
const scorecardAreas = [
  "Supply",
  "Responsiveness",
  "Verification",
  "Lead experience",
  "Safety",
  "Payments",
  "Resilience",
  "Compliance",
];

function parseRoot(argv) {
  const rootIndex = argv.indexOf("--root");
  return rootIndex === -1 ? scriptRoot : argv[rootIndex + 1];
}

function toRepoPath(root, path) {
  return relative(root, path).replaceAll("\\", "/");
}

function readText(path, findings, root) {
  if (!existsSync(path)) {
    findings.push(`${toRepoPath(root, path)}: file is required but missing`);
    return "";
  }
  return readFileSync(path, "utf8");
}

function findFiles(directory, predicate) {
  if (!existsSync(directory)) return [];
  const files = [];
  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) {
      if (entry === "node_modules" || entry === ".git" || entry === ".next") {
        continue;
      }
      files.push(...findFiles(path, predicate));
    } else if (predicate(path)) {
      files.push(path);
    }
  }
  return files;
}

function checkAdrMetadata(root, findings, app, prefix, lastNumber) {
  const directory = join(root, "apps", app, "docs", "adr");
  const files = findFiles(directory, (path) => path.endsWith(".md"));

  for (let number = 1; number <= lastNumber; number += 1) {
    const id = `${prefix}-${String(number).padStart(3, "0")}`;
    const path = files.find((candidate) => candidate.split(/[\\/]/).at(-1).startsWith(id));
    if (!path) {
      findings.push(`${toRepoPath(root, directory)}: missing ${id}`);
      continue;
    }
    const content = readText(path, findings, root);
    for (const field of ["Status:", "Owner:", "Next review:"]) {
      if (!new RegExp(`(^|\\n)${field.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")}`, "i").test(content)) {
        findings.push(`${toRepoPath(root, path)}: missing ${field.slice(0, -1)}`);
      }
    }
  }
}

function checkAdrIndexes(root, findings) {
  const requirements = [
    ["README.md", ["ADR-010", "ADR-ADMIN-016"]],
    [".agent/DOCUMENT-HIERARCHY.md", ["ADR-010", "ADR-ADMIN-016"]],
    [".agent/ADMIN-ARCHITECTURE.md", ["ADR-ADMIN-016"]],
  ];
  for (const [path, ids] of requirements) {
    const content = readText(join(root, path), findings, root);
    for (const id of ids) {
      if (!content.includes(id)) {
        findings.push(`${path}: missing current ADR index entry ${id}`);
      }
    }
  }
}

function checkStatusPages(root, findings) {
  for (const app of ["client", "admin", "verification-ops", "workers"]) {
    const path = join(root, "apps", app, "docs", "STATUS.md");
    const content = readText(path, findings, root);
    for (const field of requiredStatusFields) {
      if (!new RegExp(`(^|\\n)${field.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")}`, "i").test(content)) {
        findings.push(`${toRepoPath(root, path)}: missing ${field.slice(0, -1)}`);
      }
    }
  }
}

function checkScorecard(root, findings) {
  const path = join(root, "docs", "launch", "GO_NO_GO.md");
  const content = readText(path, findings, root);
  for (const area of scorecardAreas) {
    const line = content.split(/\r?\n/).find((candidate) => candidate.includes(`| ${area} |`));
    if (!line || !/ADR-/i.test(line) || !/Control:/i.test(line)) {
      findings.push(`docs/launch/GO_NO_GO.md: ${area} must name ADR and Control evidence`);
    }
  }
}

function checkWorkerOperations(root, findings) {
  const readmePath = join(root, "apps", "workers", "README.md");
  const content = readText(readmePath, findings, root);
  if (!content.includes("QUEUE_RECOVERY_RUNBOOK.md")) {
    findings.push("apps/workers/README.md: missing queue recovery runbook link");
  }
  for (const dependency of ["liveness", "readiness", "Redis", "PostgreSQL", "BullMQ", "NATS"]) {
    if (!content.toLowerCase().includes(dependency.toLowerCase())) {
      findings.push(`apps/workers/README.md: missing health semantics for ${dependency}`);
    }
  }
  readText(join(root, "apps", "workers", "docs", "QUEUE_RECOVERY_RUNBOOK.md"), findings, root);
}

function checkNodeRuntime(root, findings) {
  const nvmrc = readText(join(root, ".nvmrc"), findings, root).trim();
  if (nvmrc !== "24") {
    findings.push(`.nvmrc: expected Node 24, found ${nvmrc || "empty"}`);
  }

  const manifestPaths = [join(root, "package.json")];
  for (const group of ["apps", "packages"]) {
    const directory = join(root, group);
    if (!existsSync(directory)) continue;
    for (const entry of readdirSync(directory)) {
      const path = join(directory, entry, "package.json");
      if (existsSync(path)) manifestPaths.push(path);
    }
  }
  for (const path of manifestPaths) {
    const manifest = JSON.parse(readText(path, findings, root));
    if (manifest.engines?.node && manifest.engines.node !== "24.x") {
      findings.push(`${toRepoPath(root, path)}: engines.node must be 24.x`);
    }
  }

  for (const path of findFiles(join(root, "apps"), (candidate) => candidate.endsWith("Dockerfile"))) {
    const content = readText(path, findings, root);
    if (/^FROM\s+node:(?!24(?:[-.:]|$))/im.test(content)) {
      findings.push(`${toRepoPath(root, path)}: active Docker base must use Node 24`);
    }
  }

  const workflowDirectory = join(root, ".github", "workflows");
  for (const path of findFiles(workflowDirectory, (candidate) => candidate.endsWith(".yml"))) {
    const content = readText(path, findings, root);
    if (/node-version:\s*["']?20(?:\.x)?["']?/i.test(content)) {
      findings.push(`${toRepoPath(root, path)}: active workflow must use Node 24`);
    }
  }
}

const root = parseRoot(process.argv.slice(2));
const findings = [];

checkAdrMetadata(root, findings, "client", "ADR", 10);
checkAdrMetadata(root, findings, "admin", "ADR-ADMIN", 16);
checkAdrIndexes(root, findings);
checkStatusPages(root, findings);
checkScorecard(root, findings);
checkWorkerOperations(root, findings);
checkNodeRuntime(root, findings);

if (findings.length > 0) {
  console.error("Launch documentation governance violations:\n");
  for (const finding of findings) console.error(`- ${finding}`);
  process.exitCode = 1;
} else {
  console.log("launch documentation governance: OK");
}
