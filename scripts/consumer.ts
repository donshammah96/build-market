import { createServiceClient } from "@build/nats";
import { createConsumer } from "@build/nats";

async function main() {
  console.log("[example] Starting consumer...");

  const client = await createServiceClient("example-consumer");
  const consumer = createConsumer("example-consumer", "example-group");
  await consumer.connect();

  await consumer.subscribe([
    {
      subject: "test.example",
      handler: async (msg: any) => {
        console.log("[example] Received message:", msg.data);
      },
    },
  ]);

  console.log("[example] Consumer subscribed to 'test.example'. Running 30s...");

  // Run for 30s then shutdown
  setTimeout(async () => {
    try {
      await consumer.disconnect();
    } catch (err) {
      console.error("[example] Error disconnecting consumer:", err);
    }
    try {
      await client.close();
    } catch {}
    process.exit();
  }, 30000);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
