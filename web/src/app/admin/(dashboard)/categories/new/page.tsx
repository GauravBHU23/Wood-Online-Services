import type { Metadata } from "next";
import { getNextDisplayOrder } from "@/lib/data/admin-categories";
import { CategoryForm } from "../category-form";

export const metadata: Metadata = { title: "New Category" };

export default async function NewCategoryPage() {
  const nextOrder = await getNextDisplayOrder();

  return (
    <CategoryForm
      imageUrl={null}
      productCount={0}
      initial={{ name: "", description: "", displayOrder: nextOrder, isActive: true }}
    />
  );
}
