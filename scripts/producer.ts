import { createServiceClient } from "../packages/nats/src/client";
import { createProducer } from "@build/nats";

async function main() {
  console.log("[example] Starting producer...");

  // Create a service-scoped NATS client (optional - producer.connect() will create one too)
  const client = await createServiceClient("example-producer");

  const producer = createProducer("example-producer");
  await producer.connect();

  const payload = {
    now: new Date().toISOString(),
    text: "hello from example producer",
  };

  try {
    await producer.publish("test.example", payload);
    console.log("[example] Published message to 'test.example'");
  } catch (err) {
    console.error("[example] Publish failed:", err);
    process.exitCode = 1;
  }

  // Allow logs/ack to flush then close
  setTimeout(async () => {
    try {
      await client.close();
    } catch {}
    process.exit();
  }, 500);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
