import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getAdminCategoryById } from "@/lib/data/admin-categories";
import { CategoryForm } from "../../category-form";

interface PageParams {
  id: string;
}

export async function generateMetadata({ params }: { params: Promise<PageParams> }): Promise<Metadata> {
  const { id } = await params;
  const category = await getAdminCategoryById(Number(id));
  return { title: category ? `Edit — ${category.name}` : "Edit Category" };
}

export default async function EditCategoryPage({ params }: { params: Promise<PageParams> }) {
  const { id } = await params;
  const categoryId = Number(id);
  if (!Number.isInteger(categoryId) || categoryId <= 0) notFound();

  const category = await getAdminCategoryById(categoryId);
  if (!category) notFound();

  return (
    <CategoryForm
      categoryId={category.id}
      imageUrl={category.image_url}
      productCount={category.productCount}
      initial={{
        name: category.name,
        description: category.description ?? "",
        displayOrder: category.display_order,
        isActive: category.is_active,
      }}
    />
  );
}
