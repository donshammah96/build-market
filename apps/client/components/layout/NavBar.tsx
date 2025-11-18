'use client';

import React, { useState, useEffect } from 'react';
import Link from "next/link";
import { Button } from "../ui/button";
import { Menu, X, LayoutDashboard } from "lucide-react";
import {
  SignedIn,
  SignedOut,
  SignInButton,
  SignUpButton,
  UserButton,
  useUser,
} from "@clerk/nextjs";
import { ROUTES } from '../../app/lib/links';
import { motion, AnimatePresence } from "framer-motion";

const navItems = [
  { label: "Home", href: ROUTES.home },
  { label: "Idea Books", href: ROUTES.ideaBooks },
  { label: "Find Professionals", href: ROUTES.findProfessional },
  { label: "Guidance", href: ROUTES.speakWithAdvisor },
];

export const Navbar: React.FC = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { user } = useUser();

  // Get user role from Clerk metadata
  const userRole = user?.publicMetadata?.role as string | undefined;

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <>
      <motion.nav
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.5 }}
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          isScrolled 
            ? "bg-slate-900/95 backdrop-blur-sm shadow-lg" 
            : "bg-white/95 backdrop-blur-sm shadow-lg"
        }`}
      >
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          {/* Logo */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            <Link href="/" className={`text-xl font-bold ${isScrolled ? 'text-white' : 'text-black'} hover:text-emerald-400 transition-colors`}>
              Build Market
            </Link>
          </motion.div>

          {/* Desktop Navigation */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="hidden md:flex items-center gap-2"
          >
            {navItems.map((item) => (
              <Link key={item.href} href={item.href}>
                <Button
                  variant="ghost"
                  className={`${isScrolled ? 'text-white' : 'text-black'} hover:text-emerald-400 ${isScrolled ? 'hover:bg-slate-800' : 'hover:bg-gray-100'}`}
                >
                  {item.label}
                </Button>
              </Link>
            ))}

            {/* Clerk Auth Buttons */}
            <SignedOut>
              <SignInButton mode="modal" forceRedirectUrl={ROUTES.onboarding}>
                <Button variant="ghost" className={`${isScrolled ? 'text-white' : 'text-black'} hover:text-emerald-400`}>
                  Sign In
                </Button>
              </SignInButton>
              <SignUpButton mode="modal" forceRedirectUrl={ROUTES.onboarding}>
                <Button variant="default" className="bg-emerald-500 hover:bg-emerald-600">
                  Join as a Pro
                </Button>
              </SignUpButton>
            </SignedOut>
            <SignedIn>
              {/* Dashboard link based on user role */}
              {userRole === 'client' && (
                <Link href={ROUTES.client}>
                  <Button
                    variant="ghost"
                    className={`${isScrolled ? 'text-white' : 'text-black'} hover:text-emerald-400 ${isScrolled ? 'hover:bg-slate-800' : 'hover:bg-gray-100'}`}
                  >
                    <LayoutDashboard className="mr-2 h-4 w-4" />
                    Dashboard
                  </Button>
                </Link>
              )}
              <UserButton afterSignOutUrl="/" />
            </SignedIn>
          </motion.div>

          {/* Mobile Menu Button */}
          <Button
            variant="ghost"
            size="icon"
            className={`md:hidden ${isScrolled ? 'text-white' : 'text-black'} ${isScrolled ? 'hover:bg-slate-800' : 'hover:bg-gray-100'}`}
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            {isMobileMenuOpen ? <X /> : <Menu />}
          </Button>
        </div>
      </motion.nav>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, x: "100%" }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: "100%" }}
            transition={{ type: "spring", damping: 25 }}
            className="fixed top-16 right-0 bottom-0 w-64 bg-slate-900/98 backdrop-blur-sm z-40 md:hidden"
          >
            <div className="flex flex-col gap-2 p-4">
              {navItems.map((item, index) => (
                <motion.div
                  key={item.href}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <Link href={item.href} onClick={() => setIsMobileMenuOpen(false)}>
                    <Button
                      variant="ghost"
                      className="w-full justify-start text-white hover:text-emerald-400 hover:bg-slate-800"
                    >
                      {item.label}
                    </Button>
                  </Link>
                </motion.div>
              ))}

              {/* Mobile Auth Buttons */}
              <SignedOut>
                <SignInButton mode="modal" forceRedirectUrl={ROUTES.onboarding}>
                  <Button variant="ghost" className="w-full justify-start text-white">
                    Sign In
                  </Button>
                </SignInButton>
                <SignUpButton mode="modal" forceRedirectUrl={ROUTES.onboarding}>
                  <Button className="w-full bg-emerald-500 hover:bg-emerald-600">
                    Join as a Pro
                  </Button>
                </SignUpButton>
              </SignedOut>
              <SignedIn>
                {/* Dashboard link for mobile */}
                {userRole === 'client' && (
                  <Link href={ROUTES.client} onClick={() => setIsMobileMenuOpen(false)}>
                    <Button
                      variant="ghost"
                      className="w-full justify-start text-white hover:text-emerald-400 hover:bg-slate-800"
                    >
                      <LayoutDashboard className="mr-2 h-4 w-4" />
                      Dashboard
                    </Button>
                  </Link>
                )}
                {userRole === 'professional' && (
                  <Link href="/professional" onClick={() => setIsMobileMenuOpen(false)}>
                    <Button
                      variant="ghost"
                      className="w-full justify-start text-white hover:text-emerald-400 hover:bg-slate-800"
                    >
                      <LayoutDashboard className="mr-2 h-4 w-4" />
                      Dashboard
                    </Button>
                  </Link>
                )}
                <div className="p-2">
                  <UserButton afterSignOutUrl="/" />
                </div>
              </SignedIn>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default Navbar;