'use client';

import VendorCard from '../vendors/VendorCard';
import Link from 'next/link';
import { ROUTES } from '@/lib/links';
import { motion, useInView } from 'framer-motion';
import { useRef, useState } from 'react';
import { Button } from '../ui/button';
import { VendorCardData } from '../../types/vendor';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi
} from '../ui/carousel';

const defaultStores: VendorCardData[] = [
  {
    id: '1',
    name: "Evannas Hardware Store",
    description: 'We sell a variety of hardware products for your home and business.',
    imageUrl: '/hardware.png',
    categories: ['Hardware'],
    verified: true,
    rating: 4.5,
    reviewCount: 100,
    productCount: 1000,
    location: 'Nairobi, Kenya',
    address: 'Lavington, Nairobi',
    city: 'Nairobi',
    zipCode: '00100'
  },
  {
    id: '2',
    name: "Shammah's Kitchen Fixtures",
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
    zipCode: '00100'
  }, 
  {
    id: '3',
    name: "Roy's Bespoke Tiles",
    description: 'We sell a variety of tiles for your home and business.',
    imageUrl: '/tiles.png',
    categories: ['Tiles'],
    verified: true,
    rating: 4.5,
    reviewCount: 100,
    productCount: 1000,
    location: 'Nairobi, Kenya',
    address: 'Waiyaki Way, Nairobi',
    city: 'Nairobi',
    zipCode: '00100'
  },
  {
    id: '4',
    name: "Amanda's Interior Designs",
    description: 'We deal in interior design products for your home and business.',
    imageUrl: '/home-decor.png',
    categories: ['Interior Design'],
    verified: true,
    rating: 4.5,
    reviewCount: 100,
    productCount: 1000,
    location: 'Embu, Kenya',
    address: '123 Main St, Nairobi',
    city: 'Embu',
    zipCode: '60100'
  }
];

export const VendorsSection: React.FC<{ searchTerm?: string; stores?: VendorCardData[] }> = ({ 
  searchTerm = '', 
  stores 
}) => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });
  const [api, setApi] = useState<CarouselApi>();

  const vendorCards: VendorCardData[] = stores || defaultStores;
  const filteredStores = vendorCards.filter(vendor =>
    vendor.name.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  return (
    <section className="py-20 bg-white" ref={ref}>
      <div className="max-w-[1280px] mx-auto px-4 sm:px-6 md:px-20">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-end mb-10 gap-6">
           <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={isInView ? { opacity: 1, x: 0 } : { opacity: 0, x: -20 }}
            transition={{ duration: 0.6 }}
          >
            <div className="inline-block px-3 py-1 mb-3 text-xs font-semibold tracking-wider text-amber-600 uppercase bg-amber-50 rounded-full">
              Marketplace
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold font-inter text-zinc-900 tracking-tight">
              Top Rated <span className="text-emerald-600">Suppliers</span>
            </h2>
          </motion.div>

           {/* Controls */}
           <div className="hidden sm:flex gap-2">
            <Button 
              variant="outline" 
              size="icon" 
              className="rounded-full border-zinc-300 hover:border-emerald-500 hover:text-emerald-600"
              onClick={() => api?.scrollPrev()}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <Button 
              variant="outline" 
              size="icon" 
              className="rounded-full border-zinc-300 hover:border-emerald-500 hover:text-emerald-600"
              onClick={() => api?.scrollNext()}
            >
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
        
        <Carousel
          setApi={setApi}
          opts={{ align: "start", loop: true }}
          className="w-full"
        >
          <CarouselContent className="-ml-4">
            {filteredStores.map((vendor, index) => (
              <CarouselItem key={vendor.id} className="pl-4 md:basis-1/2 lg:basis-1/3">
                <motion.div
                   initial={{ opacity: 0, y: 20 }}
                   animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
                   transition={{ delay: index * 0.1, duration: 0.5 }}
                   className="h-full"
                >
                    <VendorCard vendor={vendor} />
                </motion.div>
              </CarouselItem>
            ))}
          </CarouselContent>
        </Carousel>

        <div className="mt-12 text-center">
            <Button variant="ghost" size="lg" className="text-zinc-500 hover:text-emerald-600" asChild>
                <Link href={ROUTES.hardwareShops}>
                   Browse all suppliers <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
            </Button>
        </div>
      </div>
    </section>
  );
};