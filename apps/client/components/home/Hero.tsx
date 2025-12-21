'use client';

import { Suspense, useState, type FC } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';

import { Button } from '@/components/ui/button';
import RegisterForm from '@/components/forms/RegisterForm';
import { ROUTES } from '@/lib/links';

// =============================================================================
// Animation Variants
// =============================================================================

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.15,
      delayChildren: 0.2,
    },
  },
};

const itemVariants = {
  hidden: { 
    opacity: 0, 
    y: 30, 
    filter: 'blur(10px)'
  },
  visible: { 
    opacity: 1, 
    y: 0, 
    filter: 'blur(0px)',
    transition: { 
      duration: 0.8, 
      ease: [0.25, 0.1, 0.25, 1.0] as const
    } 
  },
};

const formVariants = {
  hidden: { opacity: 0, x: 50 },
  visible: { 
    opacity: 1, 
    x: 0,
    transition: { 
      duration: 0.8, 
      ease: 'easeOut' as const
    }
  },
};

// =============================================================================
// Hero Component
// =============================================================================

/**
 * Hero section for the homepage.
 * 
 * Note: Authenticated users are redirected by middleware before reaching this page.
 * This component assumes the user is unauthenticated or browsing publicly.
 */
export const Hero: FC = () => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  return (
    <div className="relative min-h-[95vh] flex flex-col justify-center items-center overflow-hidden bg-zinc-900">
      
      {/* Background Layer */}
      <div className="absolute inset-0 z-0 bg-zinc-900">
        {/* Fallback gradient (shown immediately or on image error) */}
        <div className="absolute inset-0 bg-gradient-to-br from-zinc-800 to-black z-0" />
        
        {/* Hero image (fades in when loaded) */}
        {!imageError && (
          <motion.div
            className="relative w-full h-full z-10"
            initial={{ opacity: 0 }}
            animate={{ opacity: imageLoaded ? 1 : 0 }}
            transition={{ duration: 1.2 }}
          >
            <Image
              src="/hero.png"
              alt="Modern Kenyan Architecture"
              fill
              className="object-cover"
              priority
              onLoad={() => setImageLoaded(true)}
              onError={() => setImageError(true)}
            />
          </motion.div>
        )}
        
        {/* Overlay gradient */}
        <div className="absolute inset-0 z-20 bg-black/60 bg-gradient-to-r from-black/80 via-black/40 to-transparent" />
      </div>

      {/* Content Layer */}
      <div className="relative z-30 container mx-auto px-4 sm:px-6 md:px-20 pt-20 w-full">
        <motion.div 
          className="flex flex-col lg:flex-row items-center justify-between gap-12 lg:gap-20"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          
          {/* Left Column: Text Content */}
          <div className="max-w-2xl text-center lg:text-left space-y-8">
            <motion.h1 
              variants={itemVariants}
              className="text-5xl sm:text-6xl md:text-7xl font-bold text-white tracking-tight leading-[1.1]"
            >
              Build with <br/>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-300">
                Confidence.
              </span>
            </motion.h1>
            
            <motion.p 
              variants={itemVariants}
              className="text-lg sm:text-xl text-zinc-300 font-light leading-relaxed max-w-xl mx-auto lg:mx-0"
            >
              Connect with Kenya&apos;s top verified architects, engineers, and contractors. 
              From blueprint to occupancy, we bridge the trust gap.
            </motion.p>

            <motion.div 
              variants={itemVariants}
              className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start"
            >
              <Button
                size="lg"
                asChild
                className="bg-emerald-600 hover:bg-emerald-700 text-white h-14 px-8 text-lg rounded-full shadow-lg shadow-emerald-900/20 transition-transform active:scale-95"
              >
                <Link href={ROUTES.findProfessional}>
                  Find a Professional
                </Link>
              </Button>
              <Button
                variant="outline"
                size="lg"
                asChild
                className="bg-white/5 border-white/10 text-white hover:bg-white/10 h-14 px-8 text-lg rounded-full backdrop-blur-sm transition-transform active:scale-95"
              >
                <Link href={ROUTES.ideaBooks}>
                  View Projects
                </Link>
              </Button>
            </motion.div>
          </div>

          {/* Right Column: Register Form Card */}
          <motion.div 
            variants={formVariants}
            className="w-full max-w-md"
          >
            <div className="bg-white/95 backdrop-blur-xl p-1 rounded-2xl shadow-2xl border border-white/20">
              <div className="bg-white/60 p-6 sm:p-8 rounded-xl">
                <div className="mb-6 space-y-1">
                  <h3 className="text-xl font-bold text-zinc-900 tracking-tight">
                    Get Started
                  </h3>
                  <p className="text-zinc-500 text-sm">
                    Join the marketplace today
                  </p>
                </div>
                
                <Suspense fallback={<FormSkeleton />}>
                  <div className="min-h-[320px]"> 
                    <RegisterForm />
                  </div>
                </Suspense>
              </div>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
};

// =============================================================================
// Sub-components
// =============================================================================

/** Skeleton loader for the registration form */
const FormSkeleton: FC = () => (
  <div className="space-y-4 animate-pulse w-full h-[320px] flex flex-col justify-center">
    <div className="h-10 bg-zinc-200 rounded-md w-full" />
    <div className="h-10 bg-zinc-200 rounded-md w-full" />
    <div className="h-12 bg-zinc-300 rounded-md w-full mt-4" />
    <div className="h-4 bg-zinc-100 rounded-md w-2/3 mx-auto mt-4" />
  </div>
);