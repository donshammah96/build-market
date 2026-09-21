import { receiveB2cCallback } from "@/app/lib/domains/payments/mpesa-callback";
import { NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  return receiveB2cCallback(request, "B2C_TIMEOUT");
}
