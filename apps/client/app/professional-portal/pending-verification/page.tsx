import Link from "next/link";
import { Clock3, ShieldCheck } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function ProfessionalPendingVerificationPage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-10 sm:px-6 lg:px-8">
      <Card className="border-amber-200 bg-amber-50/60">
        <CardHeader className="space-y-3">
          <div className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-amber-100 text-amber-700">
            <Clock3 className="h-6 w-6" aria-hidden="true" />
          </div>
          <CardTitle className="text-2xl font-semibold text-zinc-900">
            Verification in progress
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-zinc-700">
          <p>
            Your professional onboarding details were submitted successfully.
            Your account is now waiting for verification before full portal
            access is enabled.
          </p>
          <p>
            We review qualifications and submitted documents to protect clients
            and maintain marketplace trust.
          </p>
          <div className="rounded-lg border border-amber-200 bg-white p-4">
            <p className="flex items-start gap-2 text-sm">
              <ShieldCheck
                className="mt-0.5 h-4 w-4 text-emerald-600"
                aria-hidden="true"
              />
              You can return here at any time. Once verification is approved,
              your dashboard access will update automatically.
            </p>
          </div>
          <div className="flex flex-wrap gap-3 pt-2">
            <Button asChild>
              <Link href="/professional-portal/profile">Review Profile</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/professional-portal/settings">Open Settings</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
