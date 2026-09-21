"use client";

import {
  Hammer,
  Paintbrush,
  Lightbulb,
  Wrench,
  DraftingCompass,
  Sprout,
  Briefcase,
  ShoppingBasket,
} from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";

const categories = [
  {
    name: "All Services",
    icon: <ShoppingBasket className="w-4 h-4" />,
    slug: "all",
  },
  {
    name: "General Contracting",
    icon: <Hammer className="w-4 h-4" />,
    slug: "general-contracting",
  },
  {
    name: "Interior Design",
    icon: <Paintbrush className="w-4 h-4" />,
    slug: "interior-design",
  },
  {
    name: "Electrical Services",
    icon: <Lightbulb className="w-4 h-4" />,
    slug: "electrical-services",
  },
  {
    name: "Plumbing",
    icon: <Wrench className="w-4 h-4" />,
    slug: "plumbing",
  },
  {
    name: "Architecture",
    icon: <DraftingCompass className="w-4 h-4" />,
    slug: "architecture",
  },
  {
    name: "Landscaping",
    icon: <Sprout className="w-4 h-4" />,
    slug: "landscaping",
  },
  {
    name: "Consulting",
    icon: <Briefcase className="w-4 h-4" />,
    slug: "consulting",
  },
];

const Categories = () => {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const selectedCategory = searchParams.get("category") || "all";

  const handleChange = useCallback(
    (value: string) => {
      const params = new URLSearchParams(searchParams);
      params.set("category", value);
      router.push(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  return (
    <div
      // Was: bg-gray-100 / text-gray-900 / text-gray-500 / focus:ring-blue-500.
      // These hardcoded Tailwind grays and blue bypassed the app's OKLCH
      // design tokens defined in globals.css, so this component didn't
      // respond to dark mode and used a focus color that doesn't match the
      // rest of the app's focus-visible ring. Swapped to token classes so
      // it themes correctly and matches the accessibility system already
      // built into the rest of the UI (focus-visible + --focus-ring).
      className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-2 bg-muted p-2 rounded-lg mb-4 text-sm"
      role="tablist"
      aria-label="Service Categories"
    >
      {categories.map((category) => (
        <button
          key={category.slug}
          type="button"
          className={`flex items-center justify-center gap-2 cursor-pointer px-2 py-1 rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 ${
            category.slug === selectedCategory
              ? "bg-card text-foreground shadow-xs"
              : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          }`}
          onClick={() => handleChange(category.slug)}
          role="tab"
          aria-selected={category.slug === selectedCategory}
          aria-label={`Select ${category.name} category`}
        >
          {category.icon}
          <span>{category.name}</span>
        </button>
      ))}
    </div>
  );
};

export default Categories;
