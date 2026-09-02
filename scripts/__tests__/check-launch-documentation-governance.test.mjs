import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const checkerPath = join(repoRoot, "scripts", "check-launch-documentation-governance.mjs");
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

function write(root, relativePath, content) {
  const path = join(root, relativePath);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content, "utf8");
}

function createValidRepository() {
  const root = mkdtempSync(join(tmpdir(), "launch-governance-"));
  write(root, ".nvmrc", "24\n");
  write(root, "package.json", JSON.stringify({ engines: { node: "24.x" } }));
  write(root, "apps/workers/Dockerfile", "FROM node:24-alpine\n");
  write(
    root,
    ".github/workflows/ci.yml",
    "env:\n  NODE_VERSION: \"24\"\nsteps:\n  - uses: actions/setup-node@v6\n    with:\n      node-version: ${{ env.NODE_VERSION }}\n",
  );
  write(
    root,
    "README.md",
    "Client ADR-001 through ADR-010. Admin ADR-ADMIN-001 through ADR-ADMIN-016.\n",
  );
  write(
    root,
    ".agent/DOCUMENT-HIERARCHY.md",
    "Client ADR-001 through ADR-010. Admin ADR-ADMIN-001 through ADR-ADMIN-016.\n",
  );
  write(
    root,
    ".agent/ADMIN-ARCHITECTURE.md",
    "Admin ADR-ADMIN-001 through ADR-ADMIN-016.\n",
  );

  for (let number = 1; number <= 10; number += 1) {
    write(
      root,
      `apps/client/docs/adr/ADR-${String(number).padStart(3, "0")}.md`,
      "# Decision\n\nStatus: Accepted\nOwner: Client Architecture\nNext review: 2026-12-03\n",
    );
  }
  for (let number = 1; number <= 16; number += 1) {
    write(
      root,
      `apps/admin/docs/adr/ADR-ADMIN-${String(number).padStart(3, "0")}.md`,
      "# Decision\n\nStatus: Accepted\nOwner: Admin Architecture\nNext review: 2026-12-03\n",
    );
  }

  for (const app of ["client", "admin", "verification-ops", "workers"]) {
    write(
      root,
      `apps/${app}/docs/STATUS.md`,
      `# ${app} Current Status\n\n${requiredStatusFields.map((field) => `${field} documented`).join("\n")}\n`,
    );
  }

  write(
    root,
    "apps/workers/README.md",
    "# Workers\n\nHealth reports liveness, readiness, Redis, PostgreSQL, BullMQ worker state, and NATS connectivity. See [queue recovery runbook](docs/QUEUE_RECOVERY_RUNBOOK.md).\n",
  );
  write(root, "apps/workers/docs/QUEUE_RECOVERY_RUNBOOK.md", "# Queue recovery\n");
  write(
    root,
    "docs/launch/GO_NO_GO.md",
    "# Go / No-Go\n\n| Area | Evidence |\n| --- | --- |\n| Supply | ADR-010; Control: supply-liquidity-dashboard |\n| Responsiveness | ADR-010; Control: response-slo |\n| Verification | ADR-010; Control: verification-slo |\n| Lead experience | ADR-008; Control: disclosure-test |\n| Safety | ADR-006; Control: escalation-drill |\n| Payments | ADR-008; Control: callback-replay-drill |\n| Resilience | ADR-010; Control: queue-recovery-drill |\n| Compliance | ADR-006; Control: dpia-approval |\n",
  );
  return root;
}

function runChecker(root) {
  try {
    return {
      status: 0,
      output: execFileSync(process.execPath, [checkerPath, "--root", root], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      }),
    };
  } catch (error) {
    return {
      status: error.status ?? 1,
      output: `${error.stdout ?? ""}${error.stderr ?? ""}`,
    };
  }
}

function withRepository(callback) {
  const root = createValidRepository();
  try {
    callback(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test("accepts a repository with complete launch governance evidence", () => {
  withRepository((root) => {
    const result = runChecker(root);
    assert.equal(result.status, 0, result.output);
    assert.match(result.output, /launch documentation governance: OK/i);
  });
});

test("rejects an ADR that loses required lifecycle metadata", () => {
  withRepository((root) => {
    const adrPath = join(root, "apps/client/docs/adr/ADR-010.md");
    writeFileSync(adrPath, readFileSync(adrPath, "utf8").replace("Owner: Client Architecture\n", ""));
    const result = runChecker(root);
    assert.equal(result.status, 1);
    assert.match(result.output, /ADR-010\.md: missing Owner/i);
  });
});

test("rejects a canonical status page that loses evidence scope", () => {
  withRepository((root) => {
    const statusPath = join(root, "apps/client/docs/STATUS.md");
    writeFileSync(statusPath, readFileSync(statusPath, "utf8").replace("Known exclusions: documented\n", ""));
    const result = runChecker(root);
    assert.equal(result.status, 1);
    assert.match(result.output, /apps\/client\/docs\/STATUS\.md: missing Known exclusions/i);
  });
});

test("rejects a scorecard criterion without ADR and control evidence", () => {
  withRepository((root) => {
    const scorecardPath = join(root, "docs/launch/GO_NO_GO.md");
    writeFileSync(scorecardPath, readFileSync(scorecardPath, "utf8").replace("ADR-010; Control: response-slo", "response evidence pending"));
    const result = runChecker(root);
    assert.equal(result.status, 1);
    assert.match(result.output, /GO_NO_GO\.md: Responsiveness must name ADR and Control evidence/i);
  });
});

test("rejects worker operations documentation without its recovery runbook", () => {
  withRepository((root) => {
    writeFileSync(join(root, "apps/workers/README.md"), "# Workers\n");
    const result = runChecker(root);
    assert.equal(result.status, 1);
    assert.match(result.output, /apps\/workers\/README\.md: missing queue recovery runbook link/i);
  });
});

test("rejects active Node 20 runtime guidance", () => {
  withRepository((root) => {
    writeFileSync(join(root, ".nvmrc"), "20\n");
    const result = runChecker(root);
    assert.equal(result.status, 1);
    assert.match(result.output, /\.nvmrc: expected Node 24/i);
  });
});

test("rejects a nested active Docker base that regresses to Node 20", () => {
  withRepository((root) => {
    writeFileSync(join(root, "apps/workers/Dockerfile"), "FROM node:20-alpine\n");
    const result = runChecker(root);
    assert.equal(result.status, 1);
    assert.match(result.output, /apps\/workers\/Dockerfile: active Docker base must use Node 24/i);
  });
});

test("ignores dependency directories while scanning active Dockerfiles", () => {
  withRepository((root) => {
    write(root, "apps/workers/node_modules/transitive/Dockerfile", "FROM node:20-alpine\n");
    const result = runChecker(root);
    assert.equal(result.status, 0, result.output);
  });
});
