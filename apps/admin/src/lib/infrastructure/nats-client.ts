import { createProducer, type JetStreamProducer } from "@build/nats";
import { StructuredLogger } from "@build/resilience";
import { adminEnvConfig } from "./env";

const logger = new StructuredLogger("admin-nats-client");
let producer: JetStreamProducer | null = null;

export async function getAdminNatsProducer(): Promise<JetStreamProducer> {
  if (!producer) {
    producer = createProducer("admin-service", {
      ...(adminEnvConfig.NATS_URL ? { servers: adminEnvConfig.NATS_URL } : {}),
    });
    await producer.connect();
    logger.info("Admin NATS producer connected");
  }
  return producer;
}

export async function shutdownAdminNatsProducer(): Promise<void> {
  if (producer) {
    await producer.disconnect();
    producer = null;
    logger.info("Admin NATS producer shutdown complete");
  }
}
