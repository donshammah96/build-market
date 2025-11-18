import { NextResponse } from "next/server";

/**
 * GET /api/messaging
 * Health check for messaging API proxy
 */
export async function GET() {
  const MESSAGING_SERVICE_URL = process.env.MESSAGING_SERVICE_URL || "http://localhost:3010";
  
  try {
    // Check if messaging service is reachable
    const response = await fetch(`${MESSAGING_SERVICE_URL}/health`, {
      method: "GET",
    });

    const isHealthy = response.ok;
    const serviceData = await response.json().catch(() => ({}));

    return NextResponse.json({
      success: true,
      messagingProxy: "healthy",
      messagingService: isHealthy ? "healthy" : "unavailable",
      serviceUrl: MESSAGING_SERVICE_URL,
      serviceDetails: serviceData,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        messagingProxy: "healthy",
        messagingService: "unavailable",
        serviceUrl: MESSAGING_SERVICE_URL,
        error: "Cannot reach messaging service",
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    );
  }
}

