import { features as allFeatures, type Feature } from '../../app/data/homeData';
import FeatureCard from '../shared/FeatureCard';
import Link from 'next/link';
import { ROUTES } from '../../app/lib/links';
import { motion, useInView } from 'framer-motion';
import { useRef } from 'react';
import { Button } from '../ui/button';

// Mock data fallback
const defaultFeatures: Feature[] = [
  { title: 'Idea Books', description: 'Browse idea books to find inspiration', image: '/design.png', imageAlt: 'Idea Books', href: ROUTES.ideaBooks },
  { title: 'Find a Professional', description: 'Find a professional for your specific needs.', image: '/professional.png', imageAlt: 'Find a Professional', href: ROUTES.findProfessional },
  { title: 'Speak with an Advisor', description: 'Contact a knowledgeable guide.', image: '/contact.png', imageAlt: 'Speak with an Advisor', href: ROUTES.speakWithAdvisor },
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

export const FeaturesSection: React.FC<{ searchTerm?: string; features?: Feature[] }> = ({ 
  searchTerm = '', 
  features = allFeatures.length > 0 ? allFeatures : defaultFeatures 
}) => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  const filteredFeatures = features.filter(feature =>
    feature.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    feature.description.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  return (
    <section className="px-4 sm:px-6 md:px-20 py-6 sm:py-10 bg-white" ref={ref}>
      <motion.h2
        initial={{ opacity: 0, x: 50 }}
        animate={isInView ? { opacity: 1, x: 0 } : { opacity: 0, x: 50 }}
        transition={{ duration: 0.6 }}
        className="text-black text-4xl sm:text-5xl md:text-6xl font-semibold font-inter mb-6 sm:mb-10 text-left"
      >
        {renderTitleWithEmerald("What's on Build Market")}
      </motion.h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 sm:gap-8">
        {filteredFeatures.map((feature, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 30 }}
            animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
            transition={{ duration: 0.5, delay: index * 0.15 }}
          >
            <FeatureCard {...feature} />
          </motion.div>
        ))}
      </div>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
        transition={{ duration: 0.6, delay: 0.4 }}
        className="mt-6 text-center"
      >
      </motion.div>
    </section>
  );
};
  