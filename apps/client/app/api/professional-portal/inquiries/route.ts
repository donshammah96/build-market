import { NextRequest } from "next/server";
import { createProfessionalPortalGet } from "@/app/lib/api/professional-portal-handler";
import { InquiriesQuerySchema } from "@/app/lib/validation/inquiries-validation";
import { getProfessionalInquiries } from "@/lib/services/inquiries";

export const GET = createProfessionalPortalGet({
  rateLimitKey: "inquiries-read",
  querySchema: InquiriesQuerySchema,
  parseQuery: (req) =>
    Object.fromEntries(new URL(req.url).searchParams.entries()),
  handler: async ({ dbUserId, query }) =>
    getProfessionalInquiries(dbUserId, query),
  operationName: "get_professional_inquiries",
  errorMessage: "Failed to fetch inquiries",
});
