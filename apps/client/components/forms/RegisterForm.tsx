"use client";

import React, { useEffect, useState } from "react";
import { SignUp } from "@clerk/nextjs";

export const RegisterFormSkeleton: React.FC = () => (
  <div
    className="space-y-4 w-full h-80 flex flex-col justify-center"
    role="status"
    aria-label="Loading registration form"
    data-testid="register-form-skeleton"
  >
    <div className="h-10 bg-muted rounded-md w-full motion-safe:animate-pulse" />
    <div
      className="h-10 bg-muted rounded-md w-full motion-safe:animate-pulse"
      style={{ animationDelay: "75ms" }}
    />
    <div
      className="h-12 bg-muted/80 rounded-md w-full mt-4 motion-safe:animate-pulse"
      style={{ animationDelay: "150ms" }}
    />
    <div
      className="h-4 bg-muted/60 rounded-md w-2/3 mx-auto mt-4 motion-safe:animate-pulse"
      style={{ animationDelay: "225ms" }}
    />
    <span className="sr-only">Loading registration form...</span>
  </div>
);

const RegisterForm: React.FC = () => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <RegisterFormSkeleton />;
  }

  return (
    <div className="w-full max-w-md" data-testid="register-form-container">
      <SignUp
        routing="hash"
        signInUrl="/sign-in"
        fallbackRedirectUrl="/auth-callback"
        appearance={{
          elements: {
            rootBox: "w-full",
            card: "bg-white rounded-lg shadow-lg w-full",
            headerTitle: "text-2xl font-bold text-gray-900",
            headerSubtitle: "text-gray-600",
            socialButtonsBlockButton:
              "bg-white hover:bg-gray-50 border border-gray-300 text-gray-700",
            formButtonPrimary:
              "bg-emerald-600 hover:bg-emerald-700 text-white font-medium",
            formFieldInput:
              "border-gray-300 focus:border-emerald-500 focus:ring-emerald-500",
            footerActionLink: "text-emerald-600 hover:text-emerald-700",
          },
        }}
      />
    </div>
  );
};

export default RegisterForm;
