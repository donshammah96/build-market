import type { Config } from "tailwindcss";

/**
 * apps/verification-ops — Tailwind config
 *
 * This app had no tailwind.config at all despite globals.css using v3
 * directives (@tailwind base/components/utilities), which require one for
 * content scanning. Two things folded in here rather than fixed piecemeal:
 *
 * 1. `zinc.750` / `zinc.850` are added explicitly. The UI already reaches
 *    for these (queue tabs bar, table header/hover states, several error/
 *    empty-state screens) as a half-step between Tailwind's default 700/
 *    800/900 - without a config, those classes silently generated nothing.
 *    Defining them here (rather than swapping every usage to the nearest
 *    default shade) preserves that original design intent. Values below
 *    are the linear midpoint between the adjacent default zinc shades.
 * 2. globals.css's --background/--foreground/--primary/--primary-foreground
 *    CSS variables are wired into theme.extend.colors so they're actually
 *    usable via bg-background/text-foreground/bg-primary. They were dead
 *    (defined, never consumed) before this - if the team decides not to
 *    adopt the semantic classes, delete both the variables and this wiring
 *    together rather than leaving one half of an unfinished migration.
 *
 * No plugins added (no @tailwindcss/forms, no typography) - nothing in
 * this app currently needs them, and staying lightweight was explicit.
 */
const config: Config = {
  darkMode: "class", // this app is dark-only today (see globals.css comment); "class" strategy costs nothing now and doesn't foreclose a light mode later
  content: [
    "./app/**/*.{ts,tsx}",
    "./__tests__/**/*.{ts,tsx}",
    "../../packages/ui/src/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        zinc: {
          // Midpoint between default zinc-700 (#3f3f46) and zinc-800 (#27272a)
          750: "#333338",
          // Midpoint between default zinc-800 (#27272a) and zinc-900 (#18181b)
          850: "#202023",
        },
      },
    },
  },
  plugins: [],
};

export default config;
