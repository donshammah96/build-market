import {
  startNatsServer,
  stopNatsServer,
  type TestNatsServer,
} from "./nats-test-server.js";

let server: TestNatsServer;

export async function setup(): Promise<void> {
  server = await startNatsServer();
  process.env.NATS_TEST_URL = server.url;
}

export async function teardown(): Promise<void> {
  if (server) {
    await stopNatsServer(server);
  }
}
