declare module "blurhash" {
  export function decode(
    blurhash: string,
    width: number,
    height: number,
    punch?: number,
  ): Uint8ClampedArray;
  export function encode(
    pixels: Uint8ClampedArray,
    width: number,
    height: number,
    componentX: number,
    componentY: number,
  ): string;
}

declare module "@dnd-kit/core" {
  export const DndContext: any;
  export const PointerSensor: any;
  export const TouchSensor: any;
  export const KeyboardSensor: any;
  export const closestCenter: any;
  export const useSensor: any;
  export const useSensors: any;
  export type DragEndEvent = any;
}

declare module "@dnd-kit/sortable" {
  export const SortableContext: any;
  export const useSortable: any;
  export const rectSortingStrategy: any;
  export const sortableKeyboardCoordinates: any;
}

declare module "@dnd-kit/utilities" {
  export const CSS: any;
}

declare module "@dnd-kit/modifiers" {
  export const restrictToParentElement: any;
}

declare module "@next/bundle-analyzer" {
  import type { NextConfig } from "next";

  type AnalyzerPlugin = (config: NextConfig) => NextConfig;
  export default function bundleAnalyzer(options?: {
    enabled?: boolean;
  }): AnalyzerPlugin;
}

declare module "@opennextjs/cloudflare" {
  export function defineCloudflareConfig(config: Record<string, unknown>): any;
}

declare module "@opennextjs/cloudflare/overrides/incremental-cache/r2-incremental-cache" {
  const r2IncrementalCache: unknown;
  export default r2IncrementalCache;
}

declare module "@upstash/ratelimit" {
  export class Ratelimit {
    constructor(config: Record<string, unknown>);
    static slidingWindow(limit: number, window: string): unknown;
    limit(
      key: string,
    ): Promise<{
      success: boolean;
      limit: number;
      remaining: number;
      reset: number;
    }>;
  }
}
