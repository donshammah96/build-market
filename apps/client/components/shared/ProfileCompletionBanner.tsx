'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  AlertCircle, 
  CheckCircle2, 
  ChevronRight, 
  X,
  User,
  Building2,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { ROUTES } from '@/lib/links';

interface ProfileCompletionBannerProps {
  percentage: number;
  missingFields: string[];
  profileType: 'client' | 'professional';
  onDismiss?: () => void;
  className?: string;
}

/**
 * ProfileCompletionBanner
 * 
 * Displays a prominent banner encouraging users to complete their profile.
 * Shows progress bar and list of missing required fields.
 */
export function ProfileCompletionBanner({
  percentage,
  missingFields,
  profileType,
  onDismiss,
  className,
}: ProfileCompletionBannerProps) {
  const [isDismissed, setIsDismissed] = useState(false);

  const handleDismiss = () => {
    setIsDismissed(true);
    onDismiss?.();
  };

  // Determine the route based on profile type
  const completeProfileRoute = profileType === 'professional'
    ? '/professional-portal/settings/complete-profile'
    : '/profile/complete';

  // Get appropriate colors based on completion percentage
  const getProgressColor = () => {
    if (percentage >= 80) return 'bg-emerald-500';
    if (percentage >= 50) return 'bg-amber-500';
    return 'bg-orange-500';
  };

  const getBorderColor = () => {
    if (percentage >= 80) return 'border-emerald-200';
    if (percentage >= 50) return 'border-amber-200';
    return 'border-orange-200';
  };

  const getBgColor = () => {
    if (percentage >= 80) return 'bg-emerald-50';
    if (percentage >= 50) return 'bg-amber-50';
    return 'bg-orange-50';
  };

  return (
    <AnimatePresence>
      {!isDismissed && (
        <motion.div
          initial={{ opacity: 0, y: -20, height: 0 }}
          animate={{ opacity: 1, y: 0, height: 'auto' }}
          exit={{ opacity: 0, y: -20, height: 0 }}
          transition={{ duration: 0.3 }}
          className={cn(
            'relative overflow-hidden rounded-xl border shadow-sm mb-6',
            getBorderColor(),
            getBgColor(),
            className
          )}
        >
          {/* Dismiss button */}
          <button
            onClick={handleDismiss}
            className="absolute top-4 right-4 p-1 rounded-full hover:bg-black/5 transition-colors z-10"
            aria-label="Dismiss banner"
          >
            <X className="h-4 w-4 text-zinc-400" />
          </button>

          <div className="p-6">
            <div className="flex flex-col lg:flex-row lg:items-center gap-6">
              
              {/* Icon and Text Section */}
              <div className="flex items-start gap-4 flex-1">
                <div className={cn(
                  'p-3 rounded-xl',
                  percentage >= 80 ? 'bg-emerald-100' : percentage >= 50 ? 'bg-amber-100' : 'bg-orange-100'
                )}>
                  {profileType === 'professional' ? (
                    <Building2 className={cn(
                      'h-6 w-6',
                      percentage >= 80 ? 'text-emerald-600' : percentage >= 50 ? 'text-amber-600' : 'text-orange-600'
                    )} />
                  ) : (
                    <User className={cn(
                      'h-6 w-6',
                      percentage >= 80 ? 'text-emerald-600' : percentage >= 50 ? 'text-amber-600' : 'text-orange-600'
                    )} />
                  )}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-zinc-900 text-lg">
                      Complete Your Profile
                    </h3>
                    {percentage >= 80 && (
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                        Almost there!
                      </span>
                    )}
                  </div>
                  
                  <p className="text-sm text-zinc-600 mb-4">
                    {profileType === 'professional' 
                      ? 'A complete profile helps clients find and trust you. Add the missing details to stand out.'
                      : 'Complete your profile to get personalized recommendations and better matches with professionals.'
                    }
                  </p>

                  {/* Progress bar */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-zinc-500 font-medium">Profile completion</span>
                      <span className="text-zinc-900 font-bold">{percentage}%</span>
                    </div>
                    <Progress 
                      value={percentage} 
                      className="h-2.5 bg-zinc-200" 
                      indicatorClassName={getProgressColor()}
                    />
                  </div>

                  {/* Missing fields */}
                  {missingFields.length > 0 && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {missingFields.slice(0, 4).map((field) => (
                        <span
                          key={field}
                          className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-md bg-white border border-zinc-200 text-zinc-600"
                        >
                          <AlertCircle className="h-3 w-3 text-orange-500" />
                          {field}
                        </span>
                      ))}
                      {missingFields.length > 4 && (
                        <span className="inline-flex items-center text-xs font-medium px-2 py-1 rounded-md bg-white border border-zinc-200 text-zinc-500">
                          +{missingFields.length - 4} more
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* CTA Section */}
              <div className="flex items-center gap-3 lg:flex-col lg:items-end">
                <Button
                  asChild
                  className="bg-zinc-900 hover:bg-zinc-800 text-white shadow-md hover:shadow-lg transition-all"
                >
                  <Link href={completeProfileRoute}>
                    Complete Profile
                    <ChevronRight className="ml-1 h-4 w-4" />
                  </Link>
                </Button>
                
                {percentage >= 80 && (
                  <p className="text-xs text-emerald-600 flex items-center gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Just a few more fields!
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Decorative gradient */}
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-orange-400 via-amber-400 to-emerald-400" 
            style={{
              clipPath: `inset(0 ${100 - percentage}% 0 0)`,
            }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/**
 * Simple inline version for smaller spaces
 */
export function ProfileCompletionInline({
  percentage,
  profileType,
}: {
  percentage: number;
  profileType: 'client' | 'professional';
}) {
  const completeProfileRoute = profileType === 'professional'
    ? '/professional-portal/settings/complete-profile'
    : '/profile/complete';

  return (
    <Link 
      href={completeProfileRoute}
      className="flex items-center gap-3 p-3 rounded-lg bg-amber-50 border border-amber-200 hover:bg-amber-100 transition-colors group"
    >
      <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-amber-900">
          Profile {percentage}% complete
        </p>
      </div>
      <ChevronRight className="h-4 w-4 text-amber-600 group-hover:translate-x-0.5 transition-transform" />
    </Link>
  );
}
