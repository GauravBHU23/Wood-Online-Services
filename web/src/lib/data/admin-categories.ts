import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/types/database";
import type { Category } from "@/lib/data/products";

// Ported from Areas/Admin/Controllers/CategoriesController.cs.

export type AdminCategory = Category & { productCount: number };

export async function getAdminCategories(): Promise<AdminCategory[]> {
  const admin = createAdminClient();
  const [categoriesResult, countsResult] = await Promise.all([
    admin.from("categories").select("*").order("display_order"),
    admin.from("products").select("category_id"),
  ]);

  const categories: Category[] = categoriesResult.data ?? [];
  const countRows: { category_id: number }[] = countsResult.data ?? [];
  const counts = new Map<number, number>();
  for (const row of countRows) counts.set(row.category_id, (counts.get(row.category_id) ?? 0) + 1);

  return categories.map((c) => ({ ...c, productCount: counts.get(c.id) ?? 0 }));
}

export async function getAdminCategoryById(id: number): Promise<AdminCategory | null> {
  const admin = createAdminClient();
  const [categoryResult, countResult] = await Promise.all([
    admin.from("categories").select("*").eq("id", id).maybeSingle(),
    admin.from("products").select("id", { count: "exact", head: true }).eq("category_id", id),
  ]);

  if (!categoryResult.data) return null;
  return { ...(categoryResult.data as Category), productCount: countResult.count ?? 0 };
}

export interface CategoryFormData {
  name: string;
  description?: string;
  displayOrder: number;
  isActive: boolean;
}

export async function getNextDisplayOrder(): Promise<number> {
  const admin = createAdminClient();
  const result = await admin.from("categories").select("display_order").order("display_order", { ascending: false }).limit(1);
  return ((result.data?.[0]?.display_order as number | undefined) ?? 0) + 1;
}

export async function createAdminCategory(form: CategoryFormData, imageUrl: string | null): Promise<number> {
  const admin = createAdminClient();
  const insert: Database["public"]["Tables"]["categories"]["Insert"] = {
    name: form.name.trim(),
    description: form.description?.trim() || null,
    display_order: form.displayOrder,
    is_active: form.isActive,
    image_url: imageUrl,
  };
  const result = await admin.from("categories").insert(insert).select("id").single();
  return (result.data as { id: number }).id;
}

export async function updateAdminCategory(id: number, form: CategoryFormData, newImageUrl: string | null | undefined): Promise<void> {
  const admin = createAdminClient();
  const patch: Database["public"]["Tables"]["categories"]["Update"] = {
    name: form.name.trim(),
    description: form.description?.trim() || null,
    display_order: form.displayOrder,
    is_active: form.isActive,
  };
  if (newImageUrl) patch.image_url = newImageUrl;
  await admin.from("categories").update(patch).eq("id", id);
}

export async function deleteAdminCategory(id: number): Promise<{ success: boolean; message: string }> {
  const admin = createAdminClient();
  const category = await getAdminCategoryById(id);
  if (!category) return { success: false, message: "Category not found." };

  // Products point at a category, so an occupied one can only be deactivated.
  if (category.productCount > 0) {
    return {
      success: false,
      message: `"${category.name}" has ${category.productCount} products. Move them to another category, or set this category inactive.`,
    };
  }

  await admin.from("categories").delete().eq("id", id);
  return { success: true, message: `Category "${category.name}" has been deleted.` };
}
