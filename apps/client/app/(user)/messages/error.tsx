'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center h-[600px] p-6 text-center border rounded-lg bg-muted/10">
      <AlertTriangle className="w-12 h-12 text-amber-500 mb-4" />
      <h2 className="text-xl font-semibold mb-2">Something went wrong!</h2>
      <p className="text-muted-foreground mb-6 max-w-md">
        We couldn't load your messages. This might be a temporary connection issue.
      </p>
      <Button onClick={() => reset()}>Try again</Button>
    </div>
  );
}
