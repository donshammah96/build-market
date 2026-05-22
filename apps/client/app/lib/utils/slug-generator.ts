import { nanoid } from "nanoid";

export function generateIdeaBookSlug(title: string) {
  // 1. Convert title to lowercase, remove special chars, replace spaces with dashes
  const baseSlug = title
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");

  // 2. Append a short random string (e.g., 5 characters) to guarantee uniqueness
  // Result: "dream-kitchen-a1b2c"
  const uniqueSuffix = nanoid(5);

  return `${baseSlug}-${uniqueSuffix}`;
}
