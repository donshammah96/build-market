import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/app/lib/auth";

const MESSAGING_SERVICE_URL = process.env.MESSAGING_SERVICE_URL || "http://localhost:3010";

/**
 * POST /api/messaging/messages/[id]/read
 * Mark a message as read
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();

    if (!session || !session.user?.id) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const messageId = params.id;
    const userId = session.user.id;

    // Forward request to messaging service
    const response = await fetch(
      `${MESSAGING_SERVICE_URL}/api/messages/${messageId}/read`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ userId }),
      }
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: "Failed to mark message as read" }));
      return NextResponse.json(error, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error marking message as read:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

