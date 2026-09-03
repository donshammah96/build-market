import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  createReleaseEvidenceManifest,
  sha256File,
  writeReleaseEvidenceManifest,
} from "../generate-release-evidence.mjs";

test("creates a redacted, digest-bound release evidence manifest", async () => {
  const directory = await mkdtemp(join(tmpdir(), "build-market-release-evidence-"));
  const reportPath = join(directory, "capability-tests.json");
  await writeFile(reportPath, '{"passed":true}\n');

  const manifest = await createReleaseEvidenceManifest({
    commitSha: "a".repeat(40),
    environment: "staging",
    treeState: "clean",
    startedAt: "2026-09-03T10:00:00.000Z",
    completedAt: "2026-09-03T10:01:00.000Z",
    nodeVersion: "v24.13.1",
    pnpmVersion: "11.1.2",
    commands: [{ command: "pnpm run ci:local", exitCode: 0 }],
    reports: [reportPath],
    environmentValues: {
      RELEASE_EVIDENCE_ENVIRONMENT: "staging",
      DATABASE_URL: "postgresql://secret@example.test/build-market",
    },
  });

  assert.equal(manifest.environment, "staging");
  assert.equal(manifest.commitSha, "a".repeat(40));
  assert.equal(manifest.reports[0]?.sha256, await sha256File(reportPath));
  assert.deepEqual(manifest.environmentValues, {
    RELEASE_EVIDENCE_ENVIRONMENT: "staging",
  });
  assert.equal(JSON.stringify(manifest).includes("secret@example.test"), false);
});

test("rejects evidence that lacks a clean tree or named environment", async () => {
  const base = {
    commitSha: "b".repeat(40),
    startedAt: "2026-09-03T10:00:00.000Z",
    completedAt: "2026-09-03T10:01:00.000Z",
    nodeVersion: "v24.13.1",
    pnpmVersion: "11.1.2",
    commands: [{ command: "pnpm run ci:local", exitCode: 0 }],
    reports: [],
    environmentValues: {},
  };

  await assert.rejects(
    createReleaseEvidenceManifest({
      ...base,
      environment: "",
      treeState: "clean",
    }),
    /RELEASE_EVIDENCE_ENVIRONMENT/,
  );
  await assert.rejects(
    createReleaseEvidenceManifest({
      ...base,
      environment: "staging",
      treeState: "dirty",
    }),
    /clean worktree/,
  );
});

test("writes the manifest as stable JSON for CI artifact upload", async () => {
  const directory = await mkdtemp(join(tmpdir(), "build-market-release-evidence-"));
  const outputPath = join(directory, "release-evidence.json");

  await writeReleaseEvidenceManifest(outputPath, {
    commitSha: "c".repeat(40),
    environment: "staging",
    treeState: "clean",
    startedAt: "2026-09-03T10:00:00.000Z",
    completedAt: "2026-09-03T10:01:00.000Z",
    nodeVersion: "v24.13.1",
    pnpmVersion: "11.1.2",
    commands: [{ command: "pnpm run ci:local", exitCode: 0 }],
    reports: [],
    environmentValues: {},
  });

  const written = JSON.parse(await readFile(outputPath, "utf8"));
  assert.equal(written.schemaVersion, 1);
  assert.equal(written.commitSha, "c".repeat(40));
});
