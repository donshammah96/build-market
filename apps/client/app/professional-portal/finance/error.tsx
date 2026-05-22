"use client";

import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface FinanceErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function FinanceError({ error, reset }: FinanceErrorProps) {
  return (
    <div className="max-w-[1600px] mx-auto p-4 pt-10">
      <Card className="border border-red-200 bg-red-50/50 shadow-sm">
        <CardContent className="p-8 flex flex-col items-center text-center gap-4">
          <div className="p-3 rounded-full bg-red-100">
            <AlertTriangle className="h-6 w-6 text-red-600" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-zinc-900 mb-1">
              Failed to load financial data
            </h2>
            <p className="text-sm text-zinc-500 max-w-sm">
              {error.message ||
                "An unexpected error occurred. Please try again."}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={reset}
            className="mt-2 border-red-200 text-red-700 hover:bg-red-50"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Try again
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
