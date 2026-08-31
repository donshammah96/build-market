import { NextRequest, NextResponse } from "next/server";
import { TransactionStatus, prisma } from "@build/db";
import { withAuth } from "@/app/lib/api/api-middleware";
import { checkRateLimit, getRateLimitIdentifier, RateLimits } from "@/app/lib/api/rate-limit";

export const GET = withAuth(async (request: NextRequest, { dbUserId }) => {
  const rateLimit = await checkRateLimit(
    `mpesa-status:${getRateLimitIdentifier(request)}`,
    RateLimits.READ.limit,
    RateLimits.READ.window,
  );
  if (!rateLimit.success) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const transactionId = request.nextUrl.searchParams.get("transactionId");
  const checkoutRequestId = request.nextUrl.searchParams.get("checkoutRequestId");
  if (!transactionId && !checkoutRequestId) {
    return NextResponse.json(
      { error: "transactionId or checkoutRequestId is required" },
      { status: 400 },
    );
  }

  const txn = transactionId
    ? await prisma.mpesaTransaction.findUnique({ where: { id: transactionId } })
    : await prisma.mpesaTransaction.findUnique({
        where: { checkoutRequestId: checkoutRequestId! },
      });

  if (!txn) return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
  if (txn.userId !== dbUserId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const isTerminal = [
    TransactionStatus.SUCCESS,
    TransactionStatus.FAILED,
    TransactionStatus.REVERSED,
    TransactionStatus.REFUNDED,
    TransactionStatus.CANCELLED,
    TransactionStatus.COMPLETED,
  ].includes(txn.status);
  const ageMs = Date.now() - txn.createdAt.getTime();
  const normalizedStatus = isTerminal
    ? txn.status === TransactionStatus.SUCCESS || txn.status === TransactionStatus.COMPLETED
      ? "SUCCESS"
      : "FAILED"
    : ageMs > 90_000
      ? "TIMEOUT"
      : "PENDING";

  return NextResponse.json({
    transactionId: txn.id,
    checkoutRequestId: txn.checkoutRequestId,
    status: normalizedStatus,
    rawStatus: txn.status,
    resultCode: txn.resultCode,
    resultDesc: txn.resultDesc,
    receiptNumber: txn.mpesaReceiptNumber,
    amount: Number(txn.amount),
    updatedAt: txn.updatedAt,
  });
});
