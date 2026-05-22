"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "../ui/button";
import {
  Menu,
  X,
  LayoutDashboard,
  MessageSquare,
  Star,
  BookOpen,
  Bell,
  Settings,
} from "lucide-react";
import { UserButton } from "@clerk/nextjs";
import { ROUTES } from "@/lib/links";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

const navItems = [
  { label: "Dashboard", href: ROUTES.userDashboard, icon: LayoutDashboard },
  { label: "Messages", href: ROUTES.messages, icon: MessageSquare },
  { label: "Reviews", href: ROUTES.reviews, icon: Star },
  { label: "Idea Books", href: ROUTES.ideaBooks, icon: BookOpen },
];

export const ClientNavbar = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const pathname = usePathname();

  // Add shadow on scroll for depth
  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <>
      <nav
        className={cn(
          "fixed top-0 left-0 right-0 z-50 h-16 transition-all duration-300 border-b",
          scrolled
            ? "bg-background/90 backdrop-blur-md border-border shadow-sm"
            : "bg-background border-border",
        )}
      >
        <div className="max-w-7xl mx-auto px-4 md:px-8 h-full flex items-center justify-between">
          {/* Logo Section */}
          <Link
            href={ROUTES.userDashboard}
            className="flex items-center gap-2 group"
          >
            <div className="h-8 w-8 bg-primary/15 rounded-lg flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
              <LayoutDashboard size={18} />
            </div>
            <div className="flex flex-col">
              <span className="text-lg font-bold tracking-tight text-foreground leading-none">
                Build<span className="text-primary">Market</span>
              </span>
              <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider leading-none mt-0.5">
                Client Portal
              </span>
            </div>
          </Link>

          {/* Desktop Navigation - Centered */}
          <div className="hidden md:flex items-center gap-1 bg-muted/60 p-1 rounded-full border border-border/70">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              const Icon = item.icon;

              return (
                <Link key={item.href} href={item.href}>
                  <Button
                    variant="ghost"
                    size="sm"
                    className={cn(
                      "text-sm font-medium transition-all duration-200 gap-2 rounded-full px-4 h-9",
                      isActive
                        ? "bg-card text-primary shadow-sm border border-border/70"
                        : "text-muted-foreground hover:bg-accent hover:text-foreground",
                    )}
                  >
                    <Icon
                      className={cn(
                        "h-4 w-4",
                        isActive ? "text-primary" : "text-muted-foreground",
                      )}
                    />
                    {item.label}
                  </Button>
                </Link>
              );
            })}
          </div>

          {/* Right Side Actions */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Notifications */}
            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:text-primary hover:bg-primary/10 relative hidden sm:flex rounded-full"
            >
              <Bell className="h-5 w-5" />
              <span className="absolute top-2 right-2.5 h-2 w-2 bg-red-500 rounded-full border-2 border-white" />
            </Button>

            <div className="h-6 w-px bg-border hidden sm:block mx-1" />

            {/* User Profile */}
            <div className="flex items-center gap-3">
              <div className="hidden lg:block text-right">
                <p className="text-sm font-semibold text-foreground leading-none">
                  My Account
                </p>
                <Link
                  href="/profile"
                  className="text-xs text-muted-foreground hover:text-primary transition-colors"
                >
                  Manage Profile
                </Link>
              </div>
              <UserButton
                appearance={{
                  elements: {
                    avatarBox: "h-9 w-9 ring-2 ring-white shadow-sm",
                  },
                }}
              />
            </div>

            {/* Mobile Menu Toggle */}
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden text-muted-foreground hover:bg-accent ml-1"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            >
              {isMobileMenuOpen ? (
                <X className="h-6 w-6" />
              ) : (
                <Menu className="h-6 w-6" />
              )}
            </Button>
          </div>
        </div>
      </nav>

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileMenuOpen(false)}
              className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 md:hidden top-16"
            />

            {/* Drawer */}
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="fixed inset-x-0 top-16 bg-background border-b border-border z-50 md:hidden shadow-xl rounded-b-2xl overflow-hidden"
            >
              <div className="p-4 flex flex-col gap-1">
                <div className="px-4 py-2 mb-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Navigation
                  </p>
                </div>

                {navItems.map((item) => {
                  const isActive = pathname === item.href;
                  const Icon = item.icon;

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      <div
                        className={cn(
                          "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200",
                          isActive
                            ? "bg-primary/10 text-primary font-medium"
                            : "text-muted-foreground hover:bg-accent hover:pl-6",
                        )}
                      >
                        <Icon
                          className={cn(
                            "h-5 w-5",
                            isActive ? "text-primary" : "text-muted-foreground",
                          )}
                        />
                        <span>{item.label}</span>
                        {isActive && (
                          <div className="ml-auto w-1.5 h-1.5 rounded-full bg-primary" />
                        )}
                      </div>
                    </Link>
                  );
                })}

                <div className="h-px bg-border my-3 mx-4" />

                <div className="px-4 py-2 mb-1">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Account
                  </p>
                </div>

                <Link
                  href="/profile"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  <div className="flex items-center gap-3 px-4 py-3 rounded-xl text-muted-foreground hover:bg-accent hover:pl-6 transition-all">
                    <Settings className="h-5 w-5 text-muted-foreground" />
                    <span className="font-medium">Settings</span>
                  </div>
                </Link>

                <Link
                  href="/notifications"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  <div className="flex items-center justify-between px-4 py-3 rounded-xl text-muted-foreground hover:bg-accent hover:pl-6 transition-all">
                    <div className="flex items-center gap-3">
                      <Bell className="h-5 w-5 text-muted-foreground" />
                      <span className="font-medium">Notifications</span>
                    </div>
                    <span className="bg-red-100 text-red-600 text-[10px] font-bold px-2 py-0.5 rounded-full">
                      3 New
                    </span>
                  </div>
                </Link>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
};
