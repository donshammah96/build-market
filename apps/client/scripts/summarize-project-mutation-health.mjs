import fs from "node:fs";
import process from "node:process";

function parseArgs(argv) {
  const args = {
    inputPath: undefined,
    json: false,
    maxWriteErrorRate: undefined,
    maxIdempotencyConflictRate: undefined,
    maxOptimisticConflictRate: undefined,
  };

  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i];
    switch (token) {
      case "--input":
      case "-i":
        args.inputPath = argv[i + 1];
        i += 1;
        break;
      case "--json":
        args.json = true;
        break;
      case "--max-write-error-rate":
        args.maxWriteErrorRate = Number(argv[i + 1]);
        i += 1;
        break;
      case "--max-idempotency-conflict-rate":
        args.maxIdempotencyConflictRate = Number(argv[i + 1]);
        i += 1;
        break;
      case "--max-optimistic-conflict-rate":
        args.maxOptimisticConflictRate = Number(argv[i + 1]);
        i += 1;
        break;
      case "--help":
      case "-h":
        printHelp();
        process.exit(0);
        break;
      default:
        if (!token.startsWith("-")) {
          args.inputPath = token;
        } else {
          console.error(
            `[projects-mutation-health] Unknown argument: ${token}`,
          );
          printHelp();
          process.exit(1);
        }
    }
  }

  return args;
}

function printHelp() {
  console.log(`Usage:
  node scripts/summarize-project-mutation-health.mjs --input <ndjson-log-file>
  cat app.log | node scripts/summarize-project-mutation-health.mjs

Options:
  --input, -i <path>                  Read newline-delimited logs from file
  --json                              Print machine-readable JSON summary
  --max-write-error-rate <percent>    Fail if write error rate exceeds threshold
  --max-idempotency-conflict-rate <percent>
                                      Fail if idempotency conflict rate exceeds threshold
  --max-optimistic-conflict-rate <percent>
                                      Fail if optimistic-lock conflict rate exceeds threshold
  --help, -h                          Show help
`);
}

function parseJsonLine(line) {
  const trimmed = line.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith("{")) {
    try {
      return JSON.parse(trimmed);
    } catch {
      return null;
    }
  }

  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    const candidate = trimmed.slice(firstBrace, lastBrace + 1);
    try {
      return JSON.parse(candidate);
    } catch {
      return null;
    }
  }

  return null;
}

function asObject(value) {
  return value && typeof value === "object" ? value : undefined;
}

function firstString(values) {
  for (const value of values) {
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }
  return undefined;
}

function firstNumber(values) {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === "string" && value.trim().length > 0) {
      const parsed = Number.parseInt(value, 10);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }
  return undefined;
}

const PROJECT_WRITE_OPERATION_NAMES = new Set([
  "create_project",
  "update_project",
  "delete_project",
  "create_project_milestone",
  "update_milestone",
  "delete_milestone",
  "approve_milestone",
  "fund_escrow",
  "release_escrow",
  "dispute_escrow",
  "create_project_document",
  "delete_project_document_item",
  "create_project_images",
  "delete_project_image_item",
]);

const OPTIMISTIC_LOCK_OPERATION_NAMES = new Set([
  "update_project",
  "delete_project",
  "update_milestone",
  "delete_milestone",
]);

const WRITE_METHODS = new Set(["POST", "PATCH", "DELETE", "PUT"]);

function toEventFields(entry) {
  const context = asObject(entry.context) || {};
  const error = asObject(entry.error) || {};

  const method = firstString([
    entry.httpMethod,
    entry.method,
    entry.requestMethod,
    context.httpMethod,
    context.method,
    context.requestMethod,
  ]);

  const route = firstString([
    entry.routePattern,
    entry.route,
    entry.path,
    entry.url,
    entry.requestPath,
    context.routePattern,
    context.route,
    context.path,
    context.url,
  ]);

  const operationName = firstString([
    entry.operationName,
    context.operationName,
    context.operation,
  ]);

  const status = firstNumber([
    entry.httpStatus,
    entry.statusCode,
    entry.status,
    context.httpStatus,
    context.statusCode,
    context.status,
  ]);

  const message = firstString([
    entry.message,
    error.message,
    context.message,
    context.error,
  ]);

  return {
    method: method ? method.toUpperCase() : undefined,
    route,
    operationName,
    status,
    message,
  };
}

function isProjectWriteEvent(fields) {
  if (
    fields.route &&
    fields.method &&
    WRITE_METHODS.has(fields.method) &&
    fields.route.includes("/api/projects")
  ) {
    return true;
  }

  if (
    fields.operationName &&
    PROJECT_WRITE_OPERATION_NAMES.has(fields.operationName)
  ) {
    return true;
  }

  return false;
}

function percentage(part, whole) {
  if (!whole) return 0;
  return Number(((part / whole) * 100).toFixed(2));
}

function evaluateThresholds(summary, args) {
  const failures = [];

  if (
    typeof args.maxWriteErrorRate === "number" &&
    Number.isFinite(args.maxWriteErrorRate) &&
    summary.writeErrorRatePct > args.maxWriteErrorRate
  ) {
    failures.push(
      `write error rate ${summary.writeErrorRatePct}% exceeded threshold ${args.maxWriteErrorRate}%`,
    );
  }

  if (
    typeof args.maxIdempotencyConflictRate === "number" &&
    Number.isFinite(args.maxIdempotencyConflictRate) &&
    summary.idempotencyConflictRatePct > args.maxIdempotencyConflictRate
  ) {
    failures.push(
      `idempotency conflict rate ${summary.idempotencyConflictRatePct}% exceeded threshold ${args.maxIdempotencyConflictRate}%`,
    );
  }

  if (
    typeof args.maxOptimisticConflictRate === "number" &&
    Number.isFinite(args.maxOptimisticConflictRate) &&
    summary.optimisticConflictRatePct > args.maxOptimisticConflictRate
  ) {
    failures.push(
      `optimistic-lock conflict rate ${summary.optimisticConflictRatePct}% exceeded threshold ${args.maxOptimisticConflictRate}%`,
    );
  }

  return failures;
}

function formatSummary(summary) {
  return [
    "[projects-mutation-health] Summary",
    `  - inputWriteEvents: ${summary.inputWriteEvents}`,
    `  - writeEventsWithStatus: ${summary.writeEventsWithStatus}`,
    `  - writeErrors(5xx): ${summary.writeErrors} (${summary.writeErrorRatePct}%)`,
    `  - idempotencyConflicts(409 pending/replay): ${summary.idempotencyConflicts} (${summary.idempotencyConflictRatePct}%)`,
    `  - optimisticLockSignals(428 + 409 version/conflict): ${summary.optimisticConflicts} (${summary.optimisticConflictRatePct}%)`,
    `  - statusBreakdown: ${JSON.stringify(summary.statusBreakdown)}`,
    `  - operationBreakdown: ${JSON.stringify(summary.operationBreakdown)}`,
  ].join("\n");
}

function main() {
  const args = parseArgs(process.argv);
  const raw = args.inputPath
    ? fs.readFileSync(args.inputPath, "utf8")
    : fs.readFileSync(0, "utf8");

  const lines = raw.split(/\r?\n/);

  let inputWriteEvents = 0;
  let writeEventsWithStatus = 0;
  let writeErrors = 0;
  let idempotencyConflicts = 0;
  let optimisticConflicts = 0;

  const statusBreakdown = {};
  const operationBreakdown = {};

  for (const line of lines) {
    const entry = parseJsonLine(line);
    if (!entry) continue;

    const fields = toEventFields(entry);
    if (!isProjectWriteEvent(fields)) continue;

    inputWriteEvents += 1;

    const opName = fields.operationName || "unknown_operation";
    operationBreakdown[opName] = (operationBreakdown[opName] || 0) + 1;

    if (typeof fields.status !== "number") continue;

    writeEventsWithStatus += 1;
    statusBreakdown[fields.status] = (statusBreakdown[fields.status] || 0) + 1;

    if (fields.status >= 500) {
      writeErrors += 1;
    }

    const message = (fields.message || "").toLowerCase();

    const isIdempotencyConflict =
      fields.status === 409 &&
      /idempot|being processed|request is being processed|pending/.test(
        message,
      );

    if (isIdempotencyConflict) {
      idempotencyConflicts += 1;
      continue;
    }

    const looksLikeOptimisticConflict =
      fields.status === 428 ||
      (fields.status === 409 &&
        (OPTIMISTIC_LOCK_OPERATION_NAMES.has(fields.operationName || "") ||
          /if-match|optimistic|version|precondition|conflict/.test(message)));

    if (looksLikeOptimisticConflict) {
      optimisticConflicts += 1;
    }
  }

  const summary = {
    inputWriteEvents,
    writeEventsWithStatus,
    writeErrors,
    idempotencyConflicts,
    optimisticConflicts,
    writeErrorRatePct: percentage(writeErrors, writeEventsWithStatus),
    idempotencyConflictRatePct: percentage(
      idempotencyConflicts,
      writeEventsWithStatus,
    ),
    optimisticConflictRatePct: percentage(
      optimisticConflicts,
      writeEventsWithStatus,
    ),
    statusBreakdown,
    operationBreakdown,
  };

  if (args.json) {
    console.log(JSON.stringify(summary, null, 2));
  } else {
    console.log(formatSummary(summary));
  }

  const thresholdFailures = evaluateThresholds(summary, args);
  if (thresholdFailures.length > 0) {
    console.error("[projects-mutation-health] Threshold check failed:");
    for (const failure of thresholdFailures) {
      console.error(`  - ${failure}`);
    }
    process.exit(1);
  }
}

main();
