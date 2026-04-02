import { Worker, type ConnectionOptions, type Job } from "bullmq";
import { redisConnection } from "@build/queue-server";
import {
  UploadProcessingJobNames,
  type ImageUploadProcessingJobData,
} from "@/app/lib/queues/upload-processing.queue";
import { processImageUploadJob } from "@/app/workers/uploads/processor";

export const imageUploadWorker = new Worker<ImageUploadProcessingJobData>(
  "uploads-image-processing",
  async (job: Job<ImageUploadProcessingJobData>) => {
    if (job.name !== UploadProcessingJobNames.PROCESS_IMAGE_UPLOAD) {
      return { skipped: true };
    }

    await processImageUploadJob(job.data);
    return { uploadId: job.data.uploadId };
  },
  {
    connection: redisConnection as ConnectionOptions,
    concurrency: 2,
    limiter: {
      max: 20,
      duration: 60_000,
    },
  },
);
