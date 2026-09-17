import { createHash } from "node:crypto";
import { defineConfig } from "cypress";

export default defineConfig({
  e2e: {
    baseUrl:
      process.env.STAGING_E2E_BASE_URL?.trim() || "http://localhost:3500",
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
      let active: {
        spec: string;
        runId: string;
        grantToken: string;
      } | null = null;

      function requireActive(spec?: string) {
        if (!active) {
          throw new Error("No active staging test run initialized");
        }
        if (spec && active.spec !== spec) {
          throw new Error(
            `No active staging run for spec "${spec}" (got active run for "${active.spec}")`,
          );
        }
        return active;
      }

      function hashEmail(email?: string): string {
        if (!email) return "";
        return createHash("sha256")
          .update(email.toLowerCase().trim())
          .digest("hex")
          .slice(0, 12);
      }

      function redactProjection(projection: any) {
        if (!projection || typeof projection !== "object") return projection;
        const redacted = { ...projection };
        if (redacted.fixtures && typeof redacted.fixtures === "object") {
          const f = { ...redacted.fixtures };
          if (Array.isArray(f.users)) {
            f.users = f.users.map((u: any) => ({
              id: u.id,
              role: u.role,
              emailHash: hashEmail(u.email),
              onboardingState: u.onboardingState,
            }));
          }
          redacted.fixtures = f;
        }
        return redacted;
      }

      const baseUrl = (
        config.env.STAGING_E2E_BASE_URL ||
        process.env.STAGING_E2E_BASE_URL ||
        "http://localhost:3500"
      ).trim();
      const internalSecret = (
        process.env.INTERNAL_API_SECRET ||
        process.env.INTERNAL_SERVICE_SECRET ||
        ""
      ).trim();
      const testSecret = (process.env.TEST_CONTROL_SECRET || "").trim();
      const stagingAuthSecret = (process.env.STAGING_AUTH_SECRET || "").trim();

      const stagingAuthUser = (process.env.STAGING_AUTH_USER || "").trim();
      const stagingAuthPassword = (
        process.env.STAGING_AUTH_PASSWORD || ""
      ).trim();

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
          ...(internalSecret ? { "x-internal-secret": internalSecret } : {}),
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

      function formatControlError(
        status: number,
        headers: Headers,
        bodyText: string,
      ) {
        const denial = headers.get("x-test-control-denial");
        return `status ${status}${denial ? ` [denial: ${denial}]` : ""}: ${bodyText}`;
      }

      function normalizeSignInUrl(url: string, origin: string): string {
        if (!url) return url;
        try {
          const parsed = new URL(url, origin);
          const base = new URL(origin);
          const ticket =
            parsed.searchParams.get("__clerk_ticket") ||
            parsed.searchParams.get("ticket");
          if (ticket) {
            const redirectUrl = parsed.searchParams.get("redirect_url");
            const redirectParam = redirectUrl
              ? `&redirect_url=${encodeURIComponent(redirectUrl)}`
              : "";
            return `${base.origin}/sign-in?__clerk_ticket=${encodeURIComponent(ticket)}${redirectParam}`;
          }
          parsed.protocol = base.protocol;
          parsed.host = base.host;
          return parsed.toString();
        } catch {
          return url;
        }
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
            user: stagingAuthUser || "buildmarket",
            password: stagingAuthPassword,
          };
        },

        async "stagingTestControl:checkQueueHealth"() {
          try {
            const res = await fetch(`${baseUrl}/api/internal/queue-health`, {
              method: "GET",
              headers: getTestControlHeaders(),
            });
            if (!res.ok) {
              return { connected: false, error: `HTTP ${res.status}` };
            }
            return await res.json();
          } catch (err: any) {
            return { connected: false, error: err.message };
          }
        },

        async "stagingTestControl:createRun"(params: {
          scenario: string;
          actorLabel?: string;
          spec?: string;
          lifetimeSeconds?: number;
        }) {
          assertControlCredentials();
          active = null;
          const res = await fetch(`${baseUrl}/api/internal/test-control`, {
            method: "POST",
            headers: getTestControlHeaders(),
            body: JSON.stringify({
              action: "create-run",
              scenario: params.scenario,
              actorLabel: params.actorLabel || "cypress-ci",
              lifetimeSeconds: params.lifetimeSeconds || 900,
            }),
          });
          if (!res.ok) {
            throw new Error(
              `createRun failed with ${formatControlError(res.status, res.headers, await res.text())}`,
            );
          }
          const body = await res.json();
          active = {
            spec: params.spec || "unknown",
            runId: body.runId,
            grantToken: body.grantToken,
          };
          return body;
        },

        async "stagingTestControl:issueSession"(params: {
          role: "CLIENT" | "PROFESSIONAL";
          spec?: string;
        }) {
          assertControlCredentials();
          const current = requireActive(params?.spec);
          const res = await fetch(`${baseUrl}/api/internal/test-control`, {
            method: "POST",
            headers: getTestControlHeaders({
              "x-test-control-grant": current.grantToken,
            }),
            body: JSON.stringify({
              action: "issue-session-handoff",
              runId: current.runId,
              role: params.role,
            }),
          });
          if (!res.ok) {
            throw new Error(
              `issueSession failed with ${formatControlError(res.status, res.headers, await res.text())}`,
            );
          }
          const body = await res.json();
          if (body?.signInUrl) {
            body.signInUrl = normalizeSignInUrl(body.signInUrl, baseUrl);
          }
          return body;
        },

        async "stagingTestControl:resetIdentityBaseline"(params: {
          role: "CLIENT" | "PROFESSIONAL";
          spec?: string;
        }) {
          assertControlCredentials();
          const current = requireActive(params?.spec);
          const res = await fetch(`${baseUrl}/api/internal/test-control`, {
            method: "POST",
            headers: getTestControlHeaders({
              "x-test-control-grant": current.grantToken,
            }),
            body: JSON.stringify({
              action: "reset-identity-baseline",
              runId: current.runId,
              role: params.role,
            }),
          });
          if (!res.ok) {
            throw new Error(
              `resetIdentityBaseline failed with ${formatControlError(res.status, res.headers, await res.text())}`,
            );
          }
          const body = await res.json();
          // Redacted projection: only opaque result fields cross the task boundary
          return {
            leaseId: body.leaseId,
            slot: body.slot,
            userId: body.userId,
            role: body.role,
            signInUrl: normalizeSignInUrl(body.signInUrl, baseUrl),
            state: body.projection?.onboardingState || "NOT_STARTED",
          };
        },

        async "stagingTestControl:seedMpesa"(params: {
          amount: number;
          phoneNumber: string;
          checkoutRequestId?: string;
          merchantRequestId?: string;
          spec?: string;
        }) {
          assertControlCredentials();
          const current = requireActive(params?.spec);
          const res = await fetch(`${baseUrl}/api/internal/test-control`, {
            method: "POST",
            headers: getTestControlHeaders({
              "x-test-control-grant": current.grantToken,
            }),
            body: JSON.stringify({
              action: "seed-mpesa-transaction",
              runId: current.runId,
              amount: params.amount,
              phoneNumber: params.phoneNumber,
              checkoutRequestId: params.checkoutRequestId,
              merchantRequestId: params.merchantRequestId,
            }),
          });
          if (!res.ok) {
            throw new Error(
              `seedMpesa failed with ${formatControlError(res.status, res.headers, await res.text())}`,
            );
          }
          return res.json();
        },

        async "stagingTestControl:postMpesaWebhook"(params: {
          payload: Record<string, unknown>;
        }) {
          assertControlCredentials();
          const res = await fetch(
            `${baseUrl}/api/webhooks/mpesa/stk-callback`,
            {
              method: "POST",
              headers: getTestControlHeaders(),
              body: JSON.stringify(params.payload),
            },
          );
          const text = await res.text();
          let body: unknown = null;
          try {
            body = JSON.parse(text);
          } catch {
            body = text;
          }
          return {
            status: res.status,
            body,
          };
        },

        async "stagingTestControl:seedScenario"(params: {
          scenario: string;
          payload?: Record<string, unknown>;
          spec?: string;
        }) {
          assertControlCredentials();
          const current = requireActive(params?.spec);
          const res = await fetch(`${baseUrl}/api/internal/test-control`, {
            method: "POST",
            headers: getTestControlHeaders({
              "x-test-control-grant": current.grantToken,
            }),
            body: JSON.stringify({
              action: "seed-scenario",
              runId: current.runId,
              scenario: params.scenario,
              payload: params.payload || {},
            }),
          });
          if (!res.ok) {
            throw new Error(
              `seedScenario failed with ${formatControlError(res.status, res.headers, await res.text())}`,
            );
          }
          return res.json();
        },

        async "stagingTestControl:getProjection"(params?: { spec?: string }) {
          assertControlCredentials();
          const current = requireActive(params?.spec);
          const res = await fetch(`${baseUrl}/api/internal/test-control`, {
            method: "POST",
            headers: getTestControlHeaders({
              "x-test-control-grant": current.grantToken,
            }),
            body: JSON.stringify({
              action: "get-run-projection",
              runId: current.runId,
            }),
          });
          if (!res.ok) {
            throw new Error(
              `getProjection failed with ${formatControlError(res.status, res.headers, await res.text())}`,
            );
          }
          const raw = await res.json();
          return redactProjection(raw);
        },

        async "stagingTestControl:cleanup"(params?: { spec?: string }) {
          assertControlCredentials();
          if (!active) {
            return { cleaned: true };
          }
          if (params?.spec && active.spec !== params.spec) {
            return { cleaned: true };
          }
          const { runId, grantToken } = active;
          active = null;
          const res = await fetch(`${baseUrl}/api/internal/test-control`, {
            method: "POST",
            headers: getTestControlHeaders({
              "x-test-control-grant": grantToken,
            }),
            body: JSON.stringify({
              action: "cleanup-run",
              runId,
            }),
          });
          if (!res.ok) {
            throw new Error(
              `cleanup failed with ${formatControlError(res.status, res.headers, await res.text())}`,
            );
          }
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
