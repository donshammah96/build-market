import { NextRequest, NextResponse } from "next/server";
import { getRedisClient } from "@build/redis";

export async function GET(req: NextRequest) {
  try {
    const redis = getRedisClient();
    const logs = await redis.lrange("demo:logs", 0, 99);
    const parsedLogs = logs.map((log) => JSON.parse(log));
    return NextResponse.json(parsedLogs);
  } catch (err) {
    // Memory fallback if Redis is unconfigured or offline
    const g = global as any;
    const logs = g._demoLogs || [];
    return NextResponse.json(logs);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const redis = getRedisClient();
    await redis.del("demo:logs");
  } catch (err) {
    const g = global as any;
    g._demoLogs = [];
  }
  return NextResponse.json({ success: true });
}
