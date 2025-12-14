"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, Home } from "lucide-react";
import { Fragment } from "react";

export function Breadcrumbs() {
  const pathname = usePathname();
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

        // Don't format UUIDs strictly, but maybe truncate? 
        // For now, if it looks like a long ID, we might keep it or label it.
        // Simple capitalization is fine for now.

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
