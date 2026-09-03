import { clerkClient } from "@clerk/nextjs/server";
import { err, ok, type Result } from "@/app/lib/errors/result";
import { env } from "@/app/lib/infrastructure/env";
import {
  isStagingRunActive,
  type StagingScenario,
} from "@build/db/staging-test-runs";
import {
  signStagingGrant,
  resolveStagingControlSecret,
  type StagingGrantPayload,
} from "./contracts.js";
import {
  testControlRepository,
  type CreateRunParams,
} from "./repository.js";

export interface TestControlError {
  error: string;
  message: string;
  status: number;
}

export class TestControlService {
  /**
   * Initializes a new StagingTestRun and issues a signed, short-lived grant token.
   */
  async createRun(
    params: CreateRunParams,
  ): Promise<Result<{ runId: string; grantToken: string }, TestControlError>> {
    const secret = resolveStagingControlSecret(
      env.stagingTestControl?.secret,
      env.isTest,
    );
    if (!secret) {
      return err({
        error: "TEST_CONTROL_NOT_CONFIGURED",
        message: "Staging test control is missing TEST_CONTROL_SECRET",
        status: 404,
      });
    }

    try {
      const run = await testControlRepository.createRun(params);
      const grantToken = signStagingGrant(
        {
          runId: run.id,
          scenario: params.scenario,
          actions: [
            "seed-scenario",
            "issue-session-handoff",
            "seed-mpesa-transaction",
            "get-run-projection",
            "cleanup-run",
          ],
        },
        secret,
        300,
      );

      return ok({ runId: run.id, grantToken });
    } catch (e: any) {
      return err({
        error: "CREATE_RUN_FAILED",
        message: e.message || "Failed to initialize staging test run",
        status: 500,
      });
    }
  }

  /**
   * Generates a single-use Clerk sign-in ticket for pre-provisioned staging pool accounts.
   */
  async issueBrowserSessionHandoff(params: {
    runId: string;
    role: "CLIENT" | "PROFESSIONAL";
  }): Promise<
    Result<
      { userId: string; email: string; ticket: string; signInUrl: string },
      TestControlError
    >
  > {
    const run = await testControlRepository.findRunById(params.runId);
    if (!run || !isStagingRunActive({ state: run.state as any, expiresAt: run.expiresAt })) {
      return err({
        error: "RUN_NOT_ACTIVE",
        message: "Staging test run is not found or has expired",
        status: 400,
      });
    }

    const email =
      params.role === "PROFESSIONAL"
        ? "e2e_pro_1@staging.buildmarket.app"
        : "e2e_client_1@staging.buildmarket.app";

    try {
      const clerk = await clerkClient();
      const usersResponse = await (clerk as any).users.getUserList({
        emailAddress: [email],
      });

      const user = usersResponse.data?.[0];
      if (!user) {
        return err({
          error: "STAGING_TEST_USER_MISSING",
          message: `Pre-provisioned Clerk user ${email} was not found in staging pool`,
          status: 404,
        });
      }

      const ticketResponse = await (clerk as any).signInTokens.createSignInToken({
        userId: user.id,
        expiresInSeconds: 300,
      });

      return ok({
        userId: user.id,
        email,
        ticket: ticketResponse.token,
        signInUrl: ticketResponse.url,
      });
    } catch (e: any) {
      return err({
        error: "CLERK_HANDOFF_FAILED",
        message: e.message || "Failed to mint Clerk testing token",
        status: 502,
      });
    }
  }

  /**
   * Seeds a pending MpesaTransaction record bound to the staging test run.
   */
  async seedPendingMpesaTransaction(params: {
    runId: string;
    amount: number;
    phoneNumber: string;
    checkoutRequestId?: string;
    merchantRequestId?: string;
  }): Promise<Result<{ transactionId: string; checkoutRequestId: string; merchantRequestId: string }, TestControlError>> {
    const run = await testControlRepository.findRunById(params.runId);
    if (!run || !isStagingRunActive({ state: run.state as any, expiresAt: run.expiresAt })) {
      return err({
        error: "RUN_NOT_ACTIVE",
        message: "Staging test run is not active or has expired",
        status: 400,
      });
    }

    try {
      const tx = await testControlRepository.seedPendingMpesaTransaction(params);
      return ok({
        transactionId: tx.id,
        checkoutRequestId: tx.checkoutRequestId!,
        merchantRequestId: tx.merchantRequestId!,
      });
    } catch (e: any) {
      return err({
        error: "SEED_TRANSACTION_FAILED",
        message: e.message || "Failed to seed pending M-Pesa transaction",
        status: 500,
      });
    }
  }

  async seedScenario(params: {
    runId: string;
    scenario: StagingScenario;
    payload: Record<string, unknown>;
  }): Promise<Result<Record<string, string>, TestControlError>> {
    const run = await testControlRepository.findRunById(params.runId);
    if (
      !run ||
      run.scenario !== params.scenario ||
      !isStagingRunActive({ state: run.state as any, expiresAt: run.expiresAt })
    ) {
      return err({
        error: "RUN_NOT_ACTIVE",
        message: "Staging test run is not active for the requested scenario",
        status: 400,
      });
    }

    try {
      return ok(await testControlRepository.seedScenario(params));
    } catch (e: any) {
      return err({
        error: "SEED_SCENARIO_FAILED",
        message: e.message || "Failed to seed staging scenario",
        status: 500,
      });
    }
  }

  /**
   * Retrieves full entity projection owned by the test run.
   */
  async getRunProjection(runId: string): Promise<Result<any, TestControlError>> {
    try {
      const projection = await testControlRepository.getRunProjection(runId);
      if (!projection.run) {
        return err({
          error: "RUN_NOT_FOUND",
          message: `Staging test run ${runId} was not found`,
          status: 404,
        });
      }
      return ok(projection);
    } catch (e: any) {
      return err({
        error: "GET_PROJECTION_FAILED",
        message: e.message || "Failed to retrieve run projection",
        status: 500,
      });
    }
  }

  /**
   * Executes atomic cascading cleanup of all entities owned by the test run.
   */
  async cleanupRun(runId: string): Promise<Result<{ cleaned: true }, TestControlError>> {
    const run = await testControlRepository.findRunById(runId);
    if (!run) {
      return err({
        error: "RUN_NOT_FOUND",
        message: `Staging test run ${runId} was not found`,
        status: 404,
      });
    }

    if (run.state === "CLEANED") {
      return ok({ cleaned: true }); // Idempotent success
    }

    try {
      await testControlRepository.cleanupRun(runId);
      return ok({ cleaned: true });
    } catch (e: any) {
      return err({
        error: "CLEANUP_FAILED",
        message: e.message || "Failed to clean up staging test run",
        status: 500,
      });
    }
  }
}

export const testControlService = new TestControlService();
