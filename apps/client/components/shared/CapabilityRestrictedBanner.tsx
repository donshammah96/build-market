import React from "react";
import Link from "next/link";
import { Lock, AlertCircle, Clock, ExternalLink } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface CapabilityRestrictedBannerProps {
  /** Feature or module name being restricted (e.g. "Leads", "Financial Withdrawals") */
  featureName: string;
  /** Current verification status of the professional */
  verificationStatus?: string;
  /** Optional custom explanation */
  description?: string;
}

export function CapabilityRestrictedBanner({
  featureName,
  verificationStatus = "PENDING",
  description,
}: CapabilityRestrictedBannerProps) {
  const isNeedsChanges = verificationStatus === "NEEDS_CHANGES";
  const isRejected = verificationStatus === "REJECTED";

  return (
    <Card className="border-amber-200 bg-amber-50/70 shadow-sm">
      <CardContent className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-6">
        <div className="flex items-start gap-3">
          <div className="rounded-full bg-amber-100 p-2.5 text-amber-700 shrink-0">
            {isNeedsChanges ? (
              <AlertCircle className="h-5 w-5" aria-hidden="true" />
            ) : (
              <Lock className="h-5 w-5" aria-hidden="true" />
            )}
          </div>
          <div>
            <h3 className="text-base font-semibold text-zinc-900">
              {featureName} Access Restricted
            </h3>
            <p className="mt-1 text-sm text-zinc-600">
              {description ||
                (isRejected
                  ? "Your verification application was not approved. Please contact support or update your application."
                  : isNeedsChanges
                    ? "Changes have been requested on your application before this feature can be unlocked."
                    : `${featureName} requires a verified professional account. Your application is currently under review.`)}
            </p>
          </div>
        </div>

        <Button asChild size="sm" className="shrink-0">
          <Link href="/professional-portal/pending-verification">
            <Clock className="mr-2 h-4 w-4" />
            View Status
            <ExternalLink className="ml-1 h-3 w-3" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
