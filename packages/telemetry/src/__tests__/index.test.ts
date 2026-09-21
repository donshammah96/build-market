import { describe, expect, it } from "vitest";
import * as telemetry from "../index.js";

describe("@build/telemetry public API", () => {
  it("exports tracing only and does not recreate a second logger", () => {
    expect(typeof telemetry.initTracing).toBe("function");
    expect("createLogger" in telemetry).toBe(false);
  });
});
