import { NextResponse } from "next/server";
import { prisma } from "@build/db";
import { apiError, apiSuccess, HttpStatus } from "@/app/lib/api/api-response";

/**
 * GET /api/messaging
 * Health check endpoint for the messaging subsystem.
 * Returns service status and basic statistics.
 */
export async function GET() {
  try {
    const [threadCount, messageCount] = await Promise.all([
      prisma.messageThread.count({ where: { deletedAt: null } }),
      prisma.message.count({ where: { deletedAt: null } }),
    ]);

    return apiSuccess(
      {
        status: "healthy",
        service: "messaging",
        timestamp: new Date().toISOString(),
        stats: {
          activeThreads: threadCount,
          totalMessages: messageCount,
        },
      },
      HttpStatus.OK,
    );
  } catch (error) {
    return apiError(
      "Messaging service is unavailable",
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  }
}
