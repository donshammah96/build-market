import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { prisma } from "@build/db";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * 1. Basic Slugify Logic
 * Converts "Roof & Gutter Repair!" -> "roof-and-gutter-repair"
 */
export function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-") // Replace spaces with -
    .replace(/&/g, "-and-") // Replace & with 'and'
    .replace(/[^\w-]+/g, "") // Remove all non-word chars
    .replace(/-+/g, "-") // Replace multiple - with single -
    .replace(/^-+/, "") // Trim - from start of text
    .replace(/-+$/, ""); // Trim - from end of text
}

/**
 * 2. Unique Slug Generator
 * Checks the database and appends a counter if the slug exists.
 * * @param model - The Prisma model delegate (e.g. db.serviceCategory)
 * @param name - The string you want to turn into a slug (e.g. "Interior Design")
 * @returns A unique slug string (e.g. "interior-design-1")
 */
export async function generateUniqueSlug(
  model: string,
  name: string
): Promise<string> {
  const slug = slugify(name);
  let uniqueSlug = slug;
  let count = 1;

  const delegate = (
    prisma as unknown as Record<
      string,
      {
        findUnique: (args: {
          where: { slug: string };
          select?: { id: true };
        }) => Promise<{ id: string } | null>;
      }
    >
  )[model];

  if (!delegate) {
    throw new Error(`Invalid model: ${model}`);
  }

  // Keep looping until we find a slug that doesn't exist
  while (true) {
    // Check if this slug already exists in the specific model
    const existingEntry = await delegate.findUnique({
      where: { slug: uniqueSlug },
      select: { id: true },
    });

    // If not found, it's unique! Return it.
    if (!existingEntry) {
      return uniqueSlug;
    }

    // If found, increment counter and try again
    uniqueSlug = `${slug}-${count}`;
    count++;
  }
}
