"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, Home } from "lucide-react";
import { Fragment } from "react";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export interface BreadcrumbsProps {
  items?: BreadcrumbItem[];
}

export function Breadcrumbs({ items }: BreadcrumbsProps = {}) {
  const pathname = usePathname();
  
  // If custom items are provided, use them
  if (items && items.length > 0) {
    return (
      <nav aria-label="Breadcrumb" className="mb-4 flex items-center space-x-2 text-sm text-muted-foreground">
        <Link 
          href="/" 
          className="flex items-center hover:text-foreground transition-colors"
        >
          <Home className="h-4 w-4" />
        </Link>
        
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          
          return (
            <Fragment key={item.label}>
              <ChevronRight className="h-4 w-4 text-muted-foreground/50" />
              {item.href && !isLast ? (
                <Link
                  href={item.href}
                  className="hover:text-foreground transition-colors"
                >
                  {item.label}
                </Link>
              ) : (
                <span className={`${isLast ? "font-medium text-foreground" : ""}`}>
                  {item.label}
                </span>
              )}
            </Fragment>
          );
        })}
      </nav>
    );
  }

  // Otherwise, auto-generate from pathname
  const segments = pathname.split("/").filter((segment) => segment !== "");

  return (
    <nav aria-label="Breadcrumb" className="mb-4 flex items-center space-x-2 text-sm text-muted-foreground">
      <Link 
        href="/" 
        className="flex items-center hover:text-foreground transition-colors"
      >
        <Home className="h-4 w-4" />
      </Link>
      
      {segments.length > 0 && <ChevronRight className="h-4 w-4 text-muted-foreground/50" />}

      {segments.map((segment, index) => {
        const path = `/${segments.slice(0, index + 1).join("/")}`;
        const isLast = index === segments.length - 1;
        const displayName = segment.replace(/-/g, " ").replace(/^\w/, c => c.toUpperCase());

        return (
          <Fragment key={path}>
            <Link
              href={isLast ? "#" : path}
              className={`hover:text-foreground transition-colors capitalize ${
                isLast ? "font-medium text-foreground pointer-events-none" : ""
              }`}
            >
              {displayName.length > 20 ? displayName.slice(0, 8) + "..." : displayName}
            </Link>
            {!isLast && <ChevronRight className="h-4 w-4 text-muted-foreground/50" />}
          </Fragment>
        );
      })}
    </nav>
  );
}
