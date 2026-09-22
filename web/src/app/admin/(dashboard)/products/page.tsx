import type { Metadata } from "next";
import Link from "next/link";
import { getAdminProducts } from "@/lib/data/admin-products";
import { getActiveCategories } from "@/lib/data/products";
import { ToggleFeaturedButton } from "./toggle-featured-button";
import { DeleteProductButton } from "./delete-product-button";

export const metadata: Metadata = { title: "Products" };

// Ported from Areas/Admin/Controllers/ProductsController.cs#Index + Views/Products/Index.cshtml.
export default async function AdminProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; categoryId?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const search = sp.search;
  const categoryId = sp.categoryId ? Number(sp.categoryId) : undefined;
  const page = sp.page ? Number(sp.page) : 1;

  const [result, categories] = await Promise.all([getAdminProducts({ search, categoryId, page }), getActiveCategories()]);
  const totalPages = Math.max(1, Math.ceil(result.totalCount / result.pageSize));

  function pageHref(p: number) {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (categoryId) params.set("categoryId", String(categoryId));
    params.set("page", String(p));
    return `/admin/products?${params.toString()}`;
  }

  return (
    <>
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-4">
        <div>
          <h1 className="mb-1">Products</h1>
          <p className="text-muted-wood mb-0">
            {result.totalCount} product{result.totalCount === 1 ? "" : "s"}
          </p>
        </div>
        <Link href="/admin/products/new" className="btn btn-wood">
          + New Product
        </Link>
      </div>

      <div className="panel mb-3">
        <div className="panel-body py-3">
          <form method="get" className="row g-2 align-items-end">
            <div className="col-md-5">
              <label className="form-label mb-1">Search</label>
              <input type="search" name="search" defaultValue={search} className="form-control" placeholder="Search by name or wood type..." />
            </div>
            <div className="col-md-4">
              <label className="form-label mb-1">Category</label>
              <select name="categoryId" className="form-select" defaultValue={categoryId ?? ""}>
                <option value="">All categories</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-md-3 d-flex gap-2">
              <button type="submit" className="btn btn-wood flex-grow-1">
                Filter
              </button>
              {(search || categoryId) && (
                <Link href="/admin/products" className="btn btn-outline-secondary">
                  Reset
                </Link>
              )}
            </div>
          </form>
        </div>
      </div>

      <div className="panel">
        {result.items.length === 0 ? (
          <div className="empty-state">
            <div style={{ fontSize: "3rem" }}>🪑</div>
            <h3>No products found</h3>
            <p>Add a new product, or change the filters.</p>
            <Link href="/admin/products/new" className="btn btn-wood mt-2">
              + New Product
            </Link>
          </div>
        ) : (
          <>
            <div className="table-wrap">
              <table className="table table-wood mb-0">
                <thead>
                  <tr>
                    <th style={{ width: 60 }}></th>
                    <th>Product</th>
                    <th>Category</th>
                    <th className="text-end">Price</th>
                    <th className="text-center">Stock</th>
                    <th className="text-center">Status</th>
                    <th className="text-end">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {result.items.map((p) => (
                    <tr key={p.id}>
                      <td>
                        <img
                          src={p.image_url || "/img/cat-custom.svg"}
                          alt=""
                          style={{ width: 52, height: 42, objectFit: "cover", borderRadius: 6, border: "1px solid var(--line)" }}
                        />
                      </td>
                      <td>
                        <div className="fw-bold" style={{ fontSize: ".92rem" }}>
                          {p.name}
                        </div>
                        {p.wood_type && <div className="small text-muted-wood">{p.wood_type}</div>}
                      </td>
                      <td className="small">{p.category?.name}</td>
                      <td className="text-end">
                        {p.is_custom_order ? (
                          <span className="small text-muted-wood">On request</span>
                        ) : (
                          <>
                            <span className="fw-bold">₹{Math.round(p.price).toLocaleString("en-IN")}</span>
                            {p.old_price != null && p.old_price > 0 && (
                              <div className="small text-muted-wood text-decoration-line-through">₹{Math.round(p.old_price).toLocaleString("en-IN")}</div>
                            )}
                          </>
                        )}
                      </td>
                      <td className="text-center">
                        {p.is_custom_order ? (
                          <span className="small text-muted-wood">—</span>
                        ) : (
                          <span className={`badge ${p.stock_quantity <= 0 ? "bg-danger" : p.stock_quantity <= 3 ? "bg-warning text-dark" : "bg-success"}`}>
                            {p.stock_quantity}
                          </span>
                        )}
                      </td>
                      <td className="text-center">
                        <div className="d-flex flex-column gap-1 align-items-center">
                          {p.is_available ? <span className="badge bg-success">Live</span> : <span className="badge bg-secondary">Hidden</span>}
                          {p.is_featured && <span className="badge badge-wood">Featured</span>}
                          {p.is_custom_order && <span className="badge badge-custom">Custom</span>}
                        </div>
                      </td>
                      <td className="text-end" style={{ minWidth: 180 }}>
                        <div className="d-flex gap-1 justify-content-end flex-wrap">
                          <Link href={`/shop/${p.id}`} target="_blank" className="btn btn-sm btn-outline-wood" title="View on site">
                            👁
                          </Link>
                          <ToggleFeaturedButton productId={p.id} isFeatured={p.is_featured} />
                          <Link href={`/admin/products/${p.id}/edit`} className="btn btn-sm btn-outline-wood">
                            Edit
                          </Link>
                          <DeleteProductButton productId={p.id} productName={p.name} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="panel-body">
                <nav>
                  <ul className="pagination justify-content-center mb-0">
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((i) => (
                      <li key={i} className={`page-item ${i === page ? "active" : ""}`}>
                        <Link className="page-link" href={pageHref(i)}>
                          {i}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </nav>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
