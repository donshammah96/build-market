"use client";

import { useRouter } from "next/navigation";
import { ShieldAlert, ArrowLeft, LogOut, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export const dynamic = "force-dynamic";

const SIGN_IN_URL = "/sign-in";

const UnauthorizedPage = () => {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-zinc-900 flex items-center justify-center p-4 overflow-hidden relative">
      {/* Background Layers */}
      <div className="absolute inset-0 z-0">
        {/* Gradient Background */}
        <div className="absolute inset-0 bg-linear-to-br from-zinc-900 via-zinc-800 to-black" />

        {/* Grid Pattern */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff08_1px,transparent_1px),linear-gradient(to_bottom,#ffffff08_1px,transparent_1px)] bg-size-32px_32px pointer-events-none" />

        {/* Animated Gradient Orbs */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-red-500/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl animate-pulse [animation-delay:1s]" />

        {/* Overlay Gradient */}
        <div className="absolute inset-0 bg-linear-to-t from-black/40 via-transparent to-transparent pointer-events-none" />
      </div>

      <div className="w-full max-w-md relative z-10 animate-fade-in">
        {/* Brand Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-red-500/20 rounded-xl border border-red-500/30 backdrop-blur-sm mb-3">
            <Building2 className="h-6 w-6 text-red-400" />
          </div>
          <p className="text-xs text-zinc-400 uppercase tracking-widest font-medium">
            Build Market Admin
          </p>
        </div>

        {/* Unauthorized Card */}
        <Card className="border-white/20 shadow-2xl bg-white/95 backdrop-blur-xl overflow-hidden">
          {/* Status Indicator Line */}
          <div className="h-1.5 w-full bg-linear-to-r from-red-500 via-red-400 to-red-500" />

          <CardContent className="pt-10 pb-8 px-8 text-center flex flex-col items-center">
            <div className="h-20 w-20 bg-red-50 dark:bg-red-500/20 rounded-full flex items-center justify-center mb-6 border border-red-100 dark:border-red-500/30 shadow-lg">
              <ShieldAlert className="h-10 w-10 text-red-500 dark:text-red-400" />
            </div>

            <h1 className="text-2xl font-bold text-zinc-900 dark:text-white tracking-tight mb-3">
              Access Restricted
            </h1>

            <p className="text-zinc-600 dark:text-zinc-300 text-sm leading-relaxed mb-8 max-w-75 mx-auto">
              You do not have the necessary permissions to view this page. This
              area is restricted to authorized personnel only.
            </p>

            <div className="flex flex-col gap-3 w-full">
              <Button
                onClick={() => router.push(SIGN_IN_URL)}
                className="w-full bg-zinc-900 hover:bg-zinc-800 text-white h-11 shadow-sm transition-all hover:shadow-md rounded-lg"
              >
                <LogOut className="mr-2 h-4 w-4" />
                Go to Sign In
              </Button>

              <Button
                variant="outline"
                onClick={() => router.push("/")}
                className="w-full border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 h-11 rounded-lg"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Return to Home
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center mt-8 space-y-2">
          <p className="text-xs text-zinc-500 uppercase tracking-widest font-medium">
            Security Notice
          </p>
          <p className="text-[10px] text-zinc-600 dark:text-zinc-400 font-mono">
            Error Code: 403_FORBIDDEN
          </p>
        </div>
      </div>
    </div>
  );
};

export default UnauthorizedPage;
