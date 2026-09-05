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

export async function POST(request: NextRequest) {
  // 1. Hard fail-closed environment gate before dynamic imports
  const isStaging =
    env.otel.ddEnv === "staging" ||
    Boolean(env.stagingTestControl?.enabled) ||
    Boolean(env.stagingAuth?.isEnabled);
  const isTest = env.isTest;

  if (!isStaging && !isTest) {
    return notFoundResponse("not_staging_environment");
  }

  // 2. Validate internal service secret
  const internalSecretHeader = request.headers.get("x-internal-secret");
  const secretError = ensureValidInternalSecret(internalSecretHeader);
  if (secretError !== null) {
    return notFoundResponse("internal_secret_rejected");
  }

  // 3. A separately rotated control secret is mandatory in staging. Test mode
  // uses an isolated in-process constant so normal unit tests do not need a
  // deployable secret.
  const configuredTestSecret = env.stagingTestControl?.secret;
  if (!configuredTestSecret && !isTest) {
    return notFoundResponse("missing_configured_test_control_secret");
  }
  if (configuredTestSecret) {
    const testSecretHeader = request.headers.get("x-test-control-secret");
    if (
      !testSecretHeader ||
      !timingSafeEqualStrings(testSecretHeader, configuredTestSecret)
    ) {
      return notFoundResponse("test_control_secret_mismatch");
    }
  }

  // 4. Cap request body size
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
    const secret = resolveStagingControlSecret(configuredTestSecret, isTest);

    const grant = secret
      ? verifyStagingGrant(grantHeader ?? "", secret, payload.runId)
      : null;
    if (!grant || !grant.actions.includes(payload.action)) {
      return notFoundResponse();
    }

    if (payload.action === "reset-identity-baseline") {
      if (
        grant.scenario !== "onboarding" &&
        grant.scenario !== "verification"
      ) {
        return notFoundResponse();
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
