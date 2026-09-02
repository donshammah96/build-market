export interface TailLogEntry {
  message?: unknown;
  level?: string;
  timestamp: number;
}

export interface TailExceptionEntry {
  name: string;
  message: string;
  timestamp: number;
}

export interface TraceItem {
  scriptName?: string;
  outcome?: string;
  eventTimestamp?: number;
  logs?: TailLogEntry[];
  exceptions?: TailExceptionEntry[];
}

export interface Env {
  DD_API_KEY: string;
  SERVICE_NAME?: string;
  ENVIRONMENT?: string;
  DD_SITE?: string;
  DD_SITE_HOST?: string;
}

export interface DatadogLogPayload {
  timestamp: number;
  status: string;
  message: string;
  service: string;
  ddsource: string;
  ddtags: string;
}

export function formatTailEvents(
  events: TraceItem[],
  env: Env,
): DatadogLogPayload[] {
  const logs: DatadogLogPayload[] = [];
  const defaultService = env.SERVICE_NAME || "buildmarket-cf-workers";
  const environment = env.ENVIRONMENT || "staging";

  for (const event of events) {
    const serviceName = event.scriptName || defaultService;
    const tags = `service:${serviceName},env:${environment}`;

    if (event.logs && Array.isArray(event.logs)) {
      for (const entry of event.logs) {
        const message = Array.isArray(entry.message)
          ? entry.message.join(" ")
          : typeof entry.message === "object" && entry.message !== null
            ? JSON.stringify(entry.message)
            : String(entry.message ?? "");

        logs.push({
          timestamp: entry.timestamp || Date.now(),
          status: entry.level || "info",
          message,
          service: serviceName,
          ddsource: "cloudflare-tail-worker",
          ddtags: tags,
        });
      }
    }

    if (event.exceptions && Array.isArray(event.exceptions)) {
      for (const exc of event.exceptions) {
        logs.push({
          timestamp: exc.timestamp || Date.now(),
          status: "error",
          message: `[Exception] ${exc.name || "Error"}: ${exc.message || ""}`,
          service: serviceName,
          ddsource: "cloudflare-tail-worker",
          ddtags: tags,
        });
      }
    }
  }

  return logs;
}

export default {
  async tail(events: TraceItem[], env: Env): Promise<void> {
    if (!env.DD_API_KEY) {
      return;
    }

    const logs = formatTailEvents(events, env);
    if (logs.length === 0) {
      return;
    }

    const siteHost = env.DD_SITE || env.DD_SITE_HOST || "us5.datadoghq.com";
    const intakeUrl = `https://http-intake.logs.${siteHost}/api/v2/logs`;

    try {
      await fetch(intakeUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "DD-API-KEY": env.DD_API_KEY,
        },
        body: JSON.stringify(logs),
      });
    } catch {
      // Fail-open: Tail log shipping must never throw uncaught exceptions
    }
  },
};
