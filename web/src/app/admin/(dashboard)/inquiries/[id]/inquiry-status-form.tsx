"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateInquiryStatusAction } from "@/lib/admin/inquiry-actions";
import { useToast } from "@/components/ui/toast-provider";
import type { InquiryStatus } from "@/types/database";

const STATUSES: InquiryStatus[] = ["new", "contacted", "closed"];

export function InquiryStatusForm({ inquiryId, status, adminNotes }: { inquiryId: number; status: InquiryStatus; adminNotes: string | null }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState({ status, adminNotes: adminNotes ?? "" });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await updateInquiryStatusAction(inquiryId, form.status, form.adminNotes);
      if (result.success) {
        toast.success(result.message ?? "Saved.");
        router.refresh();
      } else {
        toast.error(result.message ?? "Could not save.");
      }
    });
  }

  return (
    <div className="panel mb-3">
      <div className="panel-header">Status and Notes</div>
      <div className="panel-body">
        <form onSubmit={handleSubmit}>
          <div className="mb-3">
            <label className="form-label">Status</label>
            <select className="form-select" value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as InquiryStatus }))}>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </option>
              ))}
            </select>
          </div>

          <div className="mb-3">
            <label className="form-label">Admin notes</label>
            <textarea
              rows={5}
              className="form-control"
              placeholder="What was discussed, what was quoted, when to call again..."
              value={form.adminNotes}
              onChange={(e) => setForm((f) => ({ ...f, adminNotes: e.target.value }))}
            />
            <div className="small text-muted-wood mt-1">This is visible only to you, not to the customer.</div>
          </div>

          <button type="submit" className={`btn btn-wood w-100${pending ? " is-busy" : ""}`} disabled={pending}>
            {pending && <span className="wos-btn-spinner" aria-hidden="true" />}
            {pending ? "Saving..." : "Save Changes"}
          </button>
        </form>
      </div>
    </div>
  );
}
