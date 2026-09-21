import Link from "next/link";
import type { Metadata } from "next";
import { getShopProducts, type ShopSort, PAGE_SIZE } from "@/lib/data/products";
import { ProductCard } from "@/components/shop/product-card";

interface ShopSearchParams {
  categoryId?: string;
  search?: string;
  woodType?: string;
  minPrice?: string;
  maxPrice?: string;
  minRating?: string;
  sort?: string;
  page?: string;
}

// Ported from Controllers/ShopController.cs#Index + Views/Shop/Index.cshtml. Filtering is a
// plain GET form (method="get") exactly like the original — no client JS required for the core
// flow, so it works with JS disabled and is trivially shareable/bookmarkable as a URL.
export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<ShopSearchParams>;
}): Promise<Metadata> {
  const sp = await searchParams;
  const categoryId = sp.categoryId ? Number(sp.categoryId) : undefined;
  if (!categoryId) return { title: "Products" };
  const { getActiveCategories } = await import("@/lib/data/products");
  const categories = await getActiveCategories();
  const name = categories.find((c) => c.id === categoryId)?.name;
  return { title: name ?? "Products" };
}

export default async function ShopPage({ searchParams }: { searchParams: Promise<ShopSearchParams> }) {
  const sp = await searchParams;

  const filters = {
    categoryId: sp.categoryId ? Number(sp.categoryId) : undefined,
    search: sp.search,
    woodType: sp.woodType,
    minPrice: sp.minPrice ? Number(sp.minPrice) : undefined,
    maxPrice: sp.maxPrice ? Number(sp.maxPrice) : undefined,
    minRating: sp.minRating ? Number(sp.minRating) : undefined,
    sort: (sp.sort as ShopSort) || "newest",
    page: sp.page ? Number(sp.page) : 1,
  };

  const result = await getShopProducts(filters);
  const totalPages = Math.max(1, Math.ceil(result.totalCount / PAGE_SIZE));

  const hasActiveFilters =
    !!filters.categoryId || !!filters.search || !!filters.woodType || filters.minPrice !== undefined || filters.maxPrice !== undefined;

  // Builds a query string carrying every filter except the ones explicitly overridden — used
  // for pagination and sort links so they preserve the rest of the current filter state.
  function buildQuery(overrides: Record<string, string | number | undefined>) {
    const params = new URLSearchParams();
    const merged = {
      categoryId: filters.categoryId,
      search: filters.search,
      woodType: filters.woodType,
      minPrice: filters.minPrice,
      maxPrice: filters.maxPrice,
      sort: filters.sort,
      page: filters.page,
      ...overrides,
    };
    for (const [key, value] of Object.entries(merged)) {
      if (value !== undefined && value !== "" && value !== null) params.set(key, String(value));
    }
    return `/shop?${params.toString()}`;
  }

  const from = result.totalCount > 0 ? (result.page - 1) * PAGE_SIZE + 1 : 0;
  const to = Math.min(result.page * PAGE_SIZE, result.totalCount);

  const pageNumbers: (number | "ellipsis")[] = [];
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || Math.abs(i - result.page) <= 2) {
      pageNumbers.push(i);
    } else if (Math.abs(i - result.page) === 3) {
      pageNumbers.push("ellipsis");
    }
  }

  return (
    <>
      <div className="bg-wood-50 border-bottom border-wood py-4">
        <div className="container">
          <nav aria-label="breadcrumb">
            <ol className="breadcrumb mb-2 small">
              <li className="breadcrumb-item">
                <Link href="/">Home</Link>
              </li>
              <li className="breadcrumb-item">
                <Link href="/shop">Products</Link>
              </li>
              {result.categoryName && (
                <li className="breadcrumb-item active" aria-current="page">
                  {result.categoryName}
                </li>
              )}
            </ol>
          </nav>
          <h1 className="mb-1">{result.categoryName ?? "All Products"}</h1>
          <p className="text-muted-wood mb-0">
            {result.totalCount} item{result.totalCount === 1 ? "" : "s"} found
          </p>
        </div>
      </div>

      <div className="container py-4">
        <div className="row g-4">
          <aside className="col-lg-3">
            <form method="get" action="/shop" id="filterForm">
              <div className="panel mb-3">
                <div className="panel-header">Search</div>
                <div className="panel-body">
                  <div className="input-group">
                    <input type="search" name="search" defaultValue={filters.search} className="form-control" placeholder="Search products..." />
                    <button className="btn btn-wood" type="submit">
                      🔍
                    </button>
                  </div>
                </div>
              </div>

              <div className="panel mb-3">
                <div className="panel-header">Category</div>
                <div className="panel-body">
                  <div className="d-grid gap-1">
                    <Link href={buildQuery({ categoryId: undefined, page: undefined })} className={`btn btn-sm text-start ${!filters.categoryId ? "btn-wood" : "btn-outline-wood"}`}>
                      All
                    </Link>
                    {result.categories.map((c) => (
                      <Link
                        key={c.id}
                        href={buildQuery({ categoryId: c.id, page: undefined })}
                        className={`btn btn-sm text-start ${filters.categoryId === c.id ? "btn-wood" : "btn-outline-wood"}`}
                      >
                        {c.name}
                      </Link>
                    ))}
                  </div>
                </div>
              </div>

              {result.woodTypes.length > 0 && (
                <div className="panel mb-3">
                  <div className="panel-header">Wood Type</div>
                  <div className="panel-body">
                    <select name="woodType" className="form-select" defaultValue={filters.woodType ?? ""}>
                      <option value="">Any wood type</option>
                      {result.woodTypes.map((w) => (
                        <option key={w} value={w}>
                          {w}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              <div className="panel mb-3">
                <div className="panel-header">Price (₹)</div>
                <div className="panel-body">
                  <div className="row g-2">
                    <div className="col-6">
                      <input type="number" name="minPrice" defaultValue={filters.minPrice} className="form-control" placeholder="Min" min={0} />
                    </div>
                    <div className="col-6">
                      <input type="number" name="maxPrice" defaultValue={filters.maxPrice} className="form-control" placeholder="Max" min={0} />
                    </div>
                  </div>
                  <button type="submit" className="btn btn-wood btn-sm w-100 mt-2">
                    Apply Filter
                  </button>
                </div>
              </div>

              {hasActiveFilters && (
                <Link href="/shop" className="btn btn-outline-secondary btn-sm w-100">
                  Clear Filters
                </Link>
              )}

              <input type="hidden" name="categoryId" value={filters.categoryId ?? ""} />
              <input type="hidden" name="sort" value={filters.sort} />
            </form>
          </aside>

          <div className="col-lg-9">
            <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
              <span className="small text-muted-wood">
                {result.totalCount > 0 && (
                  <>
                    Showing {from}&ndash;{to} of {result.totalCount}
                  </>
                )}
              </span>

              <form method="get" action="/shop" className="d-flex align-items-center gap-2">
                <input type="hidden" name="categoryId" value={filters.categoryId ?? ""} />
                <input type="hidden" name="search" value={filters.search ?? ""} />
                <input type="hidden" name="woodType" value={filters.woodType ?? ""} />
                <input type="hidden" name="minPrice" value={filters.minPrice ?? ""} />
                <input type="hidden" name="maxPrice" value={filters.maxPrice ?? ""} />
                <label className="form-label mb-0 small">Sort:</label>
                <select name="sort" className="form-select form-select-sm" style={{ width: "auto" }} defaultValue={filters.sort}>
                  <option value="newest">Newest first</option>
                  <option value="price-low">Price: low to high</option>
                  <option value="price-high">Price: high to low</option>
                  <option value="name">Name (A-Z)</option>
                  <option value="rating">Rating</option>
                  <option value="popular">Most popular</option>
                </select>
              </form>
            </div>

            {result.products.length === 0 ? (
              <div className="panel">
                <div className="empty-state">
                  <div style={{ fontSize: "3rem" }}>🔍</div>
                  <h3>No products found</h3>
                  <p>Try changing the filters, or simply ask us directly.</p>
                  <div className="d-flex flex-wrap justify-content-center gap-2 mt-3">
                    <Link href="/shop" className="btn btn-outline-wood">
                      View all products
                    </Link>
                    <Link href="/contact" className="btn btn-wood">
                      Send Inquiry
                    </Link>
                  </div>
                </div>
              </div>
            ) : (
              <>
                <div className="row g-3 g-md-4">
                  {result.products.map((p) => (
                    <div key={p.id} className="col-6 col-lg-4">
                      <ProductCard product={p} />
                    </div>
                  ))}
                </div>

                {totalPages > 1 && (
                  <nav className="mt-4" aria-label="Pages">
                    <ul className="pagination justify-content-center">
                      <li className={`page-item ${result.page <= 1 ? "disabled" : ""}`}>
                        <Link className="page-link" href={buildQuery({ page: result.page - 1 })}>
                          ←
                        </Link>
                      </li>

                      {pageNumbers.map((p, i) =>
                        p === "ellipsis" ? (
                          <li key={`e${i}`} className="page-item disabled">
                            <span className="page-link">…</span>
                          </li>
                        ) : (
                          <li key={p} className={`page-item ${p === result.page ? "active" : ""}`}>
                            <Link className="page-link" href={buildQuery({ page: p })}>
                              {p}
                            </Link>
                          </li>
                        )
                      )}

                      <li className={`page-item ${result.page >= totalPages ? "disabled" : ""}`}>
                        <Link className="page-link" href={buildQuery({ page: result.page + 1 })}>
                          →
                        </Link>
                      </li>
                    </ul>
                  </nav>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
