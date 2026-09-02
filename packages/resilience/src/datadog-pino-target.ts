import { Writable } from "node:stream";
import {
  DatadogBatchSink,
  type DatadogBatchSinkOptions,
} from "./datadog-transport.js";

export interface DatadogPinoTarget extends Writable {
  sink: DatadogBatchSink;
}

export function createDatadogPinoTarget(
  options: DatadogBatchSinkOptions,
): DatadogPinoTarget {
  const sink = new DatadogBatchSink(options);
  const target = new Writable({
    write(chunk, _encoding, callback) {
      try {
        const record = JSON.parse(String(chunk)) as Record<string, unknown>;
        sink.write(record);
      } catch {
        // A malformed log line must not interrupt application work.
      }
      callback();
    },
    final(callback) {
      void sink.close().then(
        () => callback(),
        () => callback(),
      );
    },
  }) as DatadogPinoTarget;

  target.sink = sink;
  return target;
}
