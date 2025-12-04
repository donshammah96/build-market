import { reviews as allReviews } from '../../app/data/homeData';
import ReviewCard from './ReviewCard';
import Link from 'next/link';
import { ROUTES } from '@/lib/links';
import { motion, useInView } from 'framer-motion';
import { useRef } from 'react';
import { Button } from '../ui/button';
import { ArrowRight } from 'lucide-react';

// Robust helper component for the title
const TitleWithHighlight = ({ text }: { text: string }) => {
  const words = text.split(' ');
  // Highlights the last 2 words if lengthy, or just last 1
  const highlightCount = words.length > 3 ? 2 : 1; 
  const normalText = words.slice(0, -highlightCount).join(' ');
  const highlightText = words.slice(-highlightCount).join(' ');

  return (
    <span className="block">
      {normalText} <span className="text-emerald-600 relative inline-block">
        {highlightText}
        {/* Optional: Add a subtle underline svg here if you want extra flair */}
      </span>
    </span>
  );
};

export const ReviewsSection: React.FC<{ searchTerm?: string }> = ({ 
  searchTerm = '' 
}) => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  const filteredReviews = allReviews.filter(review =>
    review.quote.toLowerCase().includes(searchTerm.toLowerCase()) ||
    review.name.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  // Fallback if filter returns empty (Improvement: never show empty section)
  const displayReviews = filteredReviews.length > 0 ? filteredReviews : allReviews;

  return (
    <section className="bg-zinc-50/50 relative py-16 sm:py-24" ref={ref}>
      <div className="max-w-[1280px] mx-auto px-4 sm:px-6 md:px-20">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-end mb-12 gap-6">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={isInView ? { opacity: 1, x: 0 } : { opacity: 0, x: -20 }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold font-inter tracking-tight text-zinc-900 mb-2">
              <TitleWithHighlight text="Trusted by Kenyans everywhere" />
            </h2>
            <p className="text-zinc-500 text-lg max-w-xl">
              From Runda to Riverside, see how we are helping homeowners build their dreams with confidence.
            </p>
          </motion.div>

          <motion.div
             initial={{ opacity: 0, x: 20 }}
             animate={isInView ? { opacity: 1, x: 0 } : { opacity: 0, x: 20 }}
             transition={{ duration: 0.6, delay: 0.2 }}
             className="hidden sm:block"
          >
            <Button variant="outline" className="group" asChild>
              <Link href={ROUTES.reviews}>
                Read all stories 
                <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
            </Button>
          </motion.div>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
          {displayReviews.slice(0, 3).map((review, index) => (
            <motion.div
              key={review.id || index}
              initial={{ opacity: 0, y: 30 }}
              animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
              transition={{ duration: 0.5, delay: index * 0.15 }}
              className="h-full"
            >
              <ReviewCard {...review} />
            </motion.div>
          ))}
        </div>

        {/* Mobile-only View More Button */}
        <div className="mt-8 sm:hidden text-center">
            <Button variant="outline" className="w-full" asChild>
              <Link href={ROUTES.reviews}>Read all stories</Link>
            </Button>
        </div>
      </div>
    </section>
  );
};