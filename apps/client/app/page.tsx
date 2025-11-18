"use client";

import { useState } from "react";
import { Navbar } from "../components/layout/NavBar";
import { Hero } from "../components/home/Hero";
import { FeaturesSection } from '../components/home/FeatureSection';
import { Professionals } from '../components/professional/Professionals';
import { VendorsSection } from '../components/vendors/VendorSection';
import { ReviewsSection } from '../components/reviews/ReviewsSection';
import { CTA } from '../components/home/CTA';
import { Footer } from '../components/layout/Footer';

export default function Home() {
  const [searchTerm, setSearchTerm] = useState('');
  
  return (
    <main className="overflow-hidden mx-auto max-w-screen-2xl bg-white">
      <Navbar />
      <Hero />
      <FeaturesSection searchTerm={searchTerm} />
      <Professionals />
      <VendorsSection searchTerm={searchTerm} />
      <ReviewsSection searchTerm={searchTerm} />
      <CTA />
      <Footer />
    </main>
  );
}