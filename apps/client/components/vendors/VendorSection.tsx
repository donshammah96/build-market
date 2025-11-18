import { stores as allStores, type Store } from '../../app/data/homeData';
import VendorCard from './VendorCard';
import Link from 'next/link';
import { ROUTES } from '../../app/lib/links';
import { motion, useInView } from 'framer-motion';
import { useRef } from 'react';
import { Button } from '../ui/button';
import { VendorCardData } from '../../types/vendor';

// Mock data fallback
const defaultStores: VendorCardData[] = [
  {
    id: '1',
    name: 'Evannas Hardware Store',
    description: 'We sell a variety of hardware products for your home and business.',
    imageUrl: '/hardware.png',
    categories: ['Hardware'],
    verified: true,
    rating: 4.5,
    reviewCount: 100,
    productCount: 1000,
    location: 'Nairobi, Kenya',
    address: '123 Main St, Nairobi',
    city: 'Nairobi',
    state: 'Nairobi',
    zipCode: '00100'
  },
  {
    id: '2',
    name: 'Shammah Kitchen Fixtures',
    description: 'We sell a variety of kitchen fixtures for your home and business.',
    imageUrl: '/kitchen-fixtures.png',
    categories: ['Kitchen', 'Bathroom', 'Living Room', 'Dining Room', 'Office'],
    verified: true,
    rating: 4.5,
    reviewCount: 100,
    productCount: 1000,
    location: 'Nairobi, Kenya',
    address: '123 Main St, Nairobi',
    city: 'Nairobi',
    state: 'Nairobi',
    zipCode: '00100'
  }
];

// Helper function to convert Store from homeData to VendorCardData
const convertStoreToVendorCardData = (store: Store): VendorCardData => ({
  id: store.href.split('/').pop() || Math.random().toString(),
  name: store.title,
  description: store.description,
  imageUrl: store.image,
  categories: [store.title],
  verified: false,
});

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

export const VendorsSection: React.FC<{ searchTerm?: string; stores?: Store[] | VendorCardData[] }> = ({ 
  searchTerm = '', 
  stores 
}) => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  // Convert stores to VendorCardData format
  const vendorCards: VendorCardData[] = (stores || (allStores.length > 0 ? allStores : defaultStores)).map(store => {
    // Check if it's a Store from homeData (has 'title' property)
    if ('title' in store) {
      return convertStoreToVendorCardData(store as Store);
    }
    // Otherwise it's already VendorCardData
    return store as VendorCardData;
  });

  const filteredStores = vendorCards.filter(vendor =>
    vendor.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (vendor.description && vendor.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );
  
  return (
    <section className="px-4 sm:px-6 md:px-20 py-6 sm:py-10 bg-white" ref={ref}>
      <motion.h2
        initial={{ opacity: 0, x: 50 }}
        animate={isInView ? { opacity: 1, x: 0 } : { opacity: 0, x: 50 }}
        transition={{ duration: 0.6 }}
        className="text-black text-4xl sm:text-5xl md:text-6xl font-semibold font-inter mb-6 sm:mb-10 text-left"
      >
        {renderTitleWithEmerald("Browse Online Stores")}
      </motion.h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
        {filteredStores.map((vendor, index) => (
          <VendorCard
            key={vendor.id}
            vendor={vendor}
            index={index}
            isInView={isInView}
          />
        ))}
      </div>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
        transition={{ duration: 0.6, delay: 0.4 }}
        className="mt-6 text-center"
      ><motion.div
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      transition={{ duration: 0.2 }}
    >
      <Button asChild size="lg">
        <Link href={ROUTES.hardwareShops} className="inline-flex items-center gap-1">
          Explore More Stores <span aria-hidden>→</span>
        </Link>
      </Button>
    </motion.div>
        
      </motion.div>
    </section>
  );
};