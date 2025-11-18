import Link from 'next/link';
import { ROUTES } from '../../app/lib/links';
import { Suspense, useState, useRef } from 'react';
import RegisterForm from '../forms/RegisterForm';
import { FC } from 'react';
import { Button } from '../ui/button';
import { motion, useInView } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import Image from 'next/image';

const ERROR_IMG_SRC =
  'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODgiIGhlaWdodD0iODgiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIgc3Ryb2tlPSIjMDAwIiBzdHJva2UtbGluZWpvaW49InJvdW5kIiBvcGFjaXR5PSIuMyIgZmlsbD0ibm9uZSIgc3Ryb2tlLXdpZHRoPSIzLjciPjxyZWN0IHg9IjE2IiB5PSIxNiIgd2lkdGg9IjU2IiBoZWlnaHQ9IjU2IiByeD0iNiIvPjxwYXRoIGQ9Im0xNiA1OCAxNi0xOCAzMiAzMiIvPjxjaXJjbGUgY3g9IjUzIiBjeT0iMzUiIHI9IjciLz48L3N2Zz4KCg==';

export const Hero: FC = () => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  const handleImageLoad = () => {
    setImageLoaded(true);
  };

  const handleImageError = () => {
    setImageError(true);
    setImageLoaded(true);
  };

  return (
    <div 
      ref={ref}
      className="relative flex flex-col md:flex-row justify-between items-start gap-6 sm:gap-10 px-4 sm:px-6 md:px-20 pt-24 sm:pt-28 pb-10 min-h-screen overflow-hidden"
    >
      {/* Background Image with Fade In */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={isInView && imageLoaded ? { opacity: 1 } : { opacity: 0 }}
        transition={{ duration: 0.8 }}
        className="absolute inset-0 z-0"
      >
        {imageError ? (
          <div 
            className="w-full h-full bg-gradient-to-br from-slate-50 via-white to-emerald-50"
            style={{
              backgroundImage: `url(${ERROR_IMG_SRC})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              backgroundRepeat: 'no-repeat',
            }}
          />
        ) : (
          <Image
            src="/logo1.png"
            alt="Build Market Background"
            fill
            className="object-cover"
            blurDataURL="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII="
            placeholder="blur"
            onLoad={handleImageLoad}
            onError={handleImageError}
            quality={85}
            priority
          />
        )}
        {/* Overlay for better text readability */}
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900/40 via-slate-800/30 to-emerald-900/30" />
      </motion.div>

      {/* Fallback gradient background while image loads */}
      {!imageLoaded && (
        <div className="absolute inset-0 z-0 bg-gradient-to-br from-slate-50 via-white to-emerald-50" />
      )}

      {/* Hero Content - Foreground */}
      <div className="relative z-10 flex flex-col md:flex-row justify-between items-start gap-6 sm:gap-10 w-full">
        <motion.div 
          initial={{ opacity: 0, x: -50 }}
          animate={isInView && imageLoaded ? { opacity: 1, x: 0 } : { opacity: 0, x: -50 }}
          transition={{ duration: 0.6, delay: 0.3, ease: "easeOut" }}
          className="flex flex-col justify-start items-start gap-4 sm:gap-6 max-w-[844px] pt-4 md:pt-8"
        >
          <div className="flex flex-col gap-4 sm:gap-6">
            <motion.h1 
              initial={{ opacity: 0, y: 20 }}
              animate={isInView && imageLoaded ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
              transition={{ delay: 0.5, duration: 0.6 }}
              className="relative self-stretch font-bold text-white drop-shadow-lg text-4xl sm:text-5xl md:text-6xl tracking-tight leading-tight"
            >
              Ideal Place to Find{' '}
              <span className="text-emerald-400">Professionals</span>
            </motion.h1>
            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              animate={isInView && imageLoaded ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
              transition={{ delay: 0.7, duration: 0.6 }}
              className="relative self-stretch text-slate-100 drop-shadow-md text-lg sm:text-xl leading-relaxed"
            >
              We offer our clients an all-in-one experience from idea to product in a seamless, linked marketplace.
            </motion.p>
          </div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={isInView && imageLoaded ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
            transition={{ delay: 0.9, duration: 0.6 }}
          >
            <Button
              size="lg"
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-lg px-8 py-6 rounded-lg shadow-lg hover:shadow-xl transition-all duration-300 group"
              aria-label="Join us today"
            >
              Join us today!
              <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
            </Button>
          </motion.div>
        </motion.div>
        <motion.div 
          initial={{ opacity: 0, x: 50 }}
          animate={isInView && imageLoaded ? { opacity: 1, x: 0 } : { opacity: 0, x: 50 }}
          transition={{ duration: 0.6, delay: 0.4, ease: "easeOut" }}
          className="flex flex-col gap-6 w-full md:w-auto"
        >
          <Suspense fallback={
            <div className="w-full max-w-md bg-white rounded-lg shadow-lg p-8 animate-pulse">
              <div className="h-8 bg-gray-200 rounded w-3/4 mb-4"></div>
              <div className="h-4 bg-gray-200 rounded w-1/2 mb-6"></div>
              <div className="space-y-4">
                <div className="h-10 bg-gray-200 rounded"></div>
                <div className="h-10 bg-gray-200 rounded"></div>
                <div className="h-10 bg-gray-200 rounded"></div>
              </div>
            </div>
          }>
            <RegisterForm />
          </Suspense>
        </motion.div>
      </div>
    </div>
  );
};