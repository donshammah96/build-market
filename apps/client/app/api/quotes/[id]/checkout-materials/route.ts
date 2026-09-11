import { NextRequest, NextResponse } from "next/server";
import { withAuth, type AuthContext } from "@/app/lib/api/api-middleware";
import { applyPrivateNoStoreHeaders } from "@/app/lib/api/http-security";
import { boqStoreBridgeService } from "@/app/lib/domains/quotes/boq-store-bridge";

export const GET = withAuth(
  async (
    _req: NextRequest,
    { dbUserId, userRole }: AuthContext,
    params?: { id: string },
  ) => {
    const quoteId = params?.id;
    if (!quoteId) {
      return applyPrivateNoStoreHeaders(
        NextResponse.json({ error: "Missing quote ID" }, { status: 400 }),
      );
    }

    const result = await boqStoreBridgeService.buildDraftOrderFromQuote(
      { userId: dbUserId, role: userRole },
      quoteId,
    );

    if (!result.ok) {
      const status =
        result.code === "QUOTE_NOT_FOUND"
          ? 404
          : result.code === "FORBIDDEN"
            ? 403
            : result.code === "NO_BOQ_ITEMS" ||
                result.code === "INVALID_STATUS" ||
                result.code === "OUTDATED_VERSION"
              ? 400
              : 500;
      return applyPrivateNoStoreHeaders(
        NextResponse.json(
          { error: result.message, code: result.code },
          { status },
        ),
      );
    }

    return applyPrivateNoStoreHeaders(
      NextResponse.json({
        data: result.data,
      }),
    );
  },
);
