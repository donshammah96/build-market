export interface DatadogBatchSinkOptions {
  enabled: boolean;
  apiKey?: string;
  site: string;
  service: string;
  environment: string;
  version?: string;
  fetchImpl?: typeof fetch;
  baseUrl?: string;
  now?: () => number;
  maxQueueRecords?: number;
  maxBatchRecords?: number;
  maxBatchBytes?: number;
  flushIntervalMs?: number;
  maxRetries?: number;
  retryBaseDelayMs?: number;
}

export const DATADOG_DEFAULT_MAX_QUEUE_RECORDS = 10_000;
export const DATADOG_DEFAULT_MAX_BATCH_RECORDS = 500;
export const DATADOG_DEFAULT_MAX_BATCH_BYTES = 4_500_000;
export const DATADOG_DEFAULT_MAX_RETRIES = 3;
export const DATADOG_DEFAULT_RETRY_BASE_DELAY_MS = 250;

function isTransientStatus(status: number): boolean {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

function delay(ms: number): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class DatadogBatchSink {
  private readonly queue: Record<string, unknown>[] = [];
  private readonly fetchImpl: typeof fetch;
  private readonly now: () => number;
  private readonly maxQueueRecords: number;
  private readonly maxBatchRecords: number;
  private readonly maxBatchBytes: number;
  private readonly flushIntervalMs: number;
  private readonly maxRetries: number;
  private readonly retryBaseDelayMs: number;
  private readonly endpoint: string;
  private flushPromise: Promise<void> | undefined;
  private flushTimer: ReturnType<typeof setTimeout> | undefined;
  private closed = false;

  public droppedRecords = 0;

  constructor(private readonly options: DatadogBatchSinkOptions) {
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.now = options.now ?? Date.now;
    this.maxQueueRecords =
      options.maxQueueRecords ?? DATADOG_DEFAULT_MAX_QUEUE_RECORDS;
    this.maxBatchRecords = Math.min(
      options.maxBatchRecords ?? DATADOG_DEFAULT_MAX_BATCH_RECORDS,
      1_000,
    );
    this.maxBatchBytes = Math.min(
      options.maxBatchBytes ?? DATADOG_DEFAULT_MAX_BATCH_BYTES,
      5_000_000,
    );
    this.flushIntervalMs = options.flushIntervalMs ?? 1_000;
    this.maxRetries = options.maxRetries ?? DATADOG_DEFAULT_MAX_RETRIES;
    this.retryBaseDelayMs =
      options.retryBaseDelayMs ?? DATADOG_DEFAULT_RETRY_BASE_DELAY_MS;
    this.endpoint =
      options.baseUrl ?? `https://http-intake.logs.${options.site}/api/v2/logs`;
  }

  get queuedRecords(): number {
    return this.queue.length;
  }

  write(record: Record<string, unknown>): void {
    if (!this.options.enabled || !this.options.apiKey) return;

    if (this.closed || this.queue.length >= this.maxQueueRecords) {
      this.droppedRecords += 1;
      return;
    }

    this.queue.push(record);
    if (this.flushIntervalMs > 0 && !this.flushTimer) {
      this.flushTimer = setTimeout(() => {
        this.flushTimer = undefined;
        void this.flush();
      }, this.flushIntervalMs);
    }
  }

  async flush(deadlineMs = 10_000): Promise<void> {
    if (!this.options.enabled || !this.options.apiKey) return;
    if (this.flushPromise) return this.flushPromise;

    const deadline = this.now() + deadlineMs;
    this.flushPromise = (async () => {
      while (this.queue.length > 0 && this.now() < deadline) {
        const batch = this.takeBatch();
        if (batch.length === 0) continue;
        try {
          await this.sendBatch(batch, deadline);
        } catch {
          this.droppedRecords += batch.length;
        }
      }
    })().finally(() => {
      this.flushPromise = undefined;
      if (this.queue.length > 0 && !this.closed && this.flushIntervalMs > 0) {
        this.flushTimer = setTimeout(() => {
          this.flushTimer = undefined;
          void this.flush();
        }, this.flushIntervalMs);
      }
    });

    return this.flushPromise;
  }

  async close(deadlineMs = 10_000): Promise<void> {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = undefined;
    }
    this.closed = true;
    await this.flush(deadlineMs);
    if (this.queue.length > 0) {
      this.droppedRecords += this.queue.length;
      this.queue.length = 0;
    }
  }

  private takeBatch(): Record<string, unknown>[] {
    const batch: Record<string, unknown>[] = [];
    let size = 2;

    while (batch.length < this.maxBatchRecords && this.queue.length > 0) {
      const candidate = this.toDatadogRecord(this.queue[0]!);
      const candidateSize = Buffer.byteLength(
        JSON.stringify(candidate),
        "utf8",
      );
      const nextSize = size + candidateSize + (batch.length > 0 ? 1 : 0);

      if (batch.length > 0 && nextSize > this.maxBatchBytes) break;
      this.queue.shift();

      if (candidateSize + 2 > this.maxBatchBytes) {
        this.droppedRecords += 1;
        continue;
      }

      batch.push(candidate);
      size = nextSize;
    }

    return batch;
  }

  private toDatadogRecord(
    record: Record<string, unknown>,
  ): Record<string, unknown> {
    const ddtags = [
      `env:${this.options.environment}`,
      `service:${this.options.service}`,
      ...(this.options.version ? [`version:${this.options.version}`] : []),
    ].join(",");
    const traceId = record.traceId ?? record["dd.trace_id"];
    const spanId = record.spanId ?? record["dd.span_id"];

    return {
      ...record,
      service: this.options.service,
      ddsource: "nodejs",
      ddtags,
      timestamp: record.time ?? this.now(),
      ...(traceId ? { "dd.trace_id": traceId } : {}),
      ...(spanId ? { "dd.span_id": spanId } : {}),
    };
  }

  private async sendBatch(
    batch: Record<string, unknown>[],
    deadline: number,
  ): Promise<void> {
    const body = JSON.stringify(batch);
    let attempt = 0;

    while (true) {
      try {
        const response = await this.fetchImpl(this.endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "DD-API-KEY": this.options.apiKey!,
          },
          body,
        });

        if (response.ok) return;
        if (!isTransientStatus(response.status) || attempt >= this.maxRetries) {
          throw new Error(
            `Datadog log intake rejected batch: ${response.status}`,
          );
        }
      } catch (error) {
        if (attempt >= this.maxRetries || this.now() >= deadline) throw error;
      }

      attempt += 1;
      const remaining = deadline - this.now();
      const backoff = Math.min(
        this.retryBaseDelayMs * 2 ** (attempt - 1),
        Math.max(0, remaining),
      );
      await delay(backoff);
      if (this.now() >= deadline) {
        throw new Error("Datadog log flush deadline exceeded");
      }
    }
  }
}
