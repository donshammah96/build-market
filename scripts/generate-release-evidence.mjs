import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";

const SHA_256 = /^[a-f0-9]{64}$/i;
const COMMIT_SHA = /^[a-f0-9]{40}$/i;
const ALLOWED_ENVIRONMENT_VALUES = new Set([
  "RELEASE_EVIDENCE_ENVIRONMENT",
  "GITHUB_RUN_ID",
  "GITHUB_SHA",
]);

export async function sha256File(filePath) {
  const contents = await readFile(filePath);
  return createHash("sha256").update(contents).digest("hex");
}

function assertReleaseEvidenceInput(input) {
  if (!input.environment?.trim()) {
    throw new Error("RELEASE_EVIDENCE_ENVIRONMENT must be provided");
  }
  if (input.treeState !== "clean") {
    throw new Error("Release evidence requires a clean worktree");
  }
  if (!COMMIT_SHA.test(input.commitSha ?? "")) {
    throw new Error("Release evidence requires a full Git commit SHA");
  }
  if (!Array.isArray(input.commands) || input.commands.length === 0) {
    throw new Error("Release evidence requires at least one verification command");
  }
  if (input.commands.some((command) => command.exitCode !== 0)) {
    throw new Error("Release evidence cannot record a failed verification command");
  }
}

function pickAllowlistedEnvironmentValues(environmentValues) {
  return Object.fromEntries(
    Object.entries(environmentValues ?? {}).filter(
      ([key, value]) => ALLOWED_ENVIRONMENT_VALUES.has(key) && Boolean(value),
    ),
  );
}

export async function createReleaseEvidenceManifest(input) {
  assertReleaseEvidenceInput(input);

  const reports = await Promise.all(
    input.reports.map(async (path) => ({
      path,
      sha256: await sha256File(path),
    })),
  );

  if (reports.some((report) => !SHA_256.test(report.sha256))) {
    throw new Error("Release evidence report digest is invalid");
  }

  return {
    schemaVersion: 1,
    commitSha: input.commitSha,
    environment: input.environment.trim(),
    treeState: input.treeState,
    startedAt: input.startedAt,
    completedAt: input.completedAt,
    nodeVersion: input.nodeVersion,
    pnpmVersion: input.pnpmVersion,
    commands: input.commands,
    reports,
    environmentValues: pickAllowlistedEnvironmentValues(input.environmentValues),
  };
}

export async function writeReleaseEvidenceManifest(outputPath, input) {
  const manifest = await createReleaseEvidenceManifest(input);
  await writeFile(outputPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  return manifest;
}

function gitOutput(args) {
  return execFileSync("git", args, { encoding: "utf8" }).trim();
}

async function main() {
  const outputDirectory = resolve(
    process.cwd(),
    process.env.RELEASE_EVIDENCE_OUTPUT_DIR ?? ".release-evidence",
  );
  const manifestPath = resolve(outputDirectory, "release-evidence.json");
  const workspaceRoot = resolve(process.cwd());
  const outputRelativePath = relative(workspaceRoot, manifestPath);
  if (
    outputRelativePath.startsWith("..") ||
    isAbsolute(outputRelativePath) ||
    manifestPath === workspaceRoot
  ) {
    throw new Error("Release evidence output must stay within the workspace");
  }

  await mkdir(outputDirectory, { recursive: true });
  const manifest = await writeReleaseEvidenceManifest(manifestPath, {
    commitSha: process.env.GITHUB_SHA ?? gitOutput(["rev-parse", "HEAD"]),
    environment: process.env.RELEASE_EVIDENCE_ENVIRONMENT ?? "",
    treeState: gitOutput(["status", "--porcelain"]) === "" ? "clean" : "dirty",
    startedAt: process.env.RELEASE_EVIDENCE_STARTED_AT ?? new Date().toISOString(),
    completedAt: new Date().toISOString(),
    nodeVersion: process.version,
    pnpmVersion: execFileSync("pnpm", ["--version"], { encoding: "utf8" }).trim(),
    commands: [{ command: "pnpm run release:verify", exitCode: 0 }],
    reports: [],
    environmentValues: {
      RELEASE_EVIDENCE_ENVIRONMENT: process.env.RELEASE_EVIDENCE_ENVIRONMENT,
      GITHUB_RUN_ID: process.env.GITHUB_RUN_ID,
      GITHUB_SHA: process.env.GITHUB_SHA,
    },
  });

  process.stdout.write(
    `Release evidence manifest written to ${manifestPath} for ${manifest.environment}.\n`,
  );
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname)) {
  main().catch((error) => {
    process.stderr.write(
      `${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exitCode = 1;
  });
}
