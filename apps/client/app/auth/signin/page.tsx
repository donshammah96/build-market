"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import Image from "next/image";
import Link from "next/link";

export default function SignInPage() {
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string>("");

  const handleOAuthSignIn = async (provider: string) => {
    try {
      setLoading(provider);
      setError("");
      await signIn(provider, { 
        callbackUrl: "/onboarding",
        redirect: true 
      });
    } catch (err) {
      setError("Failed to sign in. Please try again.");
      setLoading(null);
    }
  };

  const providers = [
    {
      id: "google",
      name: "Google",
      icon: "https://www.google.com/favicon.ico",
      bgColor: "bg-white hover:bg-gray-50",
      textColor: "text-gray-700",
      border: "border border-gray-300",
    },
    {
      id: "github",
      name: "GitHub",
      icon: "https://github.com/favicon.ico",
      bgColor: "bg-gray-900 hover:bg-gray-800",
      textColor: "text-white",
      border: "",
    },
    {
      id: "facebook",
      name: "Facebook",
      icon: "https://www.facebook.com/favicon.ico",
      bgColor: "bg-blue-600 hover:bg-blue-700",
      textColor: "text-white",
      border: "",
    },
    {
      id: "azure-ad",
      name: "Microsoft",
      icon: "https://www.microsoft.com/favicon.ico",
      bgColor: "bg-white hover:bg-gray-50",
      textColor: "text-gray-700",
      border: "border border-gray-300",
    },
  ];

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 to-blue-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">
            Welcome to Build Market
          </h2>
          <p className="text-gray-600">
            Sign in to continue to your account
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-8 space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* OAuth Providers */}
          <div className="space-y-3">
            <p className="text-sm text-gray-600 text-center mb-4">
              Sign in with your preferred provider
            </p>

            {providers.map((provider) => (
              <button
                key={provider.id}
                onClick={() => handleOAuthSignIn(provider.id)}
                disabled={loading !== null}
                className={`w-full flex items-center justify-center gap-3 px-4 py-3 rounded-lg font-medium transition-all ${provider.bgColor} ${provider.textColor} ${provider.border} disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {loading === provider.id ? (
                  <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <Image
                      src={provider.icon}
                      alt={`${provider.name} logo`}
                      width={20}
                      height={20}
                      className="w-5 h-5"
                    />
                    <span>Continue with {provider.name}</span>
                  </>
                )}
              </button>
            ))}
          </div>

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-500">
                Or continue with email
              </span>
            </div>
          </div>

          {/* Credentials Sign In */}
          <Link href="/auth/credentials">
            <Button
              variant="outline"
              className="w-full"
              disabled={loading !== null}
            >
              Sign in with Email & Password
            </Button>
          </Link>

          {/* Sign Up Link */}
          <div className="text-center text-sm">
            <span className="text-gray-600">Don't have an account? </span>
            <Link
              href="/sign-up"
              className="font-medium text-emerald-600 hover:text-emerald-500"
            >
              Sign up for free
            </Link>
          </div>
        </div>

        {/* Terms and Privacy */}
        <p className="text-center text-xs text-gray-500">
          By continuing, you agree to our{" "}
          <Link href="/terms" className="underline hover:text-gray-700">
            Terms of Service
          </Link>{" "}
          and{" "}
          <Link href="/privacy" className="underline hover:text-gray-700">
            Privacy Policy
          </Link>
        </p>
      </div>
    </div>
  );
}

