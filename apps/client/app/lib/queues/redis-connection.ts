/**
 * Re-export the BullMQ connection factory from @build/queue-server.
 *
 * Consumers MUST call createRedisConnection() once per Queue or Worker
 * instantiation — BullMQ requires a dedicated ioredis connection per construct.
 * Do not share a single connection across multiple Queue/Worker instances.
 */
export { createRedisConnection } from "@build/queue-server";
