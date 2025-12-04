'use client';

import React, { useState, useEffect } from 'react';
import Link from "next/link";
import { Button } from "../ui/button";
import { Menu, X, LayoutDashboard, UserCircle } from "lucide-react";
import {
  SignedIn,
  SignedOut,
  SignInButton,
  SignUpButton,
  UserButton,
  useUser,
} from "@clerk/nextjs";
import { ROUTES } from '@/lib/links';
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

const navItems = [
  { label: "Home", href: ROUTES.home },
  { label: "Idea Books", href: ROUTES.ideaBooks },
  { label: "Find Professionals", href: ROUTES.findProfessional },
  { label: "Guidance", href: ROUTES.speakWithAdvisor },
];

interface NavbarProps {
  onSignUpClick?: () => void;
  onLogoClick?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onLogoClick }) => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { user } = useUser();

  const userRole = user?.publicMetadata?.role as string | undefined;

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Dynamic classes for text visibility
  const textColorClass = isScrolled ? "text-zinc-900" : "text-white";
  const hoverColorClass = "hover:text-emerald-500 transition-colors";

  return (
    <>
      <motion.nav
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.5 }}
        className={cn(
          "fixed top-0 left-0 right-0 z-50 transition-all duration-300 border-b",
          isScrolled 
            ? "bg-white/90 backdrop-blur-md border-zinc-200/50 shadow-sm py-3" 
            : "bg-transparent border-transparent py-5"
        )}
      >
        <div className="max-w-[1440px] mx-auto px-4 md:px-8 flex items-center justify-between">
          
          {/* Logo */}
          <Link 
            href="/" 
            className="z-50"
            onClick={onLogoClick}
          >
            <span className={cn("text-2xl font-bold tracking-tight transition-colors", textColorClass)}>
              Build<span className="text-emerald-500">Market</span>
            </span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-1">
            {navItems.map((item) => (
              <Link key={item.href} href={item.href}>
                <Button
                  variant="ghost"
                  className={cn(
                    "text-sm font-medium transition-all duration-200", 
                    textColorClass,
                    isScrolled ? "hover:bg-zinc-100" : "hover:bg-white/10"
                  )}
                >
                  {item.label}
                </Button>
              </Link>
            ))}

            <div className="h-6 w-px bg-zinc-300/30 mx-2" />

            {/* Auth Buttons */}
            <SignedOut>
              <SignInButton mode="modal" forceRedirectUrl={ROUTES.onboarding}>
                <Button 
                  variant="ghost" 
                  className={cn("font-medium", textColorClass, isScrolled ? "hover:bg-zinc-100" : "hover:bg-white/10")}
                >
                  Sign In
                </Button>
              </SignInButton>
              <SignUpButton mode="modal" forceRedirectUrl={ROUTES.onboarding}>
                <Button className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-md rounded-full px-6">
                  Join as a Pro
                </Button>
              </SignUpButton>
            </SignedOut>

            <SignedIn>
              {userRole === 'client' && (
                <Link href={ROUTES.client}>
                  <Button variant="ghost" size="sm" className={cn(textColorClass)}>
                    <LayoutDashboard className="mr-2 h-4 w-4" />
                    Dashboard
                  </Button>
                </Link>
              )}
               <div className="ml-2">
                 <UserButton afterSignOutUrl="/" />
               </div>
            </SignedIn>
          </div>

          {/* Mobile Menu Toggle */}
          <Button
            variant="ghost"
            size="icon"
            className={cn("md:hidden", textColorClass, isScrolled ? "hover:bg-zinc-100" : "hover:bg-white/10")}
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            {isMobileMenuOpen ? <X /> : <Menu />}
          </Button>
        </div>
      </motion.nav>

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, x: "100%" }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed inset-0 bg-white z-40 md:hidden pt-24 px-6 flex flex-col gap-6"
          >
             {navItems.map((item, index) => (
                <motion.div
                  key={item.href}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <Link 
                    href={item.href} 
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="block text-2xl font-semibold text-zinc-900 py-2 border-b border-zinc-100"
                  >
                    {item.label}
                  </Link>
                </motion.div>
              ))}

              <div className="mt-4 flex flex-col gap-3">
                <SignedOut>
                  <SignInButton mode="modal">
                    <Button variant="outline" size="lg" className="w-full justify-center">Sign In</Button>
                  </SignInButton>
                  <SignUpButton mode="modal">
                    <Button size="lg" className="w-full justify-center bg-emerald-600">Join as a Pro</Button>
                  </SignUpButton>
                </SignedOut>
                
                <SignedIn>
                   {/* Mobile Dashboard Links */}
                   <Link href={userRole === 'professional' ? '/professional-portal/dashboard' : '/dashboard'}>
                      <Button variant="secondary" size="lg" className="w-full justify-start">
                        <LayoutDashboard className="mr-2 h-4 w-4" />
                        My Dashboard
                      </Button>
                   </Link>
                   <div className="flex items-center gap-2 mt-4">
                      <UserButton afterSignOutUrl="/" />
                      <span className="text-zinc-500">Manage Account</span>
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