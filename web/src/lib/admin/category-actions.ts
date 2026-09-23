"use server";

import { revalidatePath } from "next/cache";
import {
  createAdminCategory,
  updateAdminCategory,
  deleteAdminCategory,
  getAdminCategoryById,
  type CategoryFormData,
} from "@/lib/data/admin-categories";
import { saveImage, deleteImage, ImageValidationError, isSeedImage } from "@/lib/admin/image-service";
import { categorySchema } from "@/lib/validation/schemas";
import type { ActionResult } from "@/lib/auth/types";

// Ported from Areas/Admin/Controllers/CategoriesController.cs.

function validateCategoryForm(form: CategoryFormData): Record<string, string[]> | null {
  // Server-side re-check of CategoryFormViewModel's DataAnnotations — the client-side check in
  // category-form.tsx is only a UX nicety, not a security boundary, so a direct call here still
  // needs this.
  const parsed = categorySchema.safeParse(form);
  return parsed.success ? null : (parsed.error.flatten().fieldErrors as Record<string, string[]>);
}

export async function createCategoryAction(form: CategoryFormData, image: File | null): Promise<ActionResult> {
  const fieldErrors = validateCategoryForm(form);
  if (fieldErrors) {
    return { success: false, message: "Please fix the errors below.", fieldErrors };
  }

  let imageUrl: string | null = null;
  try {
    imageUrl = await saveImage(image, "categories");
  } catch (err) {
    if (err instanceof ImageValidationError) {
      return { success: false, message: err.message, fieldErrors: { image: [err.message] } };
    }
    throw err;
  }

  const id = await createAdminCategory(form, imageUrl);
  void id;

  revalidatePath("/admin/categories");
  revalidatePath("/");
  return { success: true, message: `Category "${form.name}" has been added.` };
}

export async function updateCategoryAction(id: number, form: CategoryFormData, image: File | null): Promise<ActionResult> {
  const fieldErrors = validateCategoryForm(form);
  if (fieldErrors) {
    return { success: false, message: "Please fix the errors below.", fieldErrors };
  }

  const existing = await getAdminCategoryById(id);
  if (!existing) return { success: false, message: "Category not found." };

  let newImageUrl: string | null = null;
  if (image && image.size > 0) {
    try {
      newImageUrl = await saveImage(image, "categories");
    } catch (err) {
      if (err instanceof ImageValidationError) {
        return { success: false, message: err.message, fieldErrors: { image: [err.message] } };
      }
      throw err;
    }
    if (newImageUrl && existing.image_url && !isSeedImage(existing.image_url)) {
      await deleteImage(existing.image_url, "categories");
    }
  }

  await updateAdminCategory(id, form, newImageUrl);

  revalidatePath("/admin/categories");
  revalidatePath("/");
  return { success: true, message: `Category "${form.name}" has been updated.` };
}

export async function deleteCategoryAction(id: number): Promise<ActionResult> {
  const category = await getAdminCategoryById(id);
  const result = await deleteAdminCategory(id);

  if (result.success && category?.image_url && !isSeedImage(category.image_url)) {
    await deleteImage(category.image_url, "categories");
  }

  revalidatePath("/admin/categories");
  revalidatePath("/");
  return result;
}
