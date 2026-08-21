import { Queue, type JobsOptions } from "bullmq";
import { createRedisConnection } from "@build/redis/tcp";

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

export type UploadProcessingJobName =
  (typeof UploadProcessingJobNames)[keyof typeof UploadProcessingJobNames];

export const UPLOADS_PROCESSING_QUEUE_NAME = "uploads-image-processing";

let uploadQueueInstance: Queue<
  ImageUploadProcessingJobData,
  unknown,
  UploadProcessingJobName
> | null = null;

export function getUploadProcessingQueue(): Queue<
  ImageUploadProcessingJobData,
  unknown,
  UploadProcessingJobName
> {
  if (!uploadQueueInstance) {
    uploadQueueInstance = new Queue<
      ImageUploadProcessingJobData,
      unknown,
      UploadProcessingJobName
    >(UPLOADS_PROCESSING_QUEUE_NAME, {
      connection: createRedisConnection(),
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: "exponential", delay: 2_000 },
        removeOnComplete: { age: 3600, count: 1000 },
        removeOnFail: { age: 24 * 3600 },
      },
    });
  }
  return uploadQueueInstance;
}

export async function addUploadProcessingJob(
  data: ImageUploadProcessingJobData,
  opts?: JobsOptions,
) {
  const queue = getUploadProcessingQueue();
  return queue.add(UploadProcessingJobNames.PROCESS_IMAGE_UPLOAD, data, {
    jobId: data.uploadId,
    ...opts,
  });
}
