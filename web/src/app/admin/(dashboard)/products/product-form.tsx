"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createProductAction, updateProductAction, deleteProductImageAction } from "@/lib/admin/product-actions";
import { useConfirm } from "@/components/ui/confirm-modal";
import { useToast } from "@/components/ui/toast-provider";
import { productSchema } from "@/lib/validation/schemas";
import type { ProductFormData } from "@/lib/data/admin-products";
import type { Category, ProductImage } from "@/lib/data/products";

const WOOD_TYPES = ["Sheesham", "Teak", "Mango Wood", "Pine", "Walnut Finish"];

// Ported from Areas/Admin/Views/Products/Form.cshtml — shared by Create and Edit.
export function ProductForm({
  productId,
  initial,
  categories,
  imageUrl,
  existingImages,
}: {
  productId?: number;
  initial: ProductFormData;
  categories: Category[];
  imageUrl: string | null;
  existingImages: ProductImage[];
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const toast = useToast();
  const isEdit = !!productId;

  const [form, setForm] = useState<ProductFormData>(initial);
  const [mainImage, setMainImage] = useState<File | null>(null);
  const [galleryImages, setGalleryImages] = useState<File[]>([]);
  const [images, setImages] = useState(existingImages);
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [deletingImageId, setDeletingImageId] = useState<number | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setErrors({});

    // Ported from ProductFormViewModel's DataAnnotations — see schemas.ts's productSchema for
    // the exact limits. Custom-order items skip the price/stock checks since applyForm() zeroes
    // those fields out server-side anyway for isCustomOrder (they're disabled inputs here too).
    const parsed = productSchema.safeParse(
      form.isCustomOrder ? { ...form, price: 0, oldPrice: null, stockQuantity: 0 } : form
    );
    if (!parsed.success) {
      setErrors(parsed.error.flatten().fieldErrors as Record<string, string[]>);
      return;
    }

    startTransition(async () => {
      const result = isEdit
        ? await updateProductAction(productId!, form, mainImage, galleryImages)
        : await createProductAction(form, mainImage, galleryImages);

      if (result.success) {
        toast.success(result.message ?? "Saved.");
        router.push("/admin/products");
        router.refresh();
      } else {
        setFormError(result.message ?? "Could not save the product.");
        if (result.fieldErrors) setErrors(result.fieldErrors);
      }
    });
  }

  async function handleDeleteImage(imageId: number) {
    const ok = await confirm({ title: "Remove image", message: "Remove this image?", tone: "danger" });
    if (!ok) return;

    setDeletingImageId(imageId);
    try {
      const result = await deleteProductImageAction(imageId);
      if (result.success) {
        setImages((prev) => prev.filter((i) => i.id !== imageId));
        toast.success(result.message ?? "Image removed.");
      } else {
        toast.error(result.message ?? "Could not remove image.");
      }
    } finally {
      setDeletingImageId(null);
    }
  }

  return (
    <>
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-4">
        <div>
          <h1 className="mb-1">{isEdit ? "Edit Product" : "New product"}</h1>
          <p className="text-muted-wood mb-0">{isEdit ? form.name : "Add a new item to the site"}</p>
        </div>
        <Link href="/admin/products" className="btn btn-outline-wood">
          ← All products
        </Link>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="row g-4">
          <div className="col-lg-8">
            <div className="panel mb-3">
              <div className="panel-header">Basic Information</div>
              <div className="panel-body">
                {formError && <div className="alert alert-danger py-2 small">{formError}</div>}

                <div className="row g-3">
                  <div className="col-12">
                    <label className="form-label">
                      Product Name <span className="text-danger">*</span>
                    </label>
                    <input
                      className="form-control"
                      placeholder="e.g. 6-Seater Dining Table"
                      value={form.name}
                      onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    />
                    {errors.name?.[0] && <span className="field-validation-error d-block">{errors.name[0]}</span>}
                  </div>

                  <div className="col-md-6">
                    <label className="form-label">
                      Category <span className="text-danger">*</span>
                    </label>
                    <select
                      className="form-select"
                      value={form.categoryId || ""}
                      onChange={(e) => setForm((f) => ({ ...f, categoryId: Number(e.target.value) }))}
                    >
                      <option value="">— Please choose a category —</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                    {errors.categoryId?.[0] && <span className="field-validation-error d-block">{errors.categoryId[0]}</span>}
                  </div>

                  <div className="col-md-6">
                    <label className="form-label">Wood Type</label>
                    <input
                      className="form-control"
                      list="woodTypes"
                      placeholder="e.g. Sheesham"
                      value={form.woodType ?? ""}
                      onChange={(e) => setForm((f) => ({ ...f, woodType: e.target.value }))}
                    />
                    <datalist id="woodTypes">
                      {WOOD_TYPES.map((w) => (
                        <option key={w} value={w} />
                      ))}
                    </datalist>
                  </div>

                  <div className="col-12">
                    <label className="form-label">Dimensions (L × W × H)</label>
                    <input
                      className="form-control"
                      placeholder='e.g. 72" x 36" x 30"'
                      value={form.dimensions ?? ""}
                      onChange={(e) => setForm((f) => ({ ...f, dimensions: e.target.value }))}
                    />
                  </div>

                  <div className="col-12">
                    <label className="form-label">Description</label>
                    <textarea
                      rows={7}
                      className="form-control"
                      placeholder="Wood quality, how it is made, what makes it special. Whatever you want the customer to know."
                      value={form.description ?? ""}
                      onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                    />
                    <span className="small text-muted-wood">This appears on the product page.</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="panel">
              <div className="panel-header">Price and Stock</div>
              <div className="panel-body">
                <div className="form-check mb-3 p-3 border rounded" style={{ background: "var(--wood-50)" }}>
                  <input
                    type="checkbox"
                    className="form-check-input"
                    id="isCustomOrder"
                    checked={form.isCustomOrder}
                    onChange={(e) => setForm((f) => ({ ...f, isCustomOrder: e.target.checked }))}
                  />
                  <label className="form-check-label fw-bold" htmlFor="isCustomOrder">
                    Custom Order Only (price on request)
                  </label>
                  <div className="small text-muted-wood">
                    Ticking this removes price and stock. The customer sees &quot;Price on request&quot; and sends an inquiry instead of adding to
                    cart. Use it for temples, custom doors and similar work.
                  </div>
                </div>

                <div className="row g-3" style={{ opacity: form.isCustomOrder ? 0.45 : 1 }}>
                  <div className="col-md-4">
                    <label className="form-label">Price (₹)</label>
                    <input
                      type="number"
                      step={1}
                      min={0}
                      className="form-control"
                      disabled={form.isCustomOrder}
                      value={form.price}
                      onChange={(e) => setForm((f) => ({ ...f, price: Number(e.target.value) }))}
                    />
                    {errors.price?.[0] && <span className="field-validation-error d-block">{errors.price[0]}</span>}
                  </div>

                  <div className="col-md-4">
                    <label className="form-label">MRP / Old Price (₹)</label>
                    <input
                      type="number"
                      step={1}
                      min={0}
                      className="form-control"
                      disabled={form.isCustomOrder}
                      value={form.oldPrice ?? ""}
                      onChange={(e) => setForm((f) => ({ ...f, oldPrice: e.target.value ? Number(e.target.value) : null }))}
                    />
                    <span className="small text-muted-wood">Used to show a discount. Leave it empty if there is no discount.</span>
                  </div>

                  <div className="col-md-4">
                    <label className="form-label">Stock Quantity</label>
                    <input
                      type="number"
                      step={1}
                      min={0}
                      className="form-control"
                      disabled={form.isCustomOrder}
                      value={form.stockQuantity}
                      onChange={(e) => setForm((f) => ({ ...f, stockQuantity: Number(e.target.value) }))}
                    />
                    {errors.stockQuantity?.[0] && <span className="field-validation-error d-block">{errors.stockQuantity[0]}</span>}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="col-lg-4">
            <div className="panel mb-3">
              <div className="panel-header">Visibility</div>
              <div className="panel-body">
                <div className="form-check mb-2">
                  <input
                    type="checkbox"
                    className="form-check-input"
                    id="isAvailable"
                    checked={form.isAvailable}
                    onChange={(e) => setForm((f) => ({ ...f, isAvailable: e.target.checked }))}
                  />
                  <label className="form-check-label" htmlFor="isAvailable">
                    Available (show on site)
                  </label>
                </div>
                <div className="form-check">
                  <input
                    type="checkbox"
                    className="form-check-input"
                    id="isFeatured"
                    checked={form.isFeatured}
                    onChange={(e) => setForm((f) => ({ ...f, isFeatured: e.target.checked }))}
                  />
                  <label className="form-check-label" htmlFor="isFeatured">
                    Show on homepage
                  </label>
                </div>
              </div>
            </div>

            <div className="panel mb-3">
              <div className="panel-header">Main image</div>
              <div className="panel-body">
                {imageUrl && <img src={imageUrl} alt="" className="img-fluid rounded mb-2" style={{ border: "1px solid var(--line)", maxHeight: 180 }} />}
                <input
                  type="file"
                  className="form-control"
                  accept="image/*"
                  onChange={(e) => setMainImage(e.target.files?.[0] ?? null)}
                />
                {errors.mainImage?.[0] && <span className="field-validation-error d-block">{errors.mainImage[0]}</span>}
                <div className="small text-muted-wood mt-1">JPG, PNG or WEBP, up to 5 MB. Photographs taken in good light look best.</div>
              </div>
            </div>

            <div className="panel mb-3">
              <div className="panel-header">More Images</div>
              <div className="panel-body">
                {images.length > 0 && (
                  <div className="d-flex flex-wrap gap-2 mb-3">
                    {images.map((img) => (
                      <div key={img.id} className="position-relative">
                        <img
                          src={img.image_path}
                          alt=""
                          style={{ width: 76, height: 64, objectFit: "cover", borderRadius: 6, border: "1px solid var(--line)" }}
                        />
                        <button
                          type="button"
                          className={`btn btn-sm btn-danger position-absolute top-0 end-0 p-0${deletingImageId === img.id ? " is-busy" : ""}`}
                          style={{ width: 20, height: 20, lineHeight: 1, fontSize: ".7rem" }}
                          disabled={deletingImageId === img.id}
                          onClick={() => handleDeleteImage(img.id)}
                        >
                          {deletingImageId === img.id ? <span className="wos-btn-spinner" aria-hidden="true" /> : "✕"}
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <input
                  type="file"
                  className="form-control"
                  accept="image/*"
                  multiple
                  onChange={(e) => setGalleryImages(Array.from(e.target.files ?? []))}
                />
                <div className="small text-muted-wood mt-1">You can select more than one.</div>
              </div>
            </div>

            <div className="panel">
              <div className="panel-body d-grid gap-2">
                <button type="submit" className={`btn btn-wood btn-lg${pending ? " is-busy" : ""}`} disabled={pending}>
                  {pending && <span className="wos-btn-spinner" aria-hidden="true" />}
                  {pending ? "Saving..." : isEdit ? "Save Changes" : "Add Product"}
                </button>
                <Link href="/admin/products" className="btn btn-outline-wood">
                  Cancel
                </Link>
              </div>
            </div>
          </div>
        </div>
      </form>
    </>
  );
}
