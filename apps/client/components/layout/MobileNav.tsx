'use client';

import { ROUTES } from "../../app/lib/links";
import { useState, useEffect, useRef } from 'react';
import { Bars3Icon, XMarkIcon } from '@heroicons/react/24/outline';
import Link from 'next/link';

export const MobileNav: React.FC = () => {
    const [isOpen, setIsOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);
  
    const toggleMenu = () => setIsOpen(!isOpen);
    const closeMenu = () => setIsOpen(false);
  
    useEffect(() => {
      if (isOpen && menuRef.current) {
        const focusableElements = menuRef.current.querySelectorAll(
          'a[href], button, input, textarea, select, details, [tabindex]:not([tabindex="-1"])'
        ) as NodeListOf<HTMLElement>;
        const firstElement = focusableElements.item(0);
        const lastElement = focusableElements.item(focusableElements.length - 1);
  
        if (!firstElement || !lastElement) {
          return;
        }
  
        const handleKeyDown = (e: KeyboardEvent) => {
          if (e.key === 'Escape') {
            closeMenu();
            return;
          }
  
          if (e.key === 'Tab') {
            if (e.shiftKey) {
              // Shift + Tab
              if (document.activeElement === firstElement) {
                e.preventDefault();
                lastElement.focus();
              }
            } else {
              // Tab
              if (document.activeElement === lastElement) {
                e.preventDefault();
                firstElement.focus();
              }
            }
          }
        };
  
        document.addEventListener('keydown', handleKeyDown);
        firstElement.focus();
  
        return () => {
          document.removeEventListener('keydown', handleKeyDown);
        };
      }
    }, [isOpen]);
  
    return (
      <div ref={menuRef}>
        <button
          className="md:hidden p-2 focus:outline-none focus:ring-2 focus:ring-black rounded"
          onClick={toggleMenu}
          aria-label="Toggle mobile menu"
          aria-expanded={isOpen}
        >
          <Bars3Icon className="w-6 h-6" />
        </button>
        <nav
          className={`fixed inset-0 z-50 bg-white flex flex-col items-center justify-center gap-6 md:hidden transition-transform duration-300 ease-in-out ${
            isOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
          role="navigation"
          aria-label="Mobile navigation"
        >
          <button
            className="absolute top-4 right-4 p-2 focus:outline-none focus:ring-2 focus:ring-black rounded"
            onClick={closeMenu}
            aria-label="Close mobile menu"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
          <Link
            href={ROUTES.ideaBooks}
            className="text-black text-2xl font-medium font-['Inter']"
            onClick={closeMenu}
          >
            Idea Books
          </Link>
          <Link
            href={ROUTES.findProfessional}
            className="text-black text-2xl font-medium font-['Inter']"
            onClick={closeMenu}
          >
            Find Professionals
          </Link>
          <Link
            href={ROUTES.speakWithAdvisor}
            className="text-black text-2xl font-medium font-['Inter']"
            onClick={closeMenu}
          >
            Guidance
          </Link>
        </nav>
      </div>
    );
  };