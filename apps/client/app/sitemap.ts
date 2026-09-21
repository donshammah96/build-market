import type { MetadataRoute } from "next";
import { env } from "@/app/lib/infrastructure/env";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = env.appUrl ?? "http://localhost:3500";
  const now = new Date();

  const routes = [
    // Core discovery
    { path: "", priority: 1.0, changeFrequency: "daily" as const },
    {
      path: "/professionals",
      priority: 0.9,
      changeFrequency: "daily" as const,
    },
    { path: "/properties", priority: 0.8, changeFrequency: "daily" as const },
    { path: "/stores", priority: 0.8, changeFrequency: "daily" as const },
    { path: "/idea-books", priority: 0.7, changeFrequency: "weekly" as const },
    { path: "/reviews", priority: 0.7, changeFrequency: "weekly" as const },
    {
      path: "/professional",
      priority: 0.8,
      changeFrequency: "weekly" as const,
    },

    // Legal & Governance
    {
      path: "/legal/privacy",
      priority: 0.4,
      changeFrequency: "monthly" as const,
    },
    {
      path: "/legal/terms",
      priority: 0.4,
      changeFrequency: "monthly" as const,
    },
    {
      path: "/legal/professional-terms",
      priority: 0.4,
      changeFrequency: "monthly" as const,
    },
    {
      path: "/legal/safety-and-verification",
      priority: 0.4,
      changeFrequency: "monthly" as const,
    },
    {
      path: "/legal/review-policy",
      priority: 0.3,
      changeFrequency: "monthly" as const,
    },
    {
      path: "/legal/disputes-and-complaints",
      priority: 0.3,
      changeFrequency: "monthly" as const,
    },
    {
      path: "/legal/content-moderation",
      priority: 0.3,
      changeFrequency: "monthly" as const,
    },
    {
      path: "/legal/cookie-settings",
      priority: 0.3,
      changeFrequency: "monthly" as const,
    },
    {
      path: "/legal/accessibility",
      priority: 0.3,
      changeFrequency: "monthly" as const,
    },
    { path: "/sitemap", priority: 0.3, changeFrequency: "monthly" as const },
  ];

  return routes.map((route) => ({
    url: `${baseUrl}${route.path}`,
    lastModified: now,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));
}
