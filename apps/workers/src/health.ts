import http, { type IncomingMessage, type ServerResponse } from "node:http";

export interface HealthCheckOptions {
  port: number;
  checkRedis?: () => Promise<boolean>;
  checkPostgres?: () => Promise<boolean>;
  checkWorkers?: () => boolean;
  checkNats?: () => boolean;
  isShuttingDown: () => boolean;
}

export function startHealthServer(options: HealthCheckOptions) {
  const server = http.createServer(
    async (req: IncomingMessage, res: ServerResponse) => {
      const url = req.url ? req.url.split("?")[0] : "";
      if (
        url === "/" ||
        url === "/healthz" ||
        url === "/health" ||
        url === "/ping"
      ) {
        if (options.isShuttingDown()) {
          res.writeHead(503, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ status: "shutting_down" }));
          return;
        }

        try {
          const redisOk = options.checkRedis
            ? await options.checkRedis()
            : true;
          const postgresOk = options.checkPostgres
            ? await options.checkPostgres()
            : true;
          const workersOk = options.checkWorkers
            ? options.checkWorkers()
            : true;
          const natsOk = options.checkNats ? options.checkNats() : true;

          const isHealthy = redisOk && postgresOk && workersOk && natsOk;

          const payload = {
            status: isHealthy ? "ok" : "degraded",
            redis: redisOk ? "connected" : "disconnected",
            postgres: postgresOk ? "connected" : "disconnected",
            workers: workersOk ? "active" : "stalled",
            nats: natsOk ? "connected" : "disconnected",
            uptime: process.uptime(),
            timestamp: new Date().toISOString(),
          };

          res.writeHead(isHealthy ? 200 : 503, {
            "Content-Type": "application/json",
          });
          res.end(JSON.stringify(payload));
          return;
        } catch {
          // Fall through to 503
        }

        res.writeHead(503, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            status: "unhealthy",
            timestamp: new Date().toISOString(),
          }),
        );
        return;
      }

      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Not Found");
    },
  );

  server.listen(options.port, "0.0.0.0", () => {
    console.info(
      `[WorkerHealth] Healthcheck probe listening on 0.0.0.0:${options.port} (/, /healthz)`,
    );
  });

  return server;
}
