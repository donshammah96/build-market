import { SignIn } from "@clerk/nextjs";
import { Building2 } from "lucide-react";
import { adminEnvConfig } from "@/lib/infrastructure/env";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function Page({ searchParams }: PageProps) {
  const resolvedParams = await searchParams;

  if (
    adminEnvConfig.NEXT_PUBLIC_CLERK_IS_SATELLITE &&
    adminEnvConfig.NEXT_PUBLIC_CLERK_PRIMARY_SIGN_IN_URL
  ) {
    const primarySignIn = adminEnvConfig.NEXT_PUBLIC_CLERK_PRIMARY_SIGN_IN_URL;
    const redirectUrl = new URL(primarySignIn);

    // Check if there was a redirect_url query param
    const redirectParam =
      typeof resolvedParams.redirect_url === "string"
        ? resolvedParams.redirect_url
        : "";

    if (redirectParam) {
      if (redirectParam.startsWith("/")) {
        const adminUrl =
          adminEnvConfig.APP_URL || adminEnvConfig.NEXT_PUBLIC_APP_URL || "";
        if (adminUrl) {
          redirectUrl.searchParams.set(
            "redirect_url",
            `${adminUrl}${redirectParam}`,
          );
        } else {
          redirectUrl.searchParams.set("redirect_url", redirectParam);
        }
      } else {
        redirectUrl.searchParams.set("redirect_url", redirectParam);
      }
    } else {
      const adminUrl =
        adminEnvConfig.APP_URL || adminEnvConfig.NEXT_PUBLIC_APP_URL || "";
      if (adminUrl) {
        redirectUrl.searchParams.set("redirect_url", adminUrl);
      }
    }

    redirect(redirectUrl.toString());
  }
  return (
    <div className="min-h-screen flex items-center justify-center p-4 overflow-hidden relative bg-zinc-900">
      {/* Background Layers */}
      <div className="absolute inset-0 z-0">
        {/* Gradient Background */}
        <div className="absolute inset-0 bg-linear-to-br from-zinc-900 via-zinc-800 to-black" />

        {/* Grid Pattern */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff08_1px,transparent_1px),linear-gradient(to_bottom,#ffffff08_1px,transparent_1px)] bg-size-32px_32px pointer-events-none" />

        {/* Animated Gradient Orbs */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl animate-pulse" />
        <div
          className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl animate-pulse"
          style={{ animationDelay: "1s" }}
        />

        {/* Overlay Gradient */}
        <div className="absolute inset-0 bg-linear-to-t from-black/40 via-transparent to-transparent pointer-events-none" />
      </div>

      {/* Content */}
      <div className="relative z-10 w-full max-w-md">
        {/* Brand Header */}
        <div className="text-center mb-8 space-y-3">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-emerald-500/20 rounded-2xl border border-emerald-500/30 backdrop-blur-sm mb-4">
            <Building2 className="h-8 w-8 text-emerald-400" />
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">
            Build Market
          </h1>
          <p className="text-zinc-400 text-sm">Admin Portal</p>
        </div>

        {/* Sign In Card */}
        <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/20 p-1">
          <div className="bg-white/60 backdrop-blur-sm rounded-xl p-6 sm:p-8">
            <SignIn
              fallbackRedirectUrl="/"
              appearance={{
                elements: {
                  rootBox: "w-full",
                  card: "shadow-none bg-transparent",
                  headerTitle: "text-zinc-900 font-bold text-2xl",
                  headerSubtitle: "text-zinc-600",
                  socialButtonsBlockButton:
                    "border-zinc-200 hover:bg-zinc-50 transition-colors",
                  formButtonPrimary:
                    "bg-zinc-900 hover:bg-zinc-800 text-white transition-all shadow-sm hover:shadow-md",
                  formFieldInput:
                    "border-zinc-200 focus:border-zinc-900 focus:ring-zinc-900",
                  footerActionLink: "text-zinc-900 hover:text-zinc-700",
                  identityPreviewText: "text-zinc-900",
                  identityPreviewEditButton:
                    "text-zinc-600 hover:text-zinc-900",
                },
              }}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-8">
          <p className="text-xs text-zinc-500">
            Secure access to Build Market administration
          </p>
        </div>
      </div>
    </div>
  );
}
