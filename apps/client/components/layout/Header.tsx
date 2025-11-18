'use client';
import { useState, useCallback, useRef } from  'react';
import Link from 'next/link';
import { ROUTES } from '../../app/lib/links';
import { MobileNav } from './MobileNav';
import SearchBar from '../forms/SearchBar';
import Image from 'next/image';
import { SignedIn, SignedOut, SignInButton } from '@clerk/nextjs';
import ProfileButton from '../shared/ProfileButton';
export const Header = () => {
  
    return (
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
          <Link href="/" className="flex items-center">
            <Image
              src="/bm-logo-main.png"
              alt="Build Market"
              width={36}
              height={36}
              className="w-6 h-6 md:w-9 md:h-9"
            />
            <p className="hidden md:block text-md font-medium tracking-wider">
              BUILD MARKET.
            </p>
           </Link>
           <div className="flex items-center gap-6">
           <nav className="hidden md:flex items-center gap-8" role="navigation" aria-label="Main navigation">
              <Link href={ROUTES.ideaBooks} className="text-black text-md font-medium font-['Inter'] leading-loose">Idea Books</Link>
              <Link href={ROUTES.findProfessional} className="text-black text-md font-medium font-['Inter'] leading-loose">Find Professionals</Link>
              <Link href={ROUTES.speakWithAdvisor} className="text-black text-md font-medium font-['Inter'] leading-loose">Guidance</Link>
              <div className="flex items-center gap-6">
              <SignedOut>
                <SignInButton forceRedirectUrl={ROUTES.onboarding} />
              </SignedOut>
              <SignedIn>
                <ProfileButton />
              </SignedIn>
              </div>
            </nav>
           </div>
            <MobileNav />
            </div>
          </div>
      </header>
    );
  };