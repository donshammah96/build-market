import { Queue, type JobsOptions } from "bullmq";
import { createRedisConnection } from "@build/queue-server";
import { env, envConfig } from "@/app/lib/infrastructure/env";

export type ImageUploadProcessingJobData = {
  uploadId: string;
  fieldName: string;
  actor: {
    userId: string;
    correlationId?: string;
  };
  file: {
    originalName: string;
    mimeType: string;
    size: number;
    bufferBase64: string;
  };
  options: {
    context: "image" | "document" | "avatar" | "default";
    generateThumbnail: boolean;
    temporary: boolean;
    tempExpiryHours: number;
  };
  consent: {
    ipAddress?: string;
    userAgent?: string;
  };
};

export const UploadProcessingJobNames = {
  PROCESS_IMAGE_UPLOAD: "process-image-upload",
} as const;
type UploadProcessingJobName =
  (typeof UploadProcessingJobNames)[keyof typeof UploadProcessingJobNames];

/**
 * Singleton instance — lazily created to avoid eager Redis connections
 * during `next build` or CI smoke gates where REDIS_URL is absent.
 */
let uploadQueueInstance: Queue<
  ImageUploadProcessingJobData,
  unknown,
  UploadProcessingJobName
> | null = null;

/**
 * Lazy initialization getter for the upload processing queue.
 * Safely handles Next.js build phases and CI environments without Redis.
 */
function getUploadProcessingQueue(): Queue<
  ImageUploadProcessingJobData,
  unknown,
  UploadProcessingJobName
> {
  // Guard 1: Next.js static build phase
  if (env.isBuildPhase) {
    return {
      add: async () => undefined,
      close: async () => undefined,
    } as unknown as Queue<
      ImageUploadProcessingJobData,
      unknown,
      UploadProcessingJobName
    >;
  }

  // Guard 2: Belt-and-suspenders for CI or local dev without Redis
  if (!envConfig.redis.url || envConfig.jobs.disableBackgroundJobs) {
    return {
      add: async () => undefined,
      close: async () => undefined,
    } as unknown as Queue<
      ImageUploadProcessingJobData,
      unknown,
      UploadProcessingJobName
    >;
  }

  // Guard 3: Lazy instantiation (Singleton)
  if (!uploadQueueInstance) {
    uploadQueueInstance = new Queue<
      ImageUploadProcessingJobData,
      unknown,
      UploadProcessingJobName
    >("uploads-image-processing", {
      connection: createRedisConnection(),
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: "exponential", delay: 2_000 },
        removeOnComplete: { age: 60 * 60, count: 1_000 },
        removeOnFail: { age: 24 * 60 * 60 },
      },
    });
  }

  return uploadQueueInstance;
}

/** @deprecated Use {@link getUploadProcessingQueue} instead. */
export const uploadProcessingQueue = {
  get add() {
    return getUploadProcessingQueue().add.bind(getUploadProcessingQueue());
  },
  get close() {
    return getUploadProcessingQueue().close.bind(getUploadProcessingQueue());
  },
} as unknown as Queue<
  ImageUploadProcessingJobData,
  unknown,
  UploadProcessingJobName
>;

export { getUploadProcessingQueue };

export async function enqueueImageUploadProcessingJob(
  data: ImageUploadProcessingJobData,
  opts?: JobsOptions,
) {
  const queue = getUploadProcessingQueue();
  return queue.add(UploadProcessingJobNames.PROCESS_IMAGE_UPLOAD, data, {
    jobId: data.uploadId,
    ...opts,
  });
}
