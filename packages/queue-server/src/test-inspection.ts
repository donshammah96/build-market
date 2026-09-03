import type { Queue } from "bullmq";
import type { Pool, Client } from "pg";
import { getQueueBackendType, type QueueBackendType } from "./backend.js";

export interface QueueJobInspectionRecord {
  id: string;
  name: string;
  stagingTestRunId: string;
  state: "waiting" | "active" | "completed" | "failed" | "delayed" | "unknown";
  attempts: number;
  data: Record<string, unknown>;
  failedReason?: string | null;
}

export interface QueueTestInspectorConfig {
  backend?: QueueBackendType;
  pgClient?: Pool | Client;
  queueFactory?: (queueName: string) => Queue;
}

export class QueueTestInspector {
  private backend: QueueBackendType;
  private pgClient?: Pool | Client;
  private queueFactory?: (queueName: string) => Queue;

  constructor(config?: QueueTestInspectorConfig) {
    this.backend = config?.backend ?? getQueueBackendType("test-control");
    this.pgClient = config?.pgClient;
    this.queueFactory = config?.queueFactory;
  }

  /**
   * Inspects and returns all jobs associated with a specific staging test run ID across either
   * PostgreSQL bullmq schema or Redis queue instances.
   */
  async inspectJobsByRun(
    stagingTestRunId: string,
    queueName: string,
  ): Promise<QueueJobInspectionRecord[]> {
    if (this.backend === "postgres") {
      return this.inspectPostgresJobs(stagingTestRunId, queueName);
    }
    return this.inspectRedisJobs(stagingTestRunId, queueName);
  }

  private async inspectPostgresJobs(
    stagingTestRunId: string,
    queueName: string,
  ): Promise<QueueJobInspectionRecord[]> {
    if (!this.pgClient) {
      throw new Error(
        "QueueTestInspector: pgClient must be provided for PostgreSQL queue inspection",
      );
    }

    const query = `
      SELECT
        id,
        name,
        data,
        opts,
        failedreason,
        processedon,
        finishedon
      FROM bullmq.jobs
      WHERE queue_name = $1
        AND (
          data ->> 'stagingTestRunId' = $2
          OR data -> 'testControl' ->> 'stagingTestRunId' = $2
        )
      ORDER BY id DESC;
    `;

    const result = await this.pgClient.query(query, [queueName, stagingTestRunId]);
    const records: QueueJobInspectionRecord[] = [];

    for (const row of result.rows) {
      const data = typeof row.data === "string" ? JSON.parse(row.data) : row.data || {};
      const runId =
        data?.stagingTestRunId ||
        data?.testControl?.stagingTestRunId;

      if (runId === stagingTestRunId) {
        let state: QueueJobInspectionRecord["state"] = "unknown";
        if (row.failedreason) {
          state = "failed";
        } else if (row.finishedon) {
          state = "completed";
        } else if (row.processedon) {
          state = "active";
        } else {
          state = "waiting";
        }

        records.push({
          id: String(row.id),
          name: row.name,
          stagingTestRunId: runId,
          state,
          attempts: data?.attemptsMade ?? 1,
          data,
          failedReason: row.failedreason,
        });
      }
    }

    return records;
  }

  private async inspectRedisJobs(
    stagingTestRunId: string,
    queueName: string,
  ): Promise<QueueJobInspectionRecord[]> {
    if (!this.queueFactory) {
      throw new Error(
        "QueueTestInspector: queueFactory must be provided for Redis queue inspection",
      );
    }

    const queue = this.queueFactory(queueName);
    const jobs = await queue.getJobs([
      "waiting",
      "active",
      "completed",
      "failed",
      "delayed",
    ]);

    const records: QueueJobInspectionRecord[] = [];

    for (const job of jobs) {
      const data = (job.data as Record<string, unknown>) || {};
      const runId =
        (data.stagingTestRunId as string) ||
        ((data.testControl as any)?.stagingTestRunId as string);

      if (runId === stagingTestRunId) {
        const state = (await job.getState()) as QueueJobInspectionRecord["state"];
        records.push({
          id: String(job.id),
          name: job.name,
          stagingTestRunId: runId,
          state,
          attempts: job.attemptsMade,
          data,
          failedReason: job.failedReason,
        });
      }
    }

    return records;
  }
}
