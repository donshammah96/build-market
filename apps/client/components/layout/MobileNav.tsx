"use client";

import { useState, useEffect, useRef } from "react";
import { Bars3Icon, XMarkIcon } from "@heroicons/react/24/outline";
import Link from "next/link";
import { publicNavItems } from "@/app/lib/config/nav-config";

export const MobileNav: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const toggleMenu = () => setIsOpen((prev) => !prev);
  const closeMenu = () => setIsOpen(false);

  useEffect(() => {
    if (isOpen && menuRef.current) {
      const focusableElements = menuRef.current.querySelectorAll(
        'a[href], button, input, textarea, select, details, [tabindex]:not([tabindex="-1"])',
      ) as NodeListOf<HTMLElement>;
      const firstElement = focusableElements.item(0);
      const lastElement = focusableElements.item(focusableElements.length - 1);

      if (!firstElement || !lastElement) {
        return;
      }

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Escape") {
          closeMenu();
          return;
        }

        if (e.key === "Tab") {
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

      document.addEventListener("keydown", handleKeyDown);
      firstElement.focus();

      return () => {
        document.removeEventListener("keydown", handleKeyDown);
      };
    }

    // Restore focus to the trigger when the menu closes, instead of
    // leaving focus stranded on whatever the last-focused menu item was.
    if (!isOpen) {
      triggerRef.current?.focus();
    }
  }, [isOpen]);

  return (
    <div ref={menuRef}>
      <button
        ref={triggerRef}
        className="md:hidden min-h-11 min-w-11 p-2 rounded text-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2"
        onClick={toggleMenu}
        aria-label="Toggle mobile menu"
        aria-expanded={isOpen}
      >
        <Bars3Icon className="w-6 h-6" />
      </button>
      <nav
        className={`fixed inset-0 z-50 bg-background flex flex-col items-center justify-center gap-6 md:hidden transition-transform duration-300 ease-in-out ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        role="navigation"
        aria-label="Mobile navigation"
        aria-hidden={!isOpen}
        // `inert` stops the browser from allowing focus/interaction into
        // the offscreen menu, which aria-hidden alone does not guarantee
        // for programmatic Tab traversal. Applied only while closed.
        inert={!isOpen}
      >
        <button
          className="absolute top-4 right-4 min-h-11 min-w-11 p-2 rounded text-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2"
          onClick={closeMenu}
          aria-label="Close mobile menu"
          tabIndex={isOpen ? 0 : -1}
        >
          <XMarkIcon className="w-6 h-6" />
        </button>
        {publicNavItems.map((item) => (
          <Link
            key={item.key}
            href={item.href}
            className="min-h-11 py-2 text-2xl font-medium text-foreground hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 rounded-sm"
            onClick={closeMenu}
            tabIndex={isOpen ? 0 : -1}
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </div>
  );
};
