import { spawn, type ChildProcess } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import net from "node:net";
import { connect } from "nats";

/**
 * Spawns a real `nats-server` process with JetStream enabled, on an
 * ephemeral free port, with its own throwaway store directory.
 *
 * Why a real server instead of mocking the `nats` client: the behavior
 * under test — redelivery counts, ack-wait timeouts, max-deliver
 * termination, msgId deduplication windows — all live in the server, not
 * in the client library. Mocking `nats` would just test that our code
 * calls the mock the way we wrote the mock, which proves nothing.
 *
 * Requires the `nats-server` binary on PATH. Install it with:
 *   brew install nats-server          (macOS)
 *   or download from https://github.com/nats-io/nats-server/releases
 *
 * If you'd rather not install a local binary, swap this for testcontainers
 * against the official `nats:latest` image (`docker run nats -js`) — same
 * interface, just replace startNatsServer()'s spawn() call with a
 * container start. Not included here since it adds a Docker dependency
 * to CI that a spawned binary doesn't need.
 */

export interface TestNatsServer {
  port: number;
  url: string;
  storeDir: string;
  process: ChildProcess;
}

function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, () => {
      const address = srv.address();
      if (address && typeof address === "object") {
        const port = address.port;
        srv.close(() => resolve(port));
      } else {
        srv.close(() => reject(new Error("Could not determine free port")));
      }
    });
    srv.on("error", reject);
  });
}

async function waitForServer(url: string, timeoutMs = 10_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let lastError: unknown;

  while (Date.now() < deadline) {
    try {
      const nc = await connect({ servers: url, timeout: 500 });
      await nc.close();
      return;
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
  }

  throw new Error(
    `nats-server did not become reachable at ${url} within ${timeoutMs}ms: ${lastError}`,
  );
}

export async function startNatsServer(): Promise<TestNatsServer> {
  const port = await getFreePort();
  const storeDir = mkdtempSync(join(tmpdir(), "nats-integration-"));
  const url = `nats://127.0.0.1:${port}`;

  const proc = spawn(
    "nats-server",
    ["-js", "-p", String(port), "-sd", storeDir, "-a", "127.0.0.1"],
    { stdio: process.env.NATS_TEST_VERBOSE ? "inherit" : "ignore" },
  );

  proc.on("error", (error) => {
    throw new Error(
      `Failed to spawn nats-server. Is it installed and on PATH? ${error.message}`,
    );
  });

  await waitForServer(url);

  return { port, url, storeDir, process: proc };
}

export async function stopNatsServer(server: TestNatsServer): Promise<void> {
  server.process.kill("SIGTERM");
  await new Promise<void>((resolve) => {
    server.process.once("exit", () => resolve());
    // Fallback in case the process ignores SIGTERM
    setTimeout(() => {
      server.process.kill("SIGKILL");
      resolve();
    }, 3000);
  });
  rmSync(server.storeDir, { recursive: true, force: true });
}
