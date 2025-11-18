import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/app/lib/auth";

const MESSAGING_SERVICE_URL = process.env.MESSAGING_SERVICE_URL || "http://localhost:3010";

/**
 * GET /api/messaging/messages/conversation/[conversationId]
 * Get all messages for a conversation (with pagination)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { conversationId: string } }
) {
  try {
    const session = await auth();

    if (!session || !session.user?.id) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const conversationId = params.conversationId;
    
    // Get query parameters for pagination
    const searchParams = request.nextUrl.searchParams;
    const page = searchParams.get("page") || "1";
    const limit = searchParams.get("limit") || "50";

    // Forward request to messaging service
    const response = await fetch(
      `${MESSAGING_SERVICE_URL}/api/messages/conversation/${conversationId}?page=${page}&limit=${limit}`,
      {
        headers: {
          Authorization: `Bearer ${session.accessToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: "Failed to fetch messages" }));
      return NextResponse.json(error, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error fetching messages:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

