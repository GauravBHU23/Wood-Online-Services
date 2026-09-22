"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createCategoryAction, updateCategoryAction } from "@/lib/admin/category-actions";
import { useToast } from "@/components/ui/toast-provider";
import type { CategoryFormData } from "@/lib/data/admin-categories";

// Ported from Areas/Admin/Views/Categories/Form.cshtml.
export function CategoryForm({
  categoryId,
  initial,
  imageUrl,
  productCount,
}: {
  categoryId?: number;
  initial: CategoryFormData;
  imageUrl: string | null;
  productCount: number;
}) {
  const router = useRouter();
  const toast = useToast();
  const isEdit = !!categoryId;

  const [form, setForm] = useState<CategoryFormData>(initial);
  const [image, setImage] = useState<File | null>(null);
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [formError, setFormError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setErrors({});

    if (!form.name.trim()) {
      setErrors({ name: ["Category name is required"] });
      return;
    }

    startTransition(async () => {
      const result = isEdit ? await updateCategoryAction(categoryId!, form, image) : await createCategoryAction(form, image);

      if (result.success) {
        toast.success(result.message ?? "Saved.");
        router.push("/admin/categories");
        router.refresh();
      } else {
        setFormError(result.message ?? "Could not save the category.");
        if (result.fieldErrors) setErrors(result.fieldErrors);
      }
    });
  }

  return (
    <>
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-4">
        <h1 className="mb-0">{isEdit ? "Edit Category" : "New category"}</h1>
        <Link href="/admin/categories" className="btn btn-outline-wood">
          ← All categories
        </Link>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="row g-4">
          <div className="col-lg-8">
            <div className="panel">
              <div className="panel-header">Category Details</div>
              <div className="panel-body">
                {formError && <div className="alert alert-danger py-2 small">{formError}</div>}

                <div className="mb-3">
                  <label className="form-label">
                    Category Name <span className="text-danger">*</span>
                  </label>
                  <input className="form-control" placeholder="e.g. Dining" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
                  {errors.name?.[0] && <span className="field-validation-error d-block">{errors.name[0]}</span>}
                </div>

                <div className="mb-3">
                  <label className="form-label">Description</label>
                  <textarea
                    rows={3}
                    className="form-control"
                    placeholder="A short line describing what this category contains."
                    value={form.description ?? ""}
                    onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  />
                </div>

                <div className="row g-3">
                  <div className="col-md-6">
                    <label className="form-label">Display Order</label>
                    <input
                      type="number"
                      min={0}
                      className="form-control"
                      value={form.displayOrder}
                      onChange={(e) => setForm((f) => ({ ...f, displayOrder: Number(e.target.value) }))}
                    />
                    <span className="small text-muted-wood">Lower numbers appear first.</span>
                  </div>

                  <div className="col-md-6 d-flex align-items-center">
                    <div className="form-check mt-3">
                      <input
                        type="checkbox"
                        className="form-check-input"
                        id="isActive"
                        checked={form.isActive}
                        onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
                      />
                      <label className="form-check-label" htmlFor="isActive">
                        Active
                      </label>
                      <div className="small text-muted-wood">An inactive category is hidden from the site.</div>
                    </div>
                  </div>
                </div>

                {isEdit && productCount > 0 && (
                  <div className="alert alert-info py-2 small mt-3 mb-0">
                    This category has <strong>{productCount}</strong> products. It cannot be deleted while they exist. Set it inactive instead to
                    hide it.
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="col-lg-4">
            <div className="panel mb-3">
              <div className="panel-header">Category image</div>
              <div className="panel-body">
                {imageUrl && <img src={imageUrl} alt="" className="img-fluid rounded mb-2" style={{ border: "1px solid var(--line)", maxHeight: 160 }} />}
                <input type="file" className="form-control" accept="image/*" onChange={(e) => setImage(e.target.files?.[0] ?? null)} />
                {errors.image?.[0] && <span className="field-validation-error d-block">{errors.image[0]}</span>}
                <div className="small text-muted-wood mt-1">A square image works best.</div>
              </div>
            </div>

            <div className="panel">
              <div className="panel-body d-grid gap-2">
                <button type="submit" className={`btn btn-wood btn-lg${pending ? " is-busy" : ""}`} disabled={pending}>
                  {pending && <span className="wos-btn-spinner" aria-hidden="true" />}
                  {pending ? "Saving..." : isEdit ? "Save Changes" : "Add Category"}
                </button>
                <Link href="/admin/categories" className="btn btn-outline-wood">
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
