import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

export type Product = Database["public"]["Tables"]["products"]["Row"];
export type Category = Database["public"]["Tables"]["categories"]["Row"];
export type ProductImage = Database["public"]["Tables"]["product_images"]["Row"];

export type ProductWithCategory = Product & { category: Category | null };
export type ProductDetail = Product & { category: Category | null; images: ProductImage[] };

export const PAGE_SIZE = 12;

export type ShopSort = "newest" | "price-low" | "price-high" | "name" | "rating" | "popular";

export interface ShopFilters {
  categoryId?: number;
  search?: string;
  woodType?: string;
  minPrice?: number;
  maxPrice?: number;
  minRating?: number;
  sort?: ShopSort;
  page?: number;
}

export interface ShopResult {
  products: ProductWithCategory[];
  totalCount: number;
  page: number;
  pageSize: number;
  categories: Category[];
  woodTypes: string[];
  categoryName?: string;
}

/**
 * Ported from ShopController.Index. Custom-order items (price = 0, quoted on request) are
 * never dropped by a price filter and are pushed to the end of price sorts, same as the
 * original QueryableExtensions.ThenByPrice behaviour.
 */
export async function getShopProducts(filters: ShopFilters): Promise<ShopResult> {
  const supabase = await createClient();
  const page = Math.max(1, filters.page ?? 1);
  const sort = filters.sort ?? "newest";

  let query = supabase
    .from("products")
    .select("*, category:categories(*)", { count: "exact" })
    .eq("is_available", true);

  if (filters.categoryId && filters.categoryId > 0) {
    query = query.eq("category_id", filters.categoryId);
  }

  if (filters.search && filters.search.trim()) {
    const term = filters.search.trim().slice(0, 80).replace(/[%_]/g, "\\$&");
    query = query.or(
      `name.ilike.%${term}%,description.ilike.%${term}%,wood_type.ilike.%${term}%`
    );
  }

  if (filters.woodType) {
    query = query.eq("wood_type", filters.woodType);
  }

  if (filters.minPrice && filters.minPrice > 0) {
    query = query.or(`price.gte.${filters.minPrice},is_custom_order.eq.true`);
  }

  if (filters.maxPrice && filters.maxPrice > 0) {
    query = query.or(`price.lte.${filters.maxPrice},is_custom_order.eq.true`);
  }

  if (filters.minRating && filters.minRating >= 1 && filters.minRating <= 5) {
    query = query.gte("average_rating", filters.minRating);
  }

  switch (sort) {
    case "price-low":
      query = query.order("is_custom_order", { ascending: true }).order("price", { ascending: true });
      break;
    case "price-high":
      query = query.order("is_custom_order", { ascending: true }).order("price", { ascending: false });
      break;
    case "name":
      query = query.order("name", { ascending: true });
      break;
    case "rating":
      query = query
        .order("average_rating", { ascending: false })
        .order("review_count", { ascending: false });
      break;
    case "popular":
      query = query
        .order("review_count", { ascending: false })
        .order("average_rating", { ascending: false });
      break;
    default:
      query = query.order("is_featured", { ascending: false }).order("id", { ascending: false });
  }

  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;
  query = query.range(from, to);

  // Awaited individually (not via Promise.all([...])): mixing several differently-typed
  // PostgrestFilterBuilder chains in one array literal defeats TypeScript's inference and
  // silently collapses every row type to `never`.
  const productsResult = await query;
  const categoriesResult = await supabase
    .from("categories")
    .select("*")
    .eq("is_active", true)
    .order("display_order");
  const woodRowsResult = await supabase
    .from("products")
    .select("wood_type")
    .eq("is_available", true)
    .not("wood_type", "is", null);

  // Bound to an explicitly-typed const before any array method call: chaining .find()/.map()
  // straight off a query's `data` (even via `?? []`) makes TS infer the element type as
  // `never` for this postgrest-js version's conditional GetResult<> return type.
  const products: ProductWithCategory[] = productsResult.data ?? [];
  const categories: Category[] = categoriesResult.data ?? [];
  const woodRows: { wood_type: string | null }[] = woodRowsResult.data ?? [];

  const woodTypes = Array.from(
    new Set(woodRows.map((r) => r.wood_type).filter((w): w is string => !!w))
  ).sort();

  const categoryName =
    filters.categoryId && filters.categoryId > 0
      ? categories.find((c) => c.id === filters.categoryId)?.name
      : undefined;

  return {
    products,
    totalCount: productsResult.count ?? 0,
    page,
    pageSize: PAGE_SIZE,
    categories,
    woodTypes,
    categoryName,
  };
}

export async function getProductById(id: number): Promise<ProductDetail | null> {
  const supabase = await createClient();
  const result = await supabase
    .from("products")
    .select("*, category:categories(*), images:product_images(*)")
    .eq("id", id)
    .maybeSingle();

  const data = result.data as ProductDetail | null;
  if (!data) return null;

  const images: ProductImage[] = data.images ?? [];

  return {
    ...data,
    images: images.sort((a, b) => a.display_order - b.display_order),
  };
}

export async function getRelatedProducts(
  categoryId: number,
  excludeId: number,
  limit = 4
): Promise<ProductWithCategory[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("products")
    .select("*, category:categories(*)")
    .eq("category_id", categoryId)
    .eq("is_available", true)
    .neq("id", excludeId)
    .limit(limit);

  return (data ?? []) as ProductWithCategory[];
}

export async function getFeaturedProducts(limit = 8): Promise<ProductWithCategory[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("products")
    .select("*, category:categories(*)")
    .eq("is_available", true)
    .eq("is_featured", true)
    .order("created_at", { ascending: false })
    .limit(limit);

  return (data ?? []) as ProductWithCategory[];
}

export async function getLatestProducts(limit = 4): Promise<ProductWithCategory[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("products")
    .select("*, category:categories(*)")
    .eq("is_available", true)
    .order("id", { ascending: false })
    .limit(limit);

  return (data ?? []) as ProductWithCategory[];
}

export async function getTopRatedProducts(limit = 4): Promise<ProductWithCategory[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("products")
    .select("*, category:categories(*)")
    .eq("is_available", true)
    .gt("review_count", 0)
    .order("average_rating", { ascending: false })
    .order("review_count", { ascending: false })
    .limit(limit);

  return (data ?? []) as ProductWithCategory[];
}

export interface CategoryWithCount extends Category {
  productCount: number;
}

/** Active categories with their available-product count, for the home page category grid. */
export async function getCategoriesWithCounts(): Promise<CategoryWithCount[]> {
  const supabase = await createClient();
  const categoriesResult = await supabase.from("categories").select("*").eq("is_active", true).order("display_order");
  const categories: Category[] = categoriesResult.data ?? [];

  const countsResult = await supabase.from("products").select("category_id").eq("is_available", true);
  const countRows: { category_id: number }[] = countsResult.data ?? [];

  const counts = new Map<number, number>();
  for (const row of countRows) {
    counts.set(row.category_id, (counts.get(row.category_id) ?? 0) + 1);
  }

  return categories.map((c) => ({ ...c, productCount: counts.get(c.id) ?? 0 }));
}

export async function getActiveCategories(): Promise<Category[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("categories")
    .select("*")
    .eq("is_active", true)
    .order("display_order");

  return data ?? [];
}
