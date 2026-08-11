import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/constants/brand";

const PUBLIC_ROUTES = ["", "/pricing", "/privacy", "/terms"] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  return PUBLIC_ROUTES.map((path) => ({
    url: `${SITE_URL}${path}`,
  }));
}
