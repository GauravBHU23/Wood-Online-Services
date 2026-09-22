import type { Metadata } from "next";
import Link from "next/link";
import { getAdminCategories } from "@/lib/data/admin-categories";
import { DeleteCategoryButton } from "./delete-category-button";

export const metadata: Metadata = { title: "Categories" };

// Ported from Areas/Admin/Controllers/CategoriesController.cs#Index + Views/Categories/Index.cshtml.
export default async function AdminCategoriesPage() {
  const categories = await getAdminCategories();

  return (
    <>
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-4">
        <div>
          <h1 className="mb-1">Categories</h1>
          <p className="text-muted-wood mb-0">
            {categories.length} categor{categories.length === 1 ? "y" : "ies"}
          </p>
        </div>
        <Link href="/admin/categories/new" className="btn btn-wood">
          + New Category
        </Link>
      </div>

      <div className="panel">
        {categories.length === 0 ? (
          <div className="empty-state">
            <div style={{ fontSize: "3rem" }}>📁</div>
            <h3>No categories yet</h3>
            <p>Create a category first, then add products to it.</p>
            <Link href="/admin/categories/new" className="btn btn-wood mt-2">
              + New Category
            </Link>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="table table-wood mb-0">
              <thead>
                <tr>
                  <th style={{ width: 60 }}></th>
                  <th>Name</th>
                  <th>Description</th>
                  <th className="text-center">Products</th>
                  <th className="text-center">Order</th>
                  <th className="text-center">Status</th>
                  <th className="text-end">Actions</th>
                </tr>
              </thead>
              <tbody>
                {categories.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <img src={c.image_url || "/img/cat-custom.svg"} alt="" style={{ width: 44, height: 44, objectFit: "cover", borderRadius: 8 }} />
                    </td>
                    <td className="fw-bold">{c.name}</td>
                    <td className="small text-muted-wood" style={{ maxWidth: 320 }}>
                      {c.description}
                    </td>
                    <td className="text-center">
                      <Link href={`/admin/products?categoryId=${c.id}`} className="badge badge-soft text-decoration-none">
                        {c.productCount}
                      </Link>
                    </td>
                    <td className="text-center">{c.display_order}</td>
                    <td className="text-center">
                      {c.is_active ? <span className="badge bg-success">Active</span> : <span className="badge bg-secondary">Inactive</span>}
                    </td>
                    <td className="text-end">
                      <div className="d-flex gap-1 justify-content-end">
                        <Link href={`/admin/categories/${c.id}/edit`} className="btn btn-sm btn-outline-wood">
                          Edit
                        </Link>
                        <DeleteCategoryButton categoryId={c.id} categoryName={c.name} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
