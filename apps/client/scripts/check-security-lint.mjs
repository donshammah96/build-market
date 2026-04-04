import process from "node:process";
import {
  collectDangerousHtmlDrift,
  collectGetJsonInGetHandlerDrift,
  collectMutationPassthroughDrift,
  collectSensitiveStorageWriteDrift,
  collectUnsafeApiErrorDrift,
} from "./security-lint-checks.mjs";

const mutationPassthrough = collectMutationPassthroughDrift();
const dangerousHtml = collectDangerousHtmlDrift();
const unsafeApiError = collectUnsafeApiErrorDrift();
const getJsonInGetHandler = collectGetJsonInGetHandlerDrift();
const sensitiveStorageWrite = collectSensitiveStorageWriteDrift();

if (
  mutationPassthrough.length > 0 ||
  dangerousHtml.length > 0 ||
  unsafeApiError.length > 0 ||
  getJsonInGetHandler.length > 0 ||
  sensitiveStorageWrite.length > 0
) {
  console.error("[security/lint] Security lint violations detected.");

  if (mutationPassthrough.length > 0) {
    console.error(
      "[security/lint][SEC-LINT-002] .passthrough() is prohibited on mutation schemas without explicit allowlisting:",
    );
    for (const offender of mutationPassthrough) {
      console.error(
        `  - ${offender.file}:${offender.line} -> ${offender.sample}`,
      );
    }
  }

  if (unsafeApiError.length > 0) {
    console.error(
      "[security/lint][SEC-LINT-004] Unsafe apiError(error.message|error.stack) usage detected:",
    );
    for (const offender of unsafeApiError) {
      console.error(
        `  - ${offender.file}:${offender.line} -> ${offender.source}`,
      );
    }
  }

  if (dangerousHtml.length > 0) {
    console.error(
      "[security/lint][SEC-LINT-003] dangerouslySetInnerHTML requires sanitizer/review annotation or explicit allowlisting:",
    );
    for (const offender of dangerousHtml) {
      console.error(
        `  - ${offender.file}:${offender.line} -> ${offender.sample}`,
      );
    }
  }

  if (getJsonInGetHandler.length > 0) {
    console.error(
      "[security/lint][SEC-LINT-006] req.json() in exported GET handler detected:",
    );
    for (const offender of getJsonInGetHandler) {
      console.error(
        `  - ${offender.file}:${offender.line} -> ${offender.sample}`,
      );
    }
  }

  if (sensitiveStorageWrite.length > 0) {
    console.error(
      "[security/lint][SEC-LINT-007] localStorage/sessionStorage writes in onboarding/profile/payment flows require explicit allowlisting:",
    );
    for (const offender of sensitiveStorageWrite) {
      console.error(
        `  - ${offender.file}:${offender.line} -> ${offender.sample}`,
      );
    }
  }

  process.exit(1);
}

console.log(
  "[security/lint] OK: SEC-LINT-002, SEC-LINT-003, SEC-LINT-004, SEC-LINT-006, and SEC-LINT-007 checks passed.",
);
