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
import type { ActionResult } from "@/lib/auth/types";

// Ported from Areas/Admin/Controllers/CategoriesController.cs.

export async function createCategoryAction(form: CategoryFormData, image: File | null): Promise<ActionResult> {
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
