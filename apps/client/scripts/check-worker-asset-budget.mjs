import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const APP_ROOT = process.cwd();
const targetArg = process.argv[2] ?? ".open-next/assets";
const targetDir = path.resolve(APP_ROOT, targetArg);

const MAX_BYTES = Number.parseInt(
  process.env.WORKERS_MAX_ASSET_BYTES ?? `${25 * 1024 * 1024}`,
  10,
);
const WARN_BYTES = Number.parseInt(
  process.env.WORKERS_WARN_ASSET_BYTES ?? `${20 * 1024 * 1024}`,
  10,
);

function walkFiles(dirPath, acc) {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      walkFiles(fullPath, acc);
      continue;
    }

    if (entry.isFile()) {
      const stat = fs.statSync(fullPath);
      acc.push({
        fullPath,
        relativePath: path.relative(APP_ROOT, fullPath).replace(/\\/g, "/"),
        bytes: stat.size,
      });
    }
  }
}

function toMiB(bytes) {
  return (bytes / (1024 * 1024)).toFixed(2);
}

function main() {
  if (!fs.existsSync(targetDir)) {
    console.error(
      `[worker-asset-budget] Directory not found: ${path.relative(APP_ROOT, targetDir).replace(/\\/g, "/")}`,
    );
    process.exit(1);
  }

  const files = [];
  walkFiles(targetDir, files);

  if (files.length === 0) {
    console.log("[worker-asset-budget] OK: no files found to validate.");
    return;
  }

  files.sort((a, b) => b.bytes - a.bytes);

  const offenders = files.filter((file) => file.bytes > MAX_BYTES);
  const warnings = files.filter(
    (file) => file.bytes > WARN_BYTES && file.bytes <= MAX_BYTES,
  );

  const topLargest = files.slice(0, 10);
  console.log(
    `[worker-asset-budget] Checked ${files.length} files in ${path.relative(APP_ROOT, targetDir).replace(/\\/g, "/")}`,
  );
  console.log("[worker-asset-budget] Top largest files:");
  for (const file of topLargest) {
    console.log(`  - ${file.relativePath} (${toMiB(file.bytes)} MiB)`);
  }

  if (warnings.length > 0) {
    console.warn(
      `[worker-asset-budget] Warning: ${warnings.length} files exceed warning threshold (${toMiB(WARN_BYTES)} MiB).`,
    );
  }

  if (offenders.length > 0) {
    console.error(
      `[worker-asset-budget] Error: ${offenders.length} files exceed Cloudflare Workers hard cap (${toMiB(MAX_BYTES)} MiB).`,
    );
    for (const file of offenders) {
      console.error(`  - ${file.relativePath} (${toMiB(file.bytes)} MiB)`);
    }
    process.exit(1);
  }

  console.log(
    `[worker-asset-budget] OK: all files are <= ${toMiB(MAX_BYTES)} MiB.`,
  );
}

main();
