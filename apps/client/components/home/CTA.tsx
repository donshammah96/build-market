import { FC, useRef } from "react";
import Link from 'next/link';
import { ROUTES } from '@/lib/links';
import { motion, useInView } from 'framer-motion';
import { Button } from '../ui/button';
import { ArrowRight, Hammer } from 'lucide-react';

export const CTA: FC = () => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-50px" });

  return (
    <section ref={ref} className="py-20 px-4 sm:px-6 md:px-20 bg-zinc-900 overflow-hidden relative">
      
      {/* Abstract Background shapes */}
      <div className="absolute top-0 right-0 -mt-20 -mr-20 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 -mb-20 -ml-20 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-[1280px] mx-auto relative z-10 flex flex-col md:flex-row justify-between items-center gap-10">
        
        {/* Text Content */}
        <motion.div 
          className="max-w-2xl text-center md:text-left"
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
          transition={{ duration: 0.6 }}
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-900/50 border border-emerald-800 text-emerald-400 text-sm font-medium mb-6">
            <Hammer size={14} />
            <span>Ready to build?</span>
          </div>
          
          <h2 className="text-4xl sm:text-5xl md:text-6xl font-bold font-inter text-white tracking-tight mb-6">
            Let’s get your project <span className="text-emerald-500">off the ground.</span>
          </h2>
          
          <p className="text-zinc-400 text-lg md:text-xl max-w-lg mx-auto md:mx-0">
            Join thousands of Kenyan homeowners and top-rated professionals building better, together.
          </p>
        </motion.div>

        {/* Buttons */}
        <motion.div
          className="flex flex-col sm:flex-row gap-4 w-full md:w-auto"
          initial={{ opacity: 0, x: 30 }}
          animate={isInView ? { opacity: 1, x: 0 } : { opacity: 0, x: 30 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          <Button 
            size="lg" 
            className="bg-emerald-600 hover:bg-emerald-700 text-white text-lg h-14 px-8" 
            asChild
          >
            <Link href={ROUTES.joinAsPro}>
              Join as a Pro
              <ArrowRight className="ml-2 w-5 h-5" />
            </Link>
          </Button>
          
          <Button 
            variant="secondary" 
            size="lg" 
            className="text-lg h-14 px-8 bg-white text-zinc-900 hover:bg-zinc-100" 
            asChild
          >
            <Link href={ROUTES.signIn}>
              Log In
            </Link>
          </Button>
        </motion.div>
      </div>
    </section>
  );
};