import { defineConfig } from "cypress";

export default defineConfig({
  e2e: {
    baseUrl: process.env.STAGING_E2E_BASE_URL ?? "http://localhost:3500",
    supportFile: "cypress/support/e2e.ts",
    specPattern: "cypress/e2e/**/*.cy.{js,jsx,ts,tsx}",
    viewportWidth: 1280,
    viewportHeight: 720,
    video: false,
    screenshotOnRunFailure: true,
    defaultCommandTimeout: 10000,
    requestTimeout: 10000,
    responseTimeout: 30000,
    retries: {
      runMode: 2,
      openMode: 0,
    },
    env: {
      // Test environment variables
      API_URL: "http://localhost:3500/api",
    },
    setupNodeEvents(
      on: Cypress.PluginEvents,
      config: Cypress.PluginConfigOptions,
    ) {
      let activeRunId: string | null = null;
      let activeGrantToken: string | null = null;

      const baseUrl =
        config.env.STAGING_E2E_BASE_URL ||
        process.env.STAGING_E2E_BASE_URL ||
        "http://localhost:3500";
      const internalSecret =
        process.env.INTERNAL_API_SECRET || process.env.INTERNAL_SERVICE_SECRET;
      const testSecret = process.env.TEST_CONTROL_SECRET || "";
      const stagingAuthSecret = process.env.STAGING_AUTH_SECRET || "";

      const stagingAuthUser = process.env.STAGING_AUTH_USER || "";
      const stagingAuthPassword = process.env.STAGING_AUTH_PASSWORD || "";

      function assertControlCredentials() {
        if (!internalSecret || !testSecret) {
          throw new Error(
            "Staging test-control requires INTERNAL_SERVICE_SECRET and TEST_CONTROL_SECRET; refusing to use defaults",
          );
        }
        const target = new URL(baseUrl);
        const allowedHosts = (process.env.STAGING_E2E_ALLOWED_HOSTS || "")
          .split(",")
          .map((host) => host.trim())
          .filter(Boolean);
        if (
          target.protocol !== "https:" ||
          target.hostname === "localhost" ||
          target.hostname === "127.0.0.1" ||
          allowedHosts.length === 0 ||
          !allowedHosts.includes(target.hostname)
        ) {
          throw new Error(
            "Staging E2E requires an HTTPS STAGING_E2E_BASE_URL in STAGING_E2E_ALLOWED_HOSTS",
          );
        }
      }

      function getTestControlHeaders(additional?: Record<string, string>) {
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
          "x-internal-secret": internalSecret,
          ...(testSecret ? { "x-test-control-secret": testSecret } : {}),
          ...(stagingAuthSecret
            ? { "x-staging-secret": stagingAuthSecret }
            : {}),
          ...additional,
        };

        if (!stagingAuthSecret && stagingAuthUser && stagingAuthPassword) {
          const basic = Buffer.from(
            `${stagingAuthUser}:${stagingAuthPassword}`,
          ).toString("base64");
          headers["Authorization"] = `Basic ${basic}`;
        }

        return headers;
      }

      on("task", {
        log(message: string) {
          console.log(message);
          return null;
        },

        "stagingTestControl:getStagingAuthCookie"() {
          return {
            name: "bm_staging_auth",
            value: stagingAuthSecret,
          };
        },

        async "stagingTestControl:createRun"(params: {
          scenario: string;
          actorLabel?: string;
        }) {
          assertControlCredentials();
          const res = await fetch(`${baseUrl}/api/internal/test-control`, {
            method: "POST",
            headers: getTestControlHeaders(),
            body: JSON.stringify({
              action: "create-run",
              scenario: params.scenario,
              actorLabel: params.actorLabel || "cypress-ci",
            }),
          });
          if (!res.ok) {
            throw new Error(
              `createRun failed with status ${res.status}: ${await res.text()}`,
            );
          }
          const body = await res.json();
          activeRunId = body.runId;
          activeGrantToken = body.grantToken;
          return body;
        },

        async "stagingTestControl:issueSession"(params: {
          role: "CLIENT" | "PROFESSIONAL";
        }) {
          assertControlCredentials();
          if (!activeRunId || !activeGrantToken) {
            throw new Error("No active staging test run initialized");
          }
          const res = await fetch(`${baseUrl}/api/internal/test-control`, {
            method: "POST",
            headers: getTestControlHeaders({
              "x-test-control-grant": activeGrantToken,
            }),
            body: JSON.stringify({
              action: "issue-session-handoff",
              runId: activeRunId,
              role: params.role,
            }),
          });
          if (!res.ok) {
            throw new Error(
              `issueSession failed with status ${res.status}: ${await res.text()}`,
            );
          }
          return res.json();
        },

        async "stagingTestControl:seedMpesa"(params: {
          amount: number;
          phoneNumber: string;
          checkoutRequestId?: string;
          merchantRequestId?: string;
        }) {
          assertControlCredentials();
          if (!activeRunId || !activeGrantToken) {
            throw new Error("No active staging test run initialized");
          }
          const res = await fetch(`${baseUrl}/api/internal/test-control`, {
            method: "POST",
            headers: getTestControlHeaders({
              "x-test-control-grant": activeGrantToken,
            }),
            body: JSON.stringify({
              action: "seed-mpesa-transaction",
              runId: activeRunId,
              amount: params.amount,
              phoneNumber: params.phoneNumber,
              checkoutRequestId: params.checkoutRequestId,
              merchantRequestId: params.merchantRequestId,
            }),
          });
          if (!res.ok) {
            throw new Error(
              `seedMpesa failed with status ${res.status}: ${await res.text()}`,
            );
          }
          return res.json();
        },

        async "stagingTestControl:seedScenario"(params: {
          scenario: string;
          payload?: Record<string, unknown>;
        }) {
          assertControlCredentials();
          if (!activeRunId || !activeGrantToken) {
            throw new Error("No active staging test run initialized");
          }
          const res = await fetch(`${baseUrl}/api/internal/test-control`, {
            method: "POST",
            headers: getTestControlHeaders({
              "x-test-control-grant": activeGrantToken,
            }),
            body: JSON.stringify({
              action: "seed-scenario",
              runId: activeRunId,
              scenario: params.scenario,
              payload: params.payload || {},
            }),
          });
          if (!res.ok) {
            throw new Error(
              `seedScenario failed with status ${res.status}: ${await res.text()}`,
            );
          }
          return res.json();
        },

        async "stagingTestControl:getProjection"() {
          assertControlCredentials();
          if (!activeRunId || !activeGrantToken) {
            throw new Error("No active staging test run initialized");
          }
          const res = await fetch(`${baseUrl}/api/internal/test-control`, {
            method: "POST",
            headers: getTestControlHeaders({
              "x-test-control-grant": activeGrantToken,
            }),
            body: JSON.stringify({
              action: "get-run-projection",
              runId: activeRunId,
            }),
          });
          if (!res.ok) {
            throw new Error(
              `getProjection failed with status ${res.status}: ${await res.text()}`,
            );
          }
          return res.json();
        },

        async "stagingTestControl:cleanup"() {
          assertControlCredentials();
          if (!activeRunId || !activeGrantToken) {
            return { cleaned: true };
          }
          const res = await fetch(`${baseUrl}/api/internal/test-control`, {
            method: "POST",
            headers: getTestControlHeaders({
              "x-test-control-grant": activeGrantToken,
            }),
            body: JSON.stringify({
              action: "cleanup-run",
              runId: activeRunId,
            }),
          });
          if (!res.ok) {
            throw new Error(
              `cleanup failed with status ${res.status}: ${await res.text()}`,
            );
          }
          activeRunId = null;
          activeGrantToken = null;
          return res.json();
        },
      });
      return config;
    },
  },
  component: {
    devServer: {
      framework: "next",
      bundler: "webpack",
    },
    supportFile: "cypress/support/component.ts",
    specPattern: "cypress/component/**/*.cy.{js,jsx,ts,tsx}",
  },
});
