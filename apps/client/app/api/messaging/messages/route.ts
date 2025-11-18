import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/app/lib/auth";

const MESSAGING_SERVICE_URL = process.env.MESSAGING_SERVICE_URL || "http://localhost:3010";

/**
 * POST /api/messaging/messages
 * Send a new message
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session || !session.user?.id) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();

    // Ensure sender is the authenticated user
    const messageData = {
      ...body,
      senderId: session.user.id, // Override to ensure it's the authenticated user
    };

    // Forward request to messaging service
    const response = await fetch(`${MESSAGING_SERVICE_URL}/api/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(messageData),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: "Failed to send message" }));
      return NextResponse.json(error, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error("Error sending message:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

