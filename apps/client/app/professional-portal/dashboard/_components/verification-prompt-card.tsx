// Shown only when the user skipped onboarding (skippedOnboarding === true).
// Loaded dynamically from page.tsx so this JSX + icons are absent from the
// initial dashboard bundle for the majority of users.

import Link from "next/link";
import {
  ChevronRight,
  Shield,
  User,
  Building2,
  Store,
  ArrowUpRight,
  CheckCircle2,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

// ============================================================================
// DATA
// ============================================================================

const VERIFICATION_STEPS = [
  {
    icon: User,
    title: "Personal Info",
    description: "Name, contact details",
  },
  {
    icon: Building2,
    title: "Business Details",
    description: "Company, services, bio",
  },
  {
    icon: Store,
    title: "Store (Optional)",
    description: "Sell products online",
  },
];

// ============================================================================
// COMPONENT
// ============================================================================

export function VerificationPromptCard() {
  return (
    <Card className="border-2 border-emerald-200 bg-gradient-to-br from-emerald-50 to-white shadow-lg overflow-hidden">
      <CardContent className="p-0">
        <div className="flex flex-col lg:flex-row">
          {/* Left: Content */}
          <div className="flex-1 p-8">
            {/* Badge */}
            <div className="flex items-center gap-2 mb-4">
              <div className="p-2 rounded-full bg-emerald-100">
                <Shield className="h-5 w-5 text-emerald-600" />
              </div>
              <Badge
                variant="secondary"
                className="bg-emerald-100 text-emerald-700 border-0"
              >
                Action Required
              </Badge>
            </div>

            {/* Title */}
            <h2 className="text-2xl font-bold text-zinc-900 mb-2">
              Complete Your Professional Verification
            </h2>
            <p className="text-zinc-600 mb-6 max-w-md">
              Verify your profile to unlock all features, receive leads, and
              build trust with clients. It only takes 5 minutes.
            </p>

            {/* Steps Preview */}
            <div className="flex items-center gap-4 mb-6">
              {VERIFICATION_STEPS.map((step, index) => {
                const Icon = step.icon;
                return (
                  <div key={step.title} className="flex items-center">
                    <div className="flex flex-col items-center group">
                      <div className="w-12 h-12 rounded-full bg-white border-2 border-zinc-200 flex items-center justify-center group-hover:border-emerald-500 group-hover:bg-emerald-50 transition-all">
                        <Icon className="h-5 w-5 text-zinc-400 group-hover:text-emerald-600 transition-colors" />
                      </div>
                      <span className="text-xs font-medium text-zinc-500 mt-2 text-center max-w-[80px]">
                        {step.title}
                      </span>
                    </div>
                    {index < VERIFICATION_STEPS.length - 1 && (
                      <ChevronRight className="h-4 w-4 text-zinc-300 mx-2" />
                    )}
                  </div>
                );
              })}
            </div>

            {/* CTAs */}
            <div className="flex items-center gap-3 flex-wrap">
              <Button
                asChild
                className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-md hover:shadow-lg transition-all"
              >
                <Link href="/professional-portal/settings/complete-profile">
                  <Shield className="h-4 w-4 mr-2" />
                  Complete Verification
                  <ArrowUpRight className="h-4 w-4 ml-2" />
                </Link>
              </Button>
              <Button
                variant="ghost"
                className="text-zinc-600 hover:text-zinc-900"
              >
                Why verify?
              </Button>
            </div>
          </div>

          {/* Right: Benefits */}
          <div className="lg:w-72 bg-zinc-900 p-6 text-white">
            <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-400 mb-4">
              Verified Benefits
            </h3>
            <ul className="space-y-3">
              {[
                "Priority in search results",
                "Trust badge on profile",
                "Receive client leads",
                "Access to quotes & projects",
                "Sell products in marketplace",
              ].map((benefit) => (
                <li key={benefit} className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                  <span className="text-zinc-300">{benefit}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
