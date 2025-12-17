'use client';

import { features as allFeatures, type Feature } from '../../app/data/homeData';
import FeatureCard from './FeatureCard';
import { motion, useInView } from 'framer-motion';
import { useRef } from 'react';
import { ROUTES } from '@/lib/links';

const defaultFeatures: Feature[] = [
  { title: 'Idea Books', description: 'Curated galleries of Kenyan homes to spark your imagination.', image: '/design.png', imageAlt: 'Idea Books', href: ROUTES.ideaBooks },
  { title: 'Find a Professional', description: 'Connect with verified architects, engineers, and contractors.', image: '/professional.png', imageAlt: 'Find a Professional', href: ROUTES.findProfessional },
  { title: 'Find Properties', description: 'Get free expert guidance on your construction journey.', image: '/hero-realestate.jpg', imageAlt: 'Find Properties', href: ROUTES.properties },
];

export const FeaturesSection: React.FC<{ searchTerm?: string; features?: Feature[] }> = ({ 
  searchTerm = '', 
  features = allFeatures.length > 0 ? allFeatures : defaultFeatures 
}) => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-50px" });

  const filteredFeatures = features.filter(feature =>
    feature.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    feature.description.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  return (
    <section className="py-20 bg-zinc-50" ref={ref}>
      <div className="max-w-[1280px] mx-auto px-4 sm:px-6 md:px-20">
        
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.6 }}
          className="mb-12 max-w-2xl"
        >
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold font-inter text-zinc-900 mb-4 tracking-tight">
            Everything you need to <span className="text-emerald-600">build better.</span>
          </h2>
          <p className="text-zinc-500 text-lg">
            Navigate your construction project with tools designed for the Kenyan market.
          </p>
        </motion.div>

        {/* Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {filteredFeatures.map((feature, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 30 }}
              animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
            >
              <FeatureCard {...feature} />
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};