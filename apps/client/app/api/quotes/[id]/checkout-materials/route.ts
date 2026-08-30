import { NextRequest, NextResponse } from "next/server";
import { boqStoreBridgeService } from "@/app/lib/domains/quotes/boq-store-bridge";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: quoteId } = await params;

  const result = await boqStoreBridgeService.buildDraftOrderFromQuote(quoteId);

  if (!result.ok) {
    const status =
      result.code === "QUOTE_NOT_FOUND"
        ? 404
        : result.code === "NO_BOQ_ITEMS"
          ? 400
          : 500;
    return NextResponse.json({ error: result.message }, { status });
  }

  return NextResponse.json({
    data: result.data,
  });
}
