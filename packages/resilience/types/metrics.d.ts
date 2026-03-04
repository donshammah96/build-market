/**
 * Comprehensive metrics and observability utilities
 */
import { Logger } from "./logger";
export type MetricType = "counter" | "gauge" | "histogram" | "summary";
export interface Metric {
  name: string;
  type: MetricType;
  value: number;
  tags?: Record<string, string>;
  timestamp: number;
}
export interface HistogramBucket {
  le: number;
  count: number;
}
export interface HistogramData {
  count: number;
  sum: number;
  buckets: HistogramBucket[];
}
export interface SummaryData {
  count: number;
  sum: number;
  quantiles: Map<number, number>;
}
/**
 * Metrics collector and aggregator
 */
export declare class MetricsCollector {
  private counters;
  private gauges;
  private histograms;
  private readonly logger?;
  private readonly defaultBuckets;
  constructor(logger?: Logger);
  /**
   * Increment a counter
   */
  incrementCounter(
    name: string,
    value?: number,
    tags?: Record<string, string>,
  ): void;
  /**
   * Set a gauge value
   */
  setGauge(name: string, value: number, tags?: Record<string, string>): void;
  /**
   * Record a histogram value
   */
  recordHistogram(
    name: string,
    value: number,
    tags?: Record<string, string>,
  ): void;
  /**
   * Record operation duration
   */
  recordDuration<T>(
    operation: () => Promise<T>,
    name: string,
    tags?: Record<string, string>,
  ): Promise<T>;
  /**
   * Get histogram statistics
   */
  getHistogramStats(
    name: string,
    tags?: Record<string, string>,
  ): HistogramData | undefined;
  /**
   * Get summary statistics with quantiles
   */
  getSummaryStats(
    name: string,
    tags?: Record<string, string>,
  ): SummaryData | undefined;
  /**
   * Get all metrics as a snapshot
   */
  getMetrics(): Metric[];
  /**
   * Reset all metrics
   */
  reset(): void;
  /**
   * Create a metric key with tags
   */
  private getKey;
  /**
   * Parse a metric key back to name and tags
   */
  private parseKey;
}
export declare function getGlobalMetricsCollector(): MetricsCollector;
export declare function setGlobalMetricsCollector(
  collector: MetricsCollector,
): void;
//# sourceMappingURL=metrics.d.ts.map
