import type { MetadataRoute } from "next";

const BASE = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3100";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/request", "/login", "/privacy", "/terms", "/data-retention", "/r/"],
        // authenticated app area + APIs stay out of the index
        disallow: ["/api/", "/dashboard", "/calendar", "/meetings", "/admin", "/profile", "/reports", "/users", "/people", "/branches", "/notifications", "/meeting-requests", "/availability", "/checkin/"],
      },
    ],
    sitemap: `${BASE}/sitemap.xml`,
  };
}
