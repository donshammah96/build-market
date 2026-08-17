import http, { type IncomingMessage, type ServerResponse } from "node:http";

export interface HealthCheckOptions {
  port: number;
  checkRedis: () => Promise<boolean>;
  checkWorkers?: () => boolean;
  checkNats?: () => boolean;
  isShuttingDown: () => boolean;
}

export function startHealthServer(options: HealthCheckOptions) {
  const server = http.createServer(
    async (req: IncomingMessage, res: ServerResponse) => {
      if (req.url === "/healthz" || req.url === "/health") {
        if (options.isShuttingDown()) {
          res.writeHead(503, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ status: "shutting_down" }));
          return;
        }

        try {
          const redisOk = await options.checkRedis();
          const workersOk = options.checkWorkers
            ? options.checkWorkers()
            : true;
          const natsOk = options.checkNats ? options.checkNats() : true;

          if (redisOk && workersOk && natsOk) {
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(
              JSON.stringify({
                status: "ok",
                redis: "connected",
                workers: "active",
                nats: "connected",
                uptime: process.uptime(),
                timestamp: new Date().toISOString(),
              }),
            );
            return;
          }

          res.writeHead(503, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({
              status: "degraded",
              redis: redisOk ? "connected" : "disconnected",
              workers: workersOk ? "active" : "stalled",
              nats: natsOk ? "connected" : "disconnected",
            }),
          );
          return;
        } catch {
          // Fall through to 503
        }

        res.writeHead(503, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            status: "unhealthy",
            redis: "error",
          }),
        );
        return;
      }

      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Not Found");
    },
  );

  server.listen(options.port, () => {
    console.info(
      `[WorkerHealth] Healthcheck probe listening on port ${options.port} (/healthz)`,
    );
  });

  return server;
}
