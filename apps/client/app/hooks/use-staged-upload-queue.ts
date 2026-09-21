"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import {
  BoundedUploadQueue,
  type UploadQueueItem,
  type UploadQueueOptions,
} from "@/app/lib/uploads/upload-queue";

export type UseStagedUploadQueueOptions = Omit<
  UploadQueueOptions,
  "onItemChange" | "onQueueComplete"
>;

export function useStagedUploadQueue(options?: UseStagedUploadQueueOptions) {
  const [items, setItems] = useState<UploadQueueItem[]>([]);
  const queueRef = useRef<BoundedUploadQueue | null>(null);

  useEffect(() => {
    queueRef.current = new BoundedUploadQueue({
      ...options,
      onItemChange: () => {
        if (queueRef.current) {
          setItems(queueRef.current.getAllItems());
        }
      },
      onQueueComplete: () => {
        if (queueRef.current) {
          setItems(queueRef.current.getAllItems());
        }
      },
    });
  }, [options]);

  const enqueue = useCallback((file: File) => {
    if (queueRef.current) {
      return queueRef.current.enqueue(file);
    }
    return "";
  }, []);

  const cancel = useCallback((id: string) => {
    if (queueRef.current) {
      return queueRef.current.cancel(id);
    }
    return false;
  }, []);

  const retry = useCallback((id: string) => {
    if (queueRef.current) {
      return queueRef.current.retry(id);
    }
    return false;
  }, []);

  const getDraftState = useCallback(() => {
    if (queueRef.current) {
      return queueRef.current.getDraftState();
    }
    return [];
  }, []);

  const remove = useCallback((id: string) => {
    if (queueRef.current) {
      return queueRef.current.remove(id);
    }
    return false;
  }, []);

  const clearFinished = useCallback(() => {
    if (queueRef.current) {
      return queueRef.current.clearFinished();
    }
    return 0;
  }, []);

  const isUploading = items.some(
    (i) => i.status === "uploading" || i.status === "queued",
  );
  const isComplete =
    items.length > 0 && items.every((i) => i.status === "completed");

  return {
    items,
    enqueue,
    cancel,
    retry,
    remove,
    clearFinished,
    getDraftState,
    isUploading,
    isComplete,
  };
}
