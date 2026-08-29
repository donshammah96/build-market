/**
 * Condition-based waiting utilities for Build Market async and integration tests.
 * Use to replace flaky setTimeout / arbitrary delays with predicate polling.
 */

type TruthyResult<T> = T | null | undefined | false;

/**
 * Generic condition polling utility.
 * Polls every 10ms until condition returns a truthy value or timeout expires.
 */
export function waitForCondition<T>(
  condition: () => TruthyResult<T> | Promise<TruthyResult<T>>,
  description: string,
  timeoutMs = 5000,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();

    const check = async () => {
      try {
        const result = await condition();
        if (result !== null && result !== undefined && result !== false) {
          return resolve(result as T);
        }
      } catch {
        // Condition threw an error; allow retrying until timeout
      }

      if (Date.now() - startTime > timeoutMs) {
        reject(
          new Error(
            `Timeout after ${timeoutMs}ms waiting for condition: ${description}`,
          ),
        );
      } else {
        setTimeout(check, 10);
      }
    };

    check();
  });
}

/**
 * Wait for an entity in the database to reach a specific state.
 * Useful for async job processing or NATS consumer updates.
 *
 * Example:
 * ```typescript
 * await waitForDbState(
 *   () => prisma.payment.findUnique({ where: { id: paymentId } }),
 *   (payment) => payment?.status === PaymentStatus.COMPLETED,
 *   'Payment status to be COMPLETED'
 * );
 * ```
 */
export async function waitForDbState<T>(
  query: () => Promise<T | null>,
  predicate: (item: T) => boolean,
  description: string,
  timeoutMs = 5000,
): Promise<T> {
  return waitForCondition<T>(
    async () => {
      const record = await query();
      if (record && predicate(record)) {
        return record;
      }
      return null;
    },
    description,
    timeoutMs,
  );
}

/**
 * Wait for an event to appear in an in-memory or mock event bus array.
 *
 * Example:
 * ```typescript
 * const event = await waitForPublishedEvent(
 *   natsMock.publishedEvents,
 *   (e) => e.subject === 'market.order.created',
 *   'Order created NATS event'
 * );
 * ```
 */
export function waitForPublishedEvent<
  T extends { subject?: string; type?: string },
>(
  eventStore: T[],
  predicate: (event: T) => boolean,
  description: string,
  timeoutMs = 5000,
): Promise<T> {
  return waitForCondition<T>(
    () => {
      const match = eventStore.find(predicate);
      return match ?? null;
    },
    description,
    timeoutMs,
  );
}
