import { FC, useRef } from "react";
import Link from 'next/link';
import { ROUTES } from '../../app/lib/links';
import { motion, useInView } from 'framer-motion';
import { Button } from '../ui/button';

// Helper function to style last word(s) in emerald
const renderTitleWithEmerald = (title: string) => {
  const words = title.split(' ');
  const lastWord = words[words.length - 1];
  const restWords = words.slice(0, -1).join(' ');
  
  return (
    <>
      {restWords && `${restWords} `}
      <span className="text-emerald-600">{lastWord}</span>
    </>
  );
};

export const CTA: FC = () => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <div className="w-full h-60 overflow-hidden flex justify-center items-center bg-neutral-100" ref={ref}>
      <div className="flex flex-col md:flex-row justify-between items-center w-full max-w-[1280px] px-4 sm:px-6 md:px-20 gap-6 sm:gap-8">
        <motion.h2
          initial={{ opacity: 0, x: -50 }}
          animate={isInView ? { opacity: 1, x: 0 } : { opacity: 0, x: -50 }}
          transition={{ duration: 0.6 }}
          className="text-black text-4xl sm:text-5xl md:text-6xl font-semibold font-inter text-left"
        >
          {renderTitleWithEmerald("Join Us Today!")}
        </motion.h2>
        <motion.div
          initial={{ opacity: 0, x: 50 }}
          animate={isInView ? { opacity: 1, x: 0 } : { opacity: 0, x: 50 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="flex gap-4 sm:gap-6"
        >
          <Button size="lg" asChild>
            <Link href={ROUTES.signIn}>Sign-in</Link>
          </Button>
          <Button variant="secondary" size="lg" asChild>
            <Link href={ROUTES.joinAsPro}>Join As a Pro</Link>
          </Button>
        </motion.div>
      </div>
    </div>
  );
};
