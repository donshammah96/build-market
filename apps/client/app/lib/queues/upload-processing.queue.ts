import { Queue, type JobsOptions } from "bullmq";
import { createRedisConnection } from "@build/queue-server";

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

export const uploadProcessingQueue = new Queue<
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

export async function enqueueImageUploadProcessingJob(
  data: ImageUploadProcessingJobData,
  opts?: JobsOptions,
) {
  return uploadProcessingQueue.add(
    UploadProcessingJobNames.PROCESS_IMAGE_UPLOAD,
    data,
    {
      jobId: data.uploadId,
      ...opts,
    },
  );
}
