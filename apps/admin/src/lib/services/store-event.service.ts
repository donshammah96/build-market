/**
 * Store Event Sourcing Service.
 *
 * Manages the StoreEvent log with version-based optimistic locking.
 * Each mutation appends an event and increments the store version atomically
 * within a Serializable transaction.
 *
 * Domain-specific to the Store entity — not generic by design.
 */
import { prisma } from "@build/db";
import { Prisma, StoreEventType } from "@prisma/client";

export class StoreEventService {
  /**
   * Append an event to the store's event log and increment the store version.
   * Must be called within an existing Prisma transaction.
   *
   * /param tx - Active transaction client
   * /param storeId - Target store
   * /param type - Event type enum value
   * /param payload - Event-specific data (changes, previous state, etc.)
   * /param metadata - Request context (IP, user agent, correlation ID)
   * /param createdBy - User ID performing the action
   * /param expectedVersion - Current version for optimistic lock check
   * /returns The new version number
   */
  static async append(
    tx: Prisma.TransactionClient,
    storeId: string,
    type: StoreEventType,
    payload: unknown,
    metadata: unknown,
    createdBy: string,
    expectedVersion: number,
  ): Promise<number> {
    const event = await tx.storeEvent.create({
      data: {
        storeId,
        type,
        payload: payload as Prisma.InputJsonValue,
        metadata: metadata as Prisma.InputJsonValue,
        version: expectedVersion + 1,
        createdBy,
      },
    });

    // Update store version for optimistic locking
    await tx.store.update({
      where: {
        id: storeId,
        version: expectedVersion, // Optimistic lock check
      },
      data: { version: { increment: 1 } },
    });

    return event.version;
  }

  /**
   * Get the current version of a store (for conflict response headers).
   */
  static async getCurrentVersion(storeId: string): Promise<number> {
    const store = await prisma.store.findUnique({
      where: { id: storeId },
      select: { version: true },
    });
    return store?.version ?? 0;
  }

  /**
   * Replay all events for a store in version order.
   * Useful for debugging, auditing, or rebuilding state.
   */
  static async replay(storeId: string): Promise<unknown[]> {
    const events = await prisma.storeEvent.findMany({
      where: { storeId },
      orderBy: { version: "asc" },
    });
    return events;
  }
}
