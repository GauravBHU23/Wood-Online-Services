import type { Metadata } from "next";
import { getActiveCategories } from "@/lib/data/products";
import { ProductForm } from "../product-form";

export const metadata: Metadata = { title: "New Product" };

export default async function NewProductPage() {
  const categories = await getActiveCategories();

  return (
    <ProductForm
      categories={categories}
      imageUrl={null}
      existingImages={[]}
      initial={{
        name: "",
        categoryId: 0,
        woodType: "",
        description: "",
        price: 0,
        oldPrice: null,
        dimensions: "",
        stockQuantity: 0,
        isAvailable: true,
        isFeatured: false,
        isCustomOrder: false,
      }}
    />
  );
}
