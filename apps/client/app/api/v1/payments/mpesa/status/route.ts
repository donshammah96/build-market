import { NextRequest, NextResponse } from "next/server";
import { prisma, PaymentStatus } from "@build/db";
import { auth } from "@clerk/nextjs/server";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const checkoutRequestId = searchParams.get("checkoutRequestId");

    if (!checkoutRequestId) {
      return NextResponse.json(
        { error: "checkoutRequestId query parameter is required" },
        { status: 400 },
      );
    }

    const txn = await prisma.mpesaTransaction.findUnique({
      where: { checkoutRequestId },
      select: {
        id: true,
        userId: true,
        status: true,
        resultCode: true,
        resultDesc: true,
        mpesaReceiptNumber: true,
        amount: true,
        updatedAt: true,
        createdAt: true,
      },
    });

    if (!txn) {
      return NextResponse.json(
        { error: "Transaction not found" },
        { status: 404 },
      );
    }

    // Security check: only the user who initiated the payment can poll it
    if (txn.userId !== session.userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    let normalizedStatus: "PENDING" | "SUCCESS" | "FAILED" | "TIMEOUT" =
      "PENDING";

    if (txn.status === PaymentStatus.SUCCESS) {
      normalizedStatus = "SUCCESS";
    } else if (txn.status === PaymentStatus.FAILED) {
      normalizedStatus = "FAILED";
    } else {
      // If still pending after 90 seconds, flag as TIMEOUT
      const ageMs = Date.now() - new Date(txn.createdAt).getTime();
      if (ageMs > 90 * 1000) {
        normalizedStatus = "TIMEOUT";
      }
    }

    return NextResponse.json({
      checkoutRequestId,
      status: normalizedStatus,
      rawStatus: txn.status,
      resultCode: txn.resultCode,
      resultDesc: txn.resultDesc,
      receiptNumber: txn.mpesaReceiptNumber,
      amount: Number(txn.amount),
      updatedAt: txn.updatedAt,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to poll transaction status", details: String(error) },
      { status: 500 },
    );
  }
}
