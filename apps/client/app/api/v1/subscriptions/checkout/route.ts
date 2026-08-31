import { BillingInterval, SubscriptionTierKey } from "@build/db";
import { z } from "zod";
import { NextRequest } from "next/server";
import { createProfessionalPortalPost } from "@/app/lib/api/professional-portal-handler";
import { applyPrivateNoStoreHeaders } from "@/app/lib/api/http-security";
import { clientSubscriptionsService } from "@/app/lib/domains/subscriptions";

const CheckoutSchema = z.object({
  planKey: z.nativeEnum(SubscriptionTierKey),
  billingInterval: z.nativeEnum(BillingInterval),
  phoneNumber: z.string().min(9).max(20),
  idempotencyKey: z.string().min(8).max(128),
});

const post = createProfessionalPortalPost({
  rateLimitKey: "subscription-mpesa-checkout",
  bodySchema: CheckoutSchema,
  operationName: "initiate_subscription_mpesa_checkout",
  errorMessage: "Unable to start M-Pesa checkout",
  handler: async ({ dbUserId, userRole, body }) => {
    const result =
      await clientSubscriptionsService.initiateSubscriptionCheckout(
        { userId: dbUserId, role: userRole },
        body,
      );
    if (!result.ok) throw new Error(result.message);
    return result.data;
  },
});

export async function POST(request: NextRequest) {
  const response = await post(request);
  return applyPrivateNoStoreHeaders(response);
}
