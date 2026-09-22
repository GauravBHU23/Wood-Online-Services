import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/types/database";
import type { Category, Product, ProductImage } from "@/lib/data/products";

// Ported from Areas/Admin/Controllers/ProductsController.cs.

export interface AdminProductListResult {
  items: (Product & { category: Category | null })[];
  totalCount: number;
  page: number;
  pageSize: number;
}

const PAGE_SIZE = 20;

export async function getAdminProducts(filters: { search?: string; categoryId?: number; page?: number }): Promise<AdminProductListResult> {
  const admin = createAdminClient();
  const page = Math.max(1, filters.page ?? 1);

  let query = admin.from("products").select("*, category:categories(*)", { count: "exact" });

  if (filters.search?.trim()) {
    const term = filters.search.trim().replace(/[%_]/g, "\\$&");
    query = query.or(`name.ilike.%${term}%,wood_type.ilike.%${term}%`);
  }
  if (filters.categoryId && filters.categoryId > 0) {
    query = query.eq("category_id", filters.categoryId);
  }

  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;
  query = query.order("id", { ascending: false }).range(from, to);

  const result = await query;
  return {
    items: (result.data ?? []) as unknown as (Product & { category: Category | null })[],
    totalCount: result.count ?? 0,
    page,
    pageSize: PAGE_SIZE,
  };
}

export async function getAdminProductById(id: number): Promise<(Product & { images: ProductImage[] }) | null> {
  const admin = createAdminClient();
  const result = await admin.from("products").select("*, images:product_images(*)").eq("id", id).maybeSingle();
  if (!result.data) return null;
  const data = result.data as Product & { images: ProductImage[] };
  return { ...data, images: (data.images ?? []).sort((a, b) => a.display_order - b.display_order) };
}

export interface ProductFormData {
  name: string;
  categoryId: number;
  woodType?: string;
  description?: string;
  price: number;
  oldPrice?: number | null;
  dimensions?: string;
  stockQuantity: number;
  isAvailable: boolean;
  isFeatured: boolean;
  isCustomOrder: boolean;
}

function applyForm(form: ProductFormData): Database["public"]["Tables"]["products"]["Update"] {
  const base: Database["public"]["Tables"]["products"]["Update"] = {
    name: form.name.trim(),
    category_id: form.categoryId,
    wood_type: form.woodType?.trim() || null,
    description: form.description?.trim() || null,
    dimensions: form.dimensions?.trim() || null,
    is_available: form.isAvailable,
    is_featured: form.isFeatured,
    is_custom_order: form.isCustomOrder,
  };

  // Custom-order items are quoted individually, so any price or stock typed in is meaningless.
  if (form.isCustomOrder) {
    base.price = 0;
    base.old_price = null;
    base.stock_quantity = 0;
  } else {
    base.price = form.price;
    base.old_price = form.oldPrice && form.oldPrice > 0 ? form.oldPrice : null;
    base.stock_quantity = form.stockQuantity;
  }

  return base;
}

export async function createAdminProduct(form: ProductFormData, imageUrl: string | null): Promise<number> {
  const admin = createAdminClient();
  const patch = applyForm(form);
  const insert: Database["public"]["Tables"]["products"]["Insert"] = {
    name: form.name.trim(),
    category_id: form.categoryId,
    ...patch,
    image_url: imageUrl,
  };
  const result = await admin.from("products").insert(insert).select("id").single();
  return (result.data as { id: number }).id;
}

export async function updateAdminProduct(id: number, form: ProductFormData, newImageUrl: string | null | undefined): Promise<void> {
  const admin = createAdminClient();
  const patch = applyForm(form);
  if (newImageUrl !== undefined && newImageUrl !== null) {
    patch.image_url = newImageUrl;
  }
  await admin.from("products").update(patch).eq("id", id);
}

export async function addProductGalleryImages(productId: number, paths: string[]): Promise<void> {
  if (paths.length === 0) return;
  const admin = createAdminClient();

  const maxResult = await admin.from("product_images").select("display_order").eq("product_id", productId).order("display_order", { ascending: false }).limit(1);
  let nextOrder = (maxResult.data?.[0]?.display_order ?? 0) as number;

  const inserts: Database["public"]["Tables"]["product_images"]["Insert"][] = paths.map((path) => ({
    product_id: productId,
    image_path: path,
    display_order: ++nextOrder,
  }));

  await admin.from("product_images").insert(inserts);
}

export async function deleteProductImage(imageId: number): Promise<number | null> {
  const admin = createAdminClient();
  const result = await admin.from("product_images").select("product_id, image_path").eq("id", imageId).maybeSingle();
  const row = result.data as { product_id: number; image_path: string } | null;
  if (!row) return null;

  await admin.from("product_images").delete().eq("id", imageId);
  return row.product_id;
}

export async function toggleProductFeatured(id: number): Promise<{ name: string; isFeatured: boolean } | null> {
  const admin = createAdminClient();
  const result = await admin.from("products").select("name, is_featured").eq("id", id).maybeSingle();
  const product = result.data as { name: string; is_featured: boolean } | null;
  if (!product) return null;

  const patch: Database["public"]["Tables"]["products"]["Update"] = { is_featured: !product.is_featured };
  await admin.from("products").update(patch).eq("id", id);

  return { name: product.name, isFeatured: !product.is_featured };
}

/** Order history references products, so a sold product is hidden rather than removed. */
export async function deleteAdminProduct(id: number): Promise<{ name: string; hidden: boolean }> {
  const admin = createAdminClient();
  const productResult = await admin.from("products").select("name, image_url").eq("id", id).maybeSingle();
  const product = productResult.data as { name: string; image_url: string | null } | null;
  if (!product) throw new Error("Product not found.");

  const orderedResult = await admin.from("order_items").select("id", { count: "exact", head: true }).eq("product_id", id);
  const isOrdered = (orderedResult.count ?? 0) > 0;

  if (isOrdered) {
    const patch: Database["public"]["Tables"]["products"]["Update"] = { is_available: false };
    await admin.from("products").update(patch).eq("id", id);
    return { name: product.name, hidden: true };
  }

  await admin.from("cart_items").delete().eq("product_id", id);
  await admin.from("products").delete().eq("id", id);
  return { name: product.name, hidden: false };
}
