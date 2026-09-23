"use server";

import { revalidatePath } from "next/cache";
import {
  createAdminProduct,
  updateAdminProduct,
  addProductGalleryImages,
  deleteProductImage,
  toggleProductFeatured,
  deleteAdminProduct,
  getAdminProductById,
  type ProductFormData,
} from "@/lib/data/admin-products";
import { saveImage, deleteImage, ImageValidationError, isSeedImage } from "@/lib/admin/image-service";
import { productSchema } from "@/lib/validation/schemas";
import type { ActionResult } from "@/lib/auth/types";

// Ported from Areas/Admin/Controllers/ProductsController.cs.

function validateProductForm(form: ProductFormData): Record<string, string[]> | null {
  // Server-side re-check of the same rules the form validates client-side (ProductFormViewModel's
  // DataAnnotations) — the client check alone isn't a security boundary, it's just a UX nicety
  // that a direct call here would skip entirely.
  const parsed = productSchema.safeParse(
    form.isCustomOrder ? { ...form, price: 0, oldPrice: null, stockQuantity: 0 } : form
  );
  return parsed.success ? null : (parsed.error.flatten().fieldErrors as Record<string, string[]>);
}

export async function createProductAction(
  form: ProductFormData,
  mainImage: File | null,
  galleryImages: File[]
): Promise<ActionResult & { productId?: number }> {
  const fieldErrors = validateProductForm(form);
  if (fieldErrors) {
    return { success: false, message: "Please fix the errors below.", fieldErrors };
  }

  let imageUrl: string | null = null;
  try {
    imageUrl = await saveImage(mainImage, "products");
  } catch (err) {
    if (err instanceof ImageValidationError) {
      return { success: false, message: err.message, fieldErrors: { mainImage: [err.message] } };
    }
    throw err;
  }

  const productId = await createAdminProduct(form, imageUrl);

  const galleryPaths: string[] = [];
  for (const file of galleryImages) {
    if (file.size === 0) continue;
    try {
      const path = await saveImage(file, "products");
      if (path) galleryPaths.push(path);
    } catch {
      // One bad file shouldn't discard the rest of the upload.
    }
  }
  await addProductGalleryImages(productId, galleryPaths);

  revalidatePath("/admin/products");
  revalidatePath("/shop");
  return { success: true, message: `"${form.name}" has been added.`, productId };
}

export async function updateProductAction(
  id: number,
  form: ProductFormData,
  mainImage: File | null,
  galleryImages: File[]
): Promise<ActionResult> {
  const fieldErrors = validateProductForm(form);
  if (fieldErrors) {
    return { success: false, message: "Please fix the errors below.", fieldErrors };
  }

  const existing = await getAdminProductById(id);
  if (!existing) return { success: false, message: "Product not found." };

  let newImageUrl: string | null | undefined;
  if (mainImage && mainImage.size > 0) {
    try {
      newImageUrl = await saveImage(mainImage, "products");
    } catch (err) {
      if (err instanceof ImageValidationError) {
        return { success: false, message: err.message, fieldErrors: { mainImage: [err.message] } };
      }
      throw err;
    }
    if (newImageUrl && existing.image_url && !isSeedImage(existing.image_url)) {
      await deleteImage(existing.image_url, "products");
    }
  }

  await updateAdminProduct(id, form, newImageUrl);

  const galleryPaths: string[] = [];
  for (const file of galleryImages) {
    if (file.size === 0) continue;
    try {
      const path = await saveImage(file, "products");
      if (path) galleryPaths.push(path);
    } catch {
      // One bad file shouldn't discard the rest of the upload.
    }
  }
  await addProductGalleryImages(id, galleryPaths);

  revalidatePath("/admin/products");
  revalidatePath(`/admin/products/${id}/edit`);
  revalidatePath("/shop");
  revalidatePath(`/shop/${id}`);
  return { success: true, message: `"${form.name}" has been updated.` };
}

export async function deleteProductImageAction(imageId: number): Promise<ActionResult & { productId?: number }> {
  const admin = await import("@/lib/supabase/admin").then((m) => m.createAdminClient());
  const result = await admin.from("product_images").select("product_id, image_path").eq("id", imageId).maybeSingle();
  const row = result.data as { product_id: number; image_path: string } | null;
  if (!row) return { success: false, message: "Image not found." };

  if (!isSeedImage(row.image_path)) await deleteImage(row.image_path, "products");
  const productId = await deleteProductImage(imageId);

  revalidatePath(`/admin/products/${productId}/edit`);
  return { success: true, message: "Image removed.", productId: productId ?? undefined };
}

export async function toggleProductFeaturedAction(id: number): Promise<ActionResult> {
  const result = await toggleProductFeatured(id);
  if (!result) return { success: false, message: "Product not found." };

  revalidatePath("/admin/products");
  revalidatePath("/");
  return {
    success: true,
    message: result.isFeatured ? `"${result.name}" will now appear on the homepage.` : `"${result.name}" has been removed from the homepage.`,
  };
}

export async function deleteProductAction(id: number): Promise<ActionResult> {
  const existing = await getAdminProductById(id);
  if (!existing) return { success: false, message: "Product not found." };

  const result = await deleteAdminProduct(id);

  if (!result.hidden) {
    for (const img of existing.images) {
      if (!isSeedImage(img.image_path)) await deleteImage(img.image_path, "products");
    }
    if (existing.image_url && !isSeedImage(existing.image_url)) await deleteImage(existing.image_url, "products");
  }

  revalidatePath("/admin/products");
  revalidatePath("/shop");

  return {
    success: true,
    message: result.hidden
      ? `"${result.name}" has existing orders, so it has been hidden instead of deleted.`
      : `"${result.name}" has been deleted.`,
  };
}
