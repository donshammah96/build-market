/**
 * @build/messaging-server
 *
 * Exports shared messaging contracts (pure types only).
 *
 * What belongs here: actor shapes, domain error codes, result wrappers,
 * and DTO types that need to be shared across packages or apps.
 *
 * What does NOT belong here: Zod schemas, Prisma select objects,
 * validation config, repository or service implementations. Those are
 * app-owned and live in apps/client.
 */
export type {
  MessagingActor,
  MessagingDomainErrorCode,
  MessagingResult,
  MessagingParticipantRole,
  MessageStatus,
  ThreadStatus,
} from "./contracts.js";
