import { Queue, type JobsOptions } from "bullmq";
import { getQueueConnectionOptions } from "./backend.js";
import { QueueRetentionPolicies } from "./retention.js";

export interface NewsletterEspSyncJobData {
  subscriberId: string;
  action: "subscribe" | "unsubscribe";
}

export interface NewsletterConfirmationEmailJobData {
  subscriberId: string;
  email: string;
  confirmationToken: string;
  unsubscribeToken: string;
}

export const NEWSLETTER_QUEUE_NAMES = {
  ESP_SYNC: "newsletter-esp-sync",
  CONFIRMATION_EMAIL: "newsletter-confirmation-email",
} as const;

let espSyncQueueInstance: Queue<NewsletterEspSyncJobData> | null = null;
let confirmationEmailQueueInstance: Queue<NewsletterConfirmationEmailJobData> | null =
  null;

export function getNewsletterEspSyncQueue(): Queue<NewsletterEspSyncJobData> {
  if (!espSyncQueueInstance) {
    espSyncQueueInstance = new Queue<NewsletterEspSyncJobData>(
      NEWSLETTER_QUEUE_NAMES.ESP_SYNC,
      {
        connection: getQueueConnectionOptions(NEWSLETTER_QUEUE_NAMES.ESP_SYNC),
        defaultJobOptions: {
          attempts: 5,
          backoff: { type: "exponential", delay: 60_000 },
          ...QueueRetentionPolicies.STANDARD,
        },
      },
    );
  }
  return espSyncQueueInstance;
}

export function getNewsletterEmailQueue(): Queue<NewsletterConfirmationEmailJobData> {
  if (!confirmationEmailQueueInstance) {
    confirmationEmailQueueInstance =
      new Queue<NewsletterConfirmationEmailJobData>(
        NEWSLETTER_QUEUE_NAMES.CONFIRMATION_EMAIL,
        {
          connection: getQueueConnectionOptions(
            NEWSLETTER_QUEUE_NAMES.CONFIRMATION_EMAIL,
          ),
          defaultJobOptions: {
            attempts: 5,
            backoff: { type: "exponential", delay: 60_000 },
            ...QueueRetentionPolicies.STANDARD,
          },
        },
      );
  }
  return confirmationEmailQueueInstance;
}

export async function addNewsletterEspSyncJob(
  data: NewsletterEspSyncJobData,
  opts?: JobsOptions,
) {
  const queue = getNewsletterEspSyncQueue();
  return queue.add("sync-subscriber", data, opts);
}

export async function addNewsletterConfirmationEmailJob(
  data: NewsletterConfirmationEmailJobData,
  opts?: JobsOptions,
) {
  const queue = getNewsletterEmailQueue();
  return queue.add("send-confirmation", data, opts);
}
