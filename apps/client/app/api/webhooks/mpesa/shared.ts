import { NextResponse } from "next/server";
import { applyPrivateNoStoreHeaders } from "@/app/lib/api/http-security";

/** Provider callbacks are acknowledged without caching or exposing internals. */
export function providerCallbackResponse(status = 202) {
  return applyPrivateNoStoreHeaders(
    NextResponse.json({ accepted: status < 300 }, { status }),
  );
}
