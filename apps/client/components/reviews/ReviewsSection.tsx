import { reviews as allReviews, type Review } from '../../app/data/homeData';
import ReviewCard from './ReviewCard';
import Link from 'next/link';
import { ROUTES } from '../../app/lib/links';
import { motion, useInView } from 'framer-motion';
import { useRef } from 'react';
import { Button } from '../ui/button';

// Mock data fallback
const defaultReviews: Review[] = [
  { quote: '"Excellent service!"', name: 'Amy Burns', description: 'Happy Customer', image: '/customers/amy-burns.png', imageAlt: 'Amy Burns', href: ROUTES.speakWithAdvisor },
  { quote: '"Best experience ever!"', name: 'Balazs Orban', description: 'Satisfied Client', image: '/customers/balazs-orban.png', imageAlt: 'Balazs Orban', href: ROUTES.ideaBooks },
  { quote: '"Great products and service!"', name: 'Lee Robinson', description: 'Verified Buyer', image: '/customers/lee-robinson.png', imageAlt: 'Lee Robinson', href: ROUTES.findProfessional },
];

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

export const ReviewsSection: React.FC<{ searchTerm?: string; reviews?: Review[] }> = ({ 
  searchTerm = '', 
  reviews = allReviews.length > 0 ? allReviews : defaultReviews 
}) => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  const filteredReviews = reviews.filter(review =>
    review.quote.toLowerCase().includes(searchTerm.toLowerCase()) ||
    review.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    review.description.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  return (
    <section className="px-4 sm:px-6 md:px-20 py-6 sm:py-10 bg-white" ref={ref}>
      <motion.h2
        initial={{ opacity: 0, x: 50 }}
        animate={isInView ? { opacity: 1, x: 0 } : { opacity: 0, x: 50 }}
        transition={{ duration: 0.6 }}
        className="text-black text-4xl sm:text-5xl md:text-6xl font-semibold font-inter mb-6 sm:mb-10 text-left"
      >
        {renderTitleWithEmerald("Client Reviews")}
      </motion.h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
        {filteredReviews.map((review, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 30 }}
            animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
            transition={{ duration: 0.5, delay: index * 0.15 }}
          >
            <ReviewCard {...review} />
          </motion.div>
        ))}
      </div>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
        transition={{ duration: 0.6, delay: 0.4 }}
        className="mt-6 text-center"
      >
        <Button variant="secondary" size="lg" asChild>
          <Link href={ROUTES.home} className="inline-flex items-center gap-1">
            Explore More <span aria-hidden>→</span>
          </Link>
        </Button>
      </motion.div>
    </section>
  );
};