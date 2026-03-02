"use server";

import { createWithdrawal } from "@/lib/services/finance";
import { WithdrawSchema } from "@/app/lib/validation/finance-validation";
import { IdempotencyService } from "@/app/lib/services/idempotency.service";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@build/db";
import { revalidatePath } from "next/cache";

async function resolveDbUserId(): Promise<string> {
  const { userId: clerkId } = await auth();
  if (!clerkId) throw new Error("Unauthorized");

  const user = await prisma.user.findUnique({
    where: { clerkId },
    select: { id: true },
  });
  if (!user) throw new Error("User not found");

  return user.id;
}

export type RequestWithdrawalActionInput = {
  amount: number;
  method?: string;
  description?: string;
  idempotencyKey?: string;
};

export async function requestWithdrawalAction(
  data: RequestWithdrawalActionInput,
) {
  const dbUserId = await resolveDbUserId();

  const parsed = WithdrawSchema.safeParse({
    amount: data.amount,
    method: data.method ?? "MPESA",
    description: data.description,
  });
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    throw new Error(first?.message ?? "Invalid withdrawal data");
  }

  const { amount, method, description } = parsed.data;
  const idempotencyKey =
    data.idempotencyKey ??
    IdempotencyService.generateKey(dbUserId, "POST", {
      domain: "withdrawal",
      amount,
      method,
    });

  const idempotencyCheck = await IdempotencyService.checkOrCreate(
    idempotencyKey,
    "withdrawal",
    dbUserId,
    "POST",
  );

  if (idempotencyCheck?.status === "completed" && idempotencyCheck.response) {
    revalidatePath("/professional-portal/finance");
    return idempotencyCheck.response;
  }

  if (idempotencyCheck?.status === "pending") {
    throw new Error("Request is being processed. Please wait.");
  }

  const result = await createWithdrawal(dbUserId, {
    amount,
    method,
    description,
  });

  if ("error" in result) {
    await IdempotencyService.fail(idempotencyKey);
    throw new Error(`Insufficient funds. Available balance: ${result.error}`);
  }

  await IdempotencyService.complete(idempotencyKey, result.data);
  revalidatePath("/professional-portal/finance");
  return result.data;
}
