/**
 * Comprehensive metrics and observability utilities
 */

import { MetricData } from "./types.js";
import { Logger } from "./logger.js";

export type MetricType = "counter" | "gauge" | "histogram" | "summary";

export interface Metric {
  name: string;
  type: MetricType;
  value: number;
  tags?: Record<string, string>;
  timestamp: number;
}

export interface HistogramBucket {
  le: number; // Less than or equal to
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
  quantiles: Map<number, number>; // p50, p95, p99, etc.
}

export const MAX_HISTOGRAM_SAMPLES = 1000;

/**
 * Metrics collector and aggregator
 */
export class MetricsCollector {
  private counters = new Map<string, number>();
  private gauges = new Map<string, number>();
  private histograms = new Map<string, number[]>();
  private readonly logger?: Logger;

  // Default histogram buckets (in milliseconds for duration metrics)
  private readonly defaultBuckets = [
    10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000,
  ];

  constructor(logger?: Logger) {
    this.logger = logger;
  }

  /**
   * Increment a counter
   */
  incrementCounter(
    name: string,
    value: number = 1,
    tags?: Record<string, string>,
  ): void {
    const key = this.getKey(name, tags);
    const current = this.counters.get(key) || 0;
    this.counters.set(key, current + value);
  }

  /**
   * Set a gauge value
   */
  setGauge(name: string, value: number, tags?: Record<string, string>): void {
    const key = this.getKey(name, tags);
    this.gauges.set(key, value);
  }

  /**
   * Record a histogram value
   */
  recordHistogram(
    name: string,
    value: number,
    tags?: Record<string, string>,
  ): void {
    const key = this.getKey(name, tags);
    const values = this.histograms.get(key) || [];
    values.push(value);
    if (values.length > MAX_HISTOGRAM_SAMPLES) {
      values.shift();
    }
    this.histograms.set(key, values);
  }

  /**
   * Record operation duration
   */
  async recordDuration<T>(
    operation: () => Promise<T>,
    name: string,
    tags?: Record<string, string>,
  ): Promise<T> {
    const startTime = Date.now();
    try {
      const result = await operation();
      const duration = Date.now() - startTime;
      this.recordHistogram(`${name}.duration`, duration, tags);
      this.incrementCounter(`${name}.success`, 1, tags);
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.recordHistogram(`${name}.duration`, duration, tags);
      this.incrementCounter(`${name}.error`, 1, tags);
      throw error;
    }
  }

  /**
   * Get histogram statistics
   */
  getHistogramStats(
    name: string,
    tags?: Record<string, string>,
  ): HistogramData | undefined {
    const key = this.getKey(name, tags);
    const values = this.histograms.get(key);

    if (!values || values.length === 0) {
      return undefined;
    }

    const sorted = [...values].sort((a, b) => a - b);
    const sum = sorted.reduce((acc, val) => acc + val, 0);

    const buckets: HistogramBucket[] = this.defaultBuckets.map((le) => ({
      le,
      count: sorted.filter((v) => v <= le).length,
    }));

    return {
      count: sorted.length,
      sum,
      buckets,
    };
  }

  /**
   * Get summary statistics with quantiles
   */
  getSummaryStats(
    name: string,
    tags?: Record<string, string>,
  ): SummaryData | undefined {
    const key = this.getKey(name, tags);
    const values = this.histograms.get(key);

    if (!values || values.length === 0) {
      return undefined;
    }

    const sorted = [...values].sort((a, b) => a - b);
    const sum = sorted.reduce((acc, val) => acc + val, 0);

    const quantiles = new Map<number, number>();
    const calculateQuantile = (p: number): number => {
      const index = Math.ceil((p / 100) * sorted.length) - 1;
      return sorted[Math.max(0, index)] ?? 0;
    };

    quantiles.set(0.5, calculateQuantile(50)); // p50
    quantiles.set(0.75, calculateQuantile(75)); // p75
    quantiles.set(0.95, calculateQuantile(95)); // p95
    quantiles.set(0.99, calculateQuantile(99)); // p99
    quantiles.set(0.999, calculateQuantile(99.9)); // p999

    return {
      count: sorted.length,
      sum,
      quantiles,
    };
  }

  /**
   * Get all metrics as a snapshot
   */
  getMetrics(): Metric[] {
    const metrics: Metric[] = [];
    const now = Date.now();

    // Counters
    this.counters.forEach((value, key) => {
      const { name, tags } = this.parseKey(key);
      metrics.push({
        name,
        type: "counter",
        value,
        tags,
        timestamp: now,
      });
    });

    // Gauges
    this.gauges.forEach((value, key) => {
      const { name, tags } = this.parseKey(key);
      metrics.push({
        name,
        type: "gauge",
        value,
        tags,
        timestamp: now,
      });
    });

    // Keep a bounded aggregate in the bulk snapshot. Detailed buckets and
    // quantiles remain available through getHistogramStats/getSummaryStats.
    this.histograms.forEach((values, key) => {
      const { name, tags } = this.parseKey(key);
      const average = values.length
        ? values.reduce((sum, value) => sum + value, 0) / values.length
        : 0;
      metrics.push({
        name: `${name}.avg`,
        type: "histogram",
        value: average,
        tags,
        timestamp: now,
      });
    });

    return metrics;
  }

  /**
   * Reset all metrics
   */
  reset(): void {
    this.counters.clear();
    this.gauges.clear();
    this.histograms.clear();
  }

  /**
   * Create a metric key with tags
   */
  private getKey(name: string, tags?: Record<string, string>): string {
    if (!tags || Object.keys(tags).length === 0) {
      return name;
    }
    const tagString = Object.entries(tags)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
      .join(",");
    return `${name}{${tagString}}`;
  }

  /**
   * Parse a metric key back to name and tags
   */
  private parseKey(key: string): {
    name: string;
    tags?: Record<string, string>;
  } {
    const match = key.match(/^([^{]+)(?:\{(.+)\})?$/);
    if (!match || !match[1]) {
      return { name: key };
    }

    const name = match[1];
    const tagString = match[2];

    if (!tagString) {
      return { name };
    }

    const tags: Record<string, string> = {};
    tagString.split(",").forEach((pair) => {
      const [k, v] = pair.split("=");
      if (k && v) {
        tags[k] = v;
      }
    });

    return { name, tags };
  }
}

/**
 * Global metrics collector instance
 */
let globalMetricsCollector: MetricsCollector | undefined;

export function getGlobalMetricsCollector(): MetricsCollector {
  if (!globalMetricsCollector) {
    globalMetricsCollector = new MetricsCollector();
  }
  return globalMetricsCollector;
}

export function setGlobalMetricsCollector(collector: MetricsCollector): void {
  globalMetricsCollector = collector;
}
