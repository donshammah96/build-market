import { NextRequest, NextResponse } from "next/server";
import { env } from "@/app/lib/infrastructure/env";
import {
  ensureValidInternalSecret,
  timingSafeEqualStrings,
} from "@/app/lib/security/internal-secret";

const MAX_BODY_BYTES = 64 * 1024; // 64KB max

function notFoundResponse(reason?: string) {
  const headers: Record<string, string> = {};
  if (reason) {
    headers["x-test-control-denial"] = reason;
  }
  return new NextResponse(null, { status: 404, headers });
}

function deny(reason: string, meta: Record<string, unknown> = {}) {
  const detail = meta.error ? String(meta.error) : undefined;
  console.warn("test_control_denied", {
    reason,
    path: "/api/internal/test-control",
    detail,
  });
  return notFoundResponse(reason);
}

export async function POST(request: NextRequest) {
  // 1. Hard fail-closed environment gate before dynamic imports
  const isStaging =
    env.otel.ddEnv === "staging" ||
    Boolean(env.stagingTestControl?.enabled) ||
    Boolean(env.stagingAuth?.isEnabled);
  const isTest = env.isTest;

  if (!isStaging && !isTest) {
    return deny("not_staging_environment");
  }

  // 2. Validate internal service secret
  const internalSecretHeader = request.headers.get("x-internal-secret");
  const secretError = ensureValidInternalSecret(internalSecretHeader);
  if (secretError !== null) {
    return deny("internal_secret_rejected", { error: secretError });
  }

  // 3. A separately rotated control secret is mandatory in staging. Test mode
  // uses an isolated in-process constant so normal unit tests do not need a
  // deployable secret.
  const configuredTestSecret = env.stagingTestControl?.secret;
  if (!configuredTestSecret && !isTest) {
    return deny("missing_configured_test_control_secret");
  }
  if (configuredTestSecret) {
    const testSecretHeader = request.headers.get("x-test-control-secret");
    if (
      !testSecretHeader ||
      !timingSafeEqualStrings(testSecretHeader, configuredTestSecret)
    ) {
      return deny("test_control_secret_mismatch");
    }
  }

  // 4. Cap request body size (check content-length before reading text buffer)
  const contentLengthHeader = request.headers.get("content-length");
  if (contentLengthHeader) {
    const contentLength = Number.parseInt(contentLengthHeader, 10);
    if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
      return NextResponse.json({ error: "Payload too large" }, { status: 413 });
    }
  }

  const rawBody = await request.text();
  if (Buffer.byteLength(rawBody, "utf-8") > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  }

  let jsonBody: unknown;
  try {
    jsonBody = rawBody ? JSON.parse(rawBody) : {};
  } catch {
    return NextResponse.json({ error: "Malformed JSON" }, { status: 400 });
  }

  // 5. Dynamic import of domain logic only after security gates have passed
  const {
    TestControlActionSchema,
    verifyStagingGrant,
    resolveStagingControlSecret,
  } = await import("@/app/lib/domains/testing/test-control/contracts");
  const { testControlService } =
    await import("@/app/lib/domains/testing/test-control/service");

  const parsedAction = TestControlActionSchema.safeParse(jsonBody);
  if (!parsedAction.success) {
    return NextResponse.json(
      { error: "Invalid action payload", details: parsedAction.error.format() },
      { status: 400 },
    );
  }

  const payload = parsedAction.data;

  // 6. Action-specific verification: `create-run` creates the grant; all other actions require the grant
  if (payload.action !== "create-run") {
    const grantHeader = request.headers.get("x-test-control-grant");
    if (!grantHeader) {
      return deny("grant_missing", {
        action: payload.action,
        runId: payload.runId,
      });
    }

    const secret = resolveStagingControlSecret(configuredTestSecret, isTest);
    if (!secret) {
      return deny("missing_configured_test_control_secret", {
        action: payload.action,
      });
    }

    const grant = verifyStagingGrant(grantHeader, secret, payload.runId);
    if (!grant) {
      return deny("grant_invalid_or_expired", {
        action: payload.action,
        runId: payload.runId,
      });
    }

    if (grant.runId !== payload.runId) {
      return deny("grant_run_mismatch", {
        action: payload.action,
        expected: payload.runId,
        actual: grant.runId,
      });
    }

    if (!grant.actions.includes(payload.action)) {
      return deny("grant_action_not_permitted", {
        action: payload.action,
        permitted: grant.actions,
      });
    }

    if (payload.action === "reset-identity-baseline") {
      if (
        grant.scenario !== "onboarding" &&
        grant.scenario !== "verification"
      ) {
        return deny("grant_scenario_not_eligible", {
          action: payload.action,
          scenario: grant.scenario,
        });
      }
    }
  }

  // 7. Dispatch to domain service
  switch (payload.action) {
    case "create-run": {
      const result = await testControlService.createRun({
        scenario: payload.scenario,
        actorLabel: payload.actorLabel,
        gitSha: payload.gitSha,
        workflowRunId: payload.workflowRunId,
      });
      if (!result.ok) {
        return NextResponse.json(
          { error: result.error, message: result.message },
          { status: result.status },
        );
      }
      return NextResponse.json(result.data, { status: 201 });
    }

    case "issue-session-handoff": {
      const result = await testControlService.issueBrowserSessionHandoff({
        runId: payload.runId,
        role: payload.role,
      });
      if (!result.ok) {
        return NextResponse.json(
          { error: result.error, message: result.message },
          { status: result.status },
        );
      }
      return NextResponse.json(result.data, { status: 200 });
    }

    case "reset-identity-baseline": {
      const result = await testControlService.resetIdentityBaseline({
        runId: payload.runId,
        role: payload.role,
      });
      if (!result.ok) {
        return NextResponse.json(
          { error: result.error, message: result.message },
          { status: result.status },
        );
      }
      return NextResponse.json(result.data, { status: 200 });
    }

    case "seed-mpesa-transaction": {
      const result = await testControlService.seedPendingMpesaTransaction({
        runId: payload.runId,
        amount: payload.amount,
        phoneNumber: payload.phoneNumber,
        checkoutRequestId: payload.checkoutRequestId,
        merchantRequestId: payload.merchantRequestId,
      });
      if (!result.ok) {
        return NextResponse.json(
          { error: result.error, message: result.message },
          { status: result.status },
        );
      }
      return NextResponse.json(result.data, { status: 201 });
    }

    case "get-run-projection": {
      const result = await testControlService.getRunProjection(payload.runId);
      if (!result.ok) {
        return NextResponse.json(
          { error: result.error, message: result.message },
          { status: result.status },
        );
      }
      return NextResponse.json(result.data, { status: 200 });
    }

    case "cleanup-run": {
      const result = await testControlService.cleanupRun(payload.runId);
      if (!result.ok) {
        return NextResponse.json(
          { error: result.error, message: result.message },
          { status: result.status },
        );
      }
      return NextResponse.json(result.data, { status: 200 });
    }

    case "seed-scenario": {
      const result = await testControlService.seedScenario({
        runId: payload.runId,
        scenario: payload.scenario,
        payload: payload.payload,
      });
      if (!result.ok) {
        return NextResponse.json(
          { error: result.error, message: result.message },
          { status: result.status },
        );
      }
      return NextResponse.json(result.data, { status: 201 });
    }
  }
}
