'use client';

import React from 'react';
import { SignUp } from '@clerk/nextjs';
import { ROUTES } from '../../app/lib/links';

const RegisterForm: React.FC = () => {
  return (
    <div className="w-full max-w-md">
      <SignUp 
        forceRedirectUrl={ROUTES.onboarding}
        appearance={{
          elements: {
            rootBox: "w-full",
            card: "bg-white rounded-lg shadow-lg w-full",
            headerTitle: "text-2xl font-bold text-gray-900",
            headerSubtitle: "text-gray-600",
            socialButtonsBlockButton: "bg-white hover:bg-gray-50 border border-gray-300 text-gray-700",
            formButtonPrimary: "bg-emerald-600 hover:bg-emerald-700 text-white font-medium",
            formFieldInput: "border-gray-300 focus:border-emerald-500 focus:ring-emerald-500",
            footerActionLink: "text-emerald-600 hover:text-emerald-700",
          },
        }}
      />
    </div>
  );
};

export default RegisterForm;