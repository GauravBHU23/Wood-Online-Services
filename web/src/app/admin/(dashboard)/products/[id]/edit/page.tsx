import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getAdminProductById } from "@/lib/data/admin-products";
import { getActiveCategories } from "@/lib/data/products";
import { ProductForm } from "../../product-form";

interface PageParams {
  id: string;
}

export async function generateMetadata({ params }: { params: Promise<PageParams> }): Promise<Metadata> {
  const { id } = await params;
  const product = await getAdminProductById(Number(id));
  return { title: product ? `Edit — ${product.name}` : "Edit Product" };
}

export default async function EditProductPage({ params }: { params: Promise<PageParams> }) {
  const { id } = await params;
  const productId = Number(id);
  if (!Number.isInteger(productId) || productId <= 0) notFound();

  const [product, categories] = await Promise.all([getAdminProductById(productId), getActiveCategories()]);
  if (!product) notFound();

  return (
    <ProductForm
      productId={product.id}
      categories={categories}
      imageUrl={product.image_url}
      existingImages={product.images}
      initial={{
        name: product.name,
        categoryId: product.category_id,
        woodType: product.wood_type ?? "",
        description: product.description ?? "",
        price: product.price,
        oldPrice: product.old_price,
        dimensions: product.dimensions ?? "",
        stockQuantity: product.stock_quantity,
        isAvailable: product.is_available,
        isFeatured: product.is_featured,
        isCustomOrder: product.is_custom_order,
      }}
    />
  );
}
