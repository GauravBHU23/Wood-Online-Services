import type { MetadataRoute } from "next";
import { createAdminClient } from "@/lib/supabase/admin";

const STATIC_ROUTES = ["", "/shop", "/about", "/contact", "/shipping-returns", "/privacy", "/terms", "/license"];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const admin = createAdminClient();

  const [productsResult, categoriesResult] = await Promise.all([
    admin.from("products").select("id, created_at").eq("is_available", true),
    admin.from("categories").select("id").eq("is_active", true),
  ]);

  const products: { id: number; created_at: string }[] = productsResult.data ?? [];
  const categories: { id: number }[] = categoriesResult.data ?? [];

  const staticEntries: MetadataRoute.Sitemap = STATIC_ROUTES.map((path) => ({
    url: `${siteUrl}${path}`,
    lastModified: new Date(),
    priority: path === "" ? 1 : 0.6,
  }));

  const productEntries: MetadataRoute.Sitemap = products.map((p) => ({
    url: `${siteUrl}/shop/${p.id}`,
    lastModified: new Date(p.created_at),
    priority: 0.8,
  }));

  const categoryEntries: MetadataRoute.Sitemap = categories.map((c) => ({
    url: `${siteUrl}/shop?categoryId=${c.id}`,
    lastModified: new Date(),
    priority: 0.7,
  }));

  return [...staticEntries, ...productEntries, ...categoryEntries];
}
