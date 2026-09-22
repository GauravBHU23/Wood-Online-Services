import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getAdminInquiryById } from "@/lib/data/admin-inquiries";
import { formatDateTime } from "@/lib/utils/format";
import { InquiryStatusForm } from "./inquiry-status-form";
import { DeleteInquiryButton } from "./delete-inquiry-button";

interface PageParams {
  id: string;
}

export async function generateMetadata({ params }: { params: Promise<PageParams> }): Promise<Metadata> {
  const { id } = await params;
  return { title: `Inquiry #${id}` };
}

// Ported from Areas/Admin/Controllers/InquiriesController.cs#Details + Views/Inquiries/Details.cshtml.
export default async function AdminInquiryDetailPage({ params }: { params: Promise<PageParams> }) {
  const { id } = await params;
  const inquiryId = Number(id);
  if (!Number.isInteger(inquiryId) || inquiryId <= 0) notFound();

  const inquiry = await getAdminInquiryById(inquiryId);
  if (!inquiry) notFound();

  const digits = inquiry.phone.replace(/\D/g, "");
  const waText = encodeURIComponent(`Hello ${inquiry.name}, thank you for your inquiry. `);
  const mailSubject = encodeURIComponent("About your inquiry");

  return (
    <>
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-4">
        <div>
          <h1 className="mb-1">Inquiry #{inquiry.id}</h1>
          <p className="text-muted-wood mb-0">{formatDateTime(inquiry.created_at)}</p>
        </div>
        <Link href="/admin/inquiries" className="btn btn-outline-wood">
          ← All Inquiries
        </Link>
      </div>

      <div className="row g-4">
        <div className="col-lg-8">
          <div className="panel mb-3">
            <div className="panel-header">Customer Message</div>
            <div className="panel-body">
              <div className="row g-3 mb-3">
                <div className="col-md-6">
                  <div className="small text-muted-wood">Name</div>
                  <div className="fw-bold">{inquiry.name}</div>
                </div>
                <div className="col-md-6">
                  <div className="small text-muted-wood">Phone</div>
                  <div className="fw-bold">
                    <a href={`tel:${inquiry.phone}`}>{inquiry.phone}</a>
                  </div>
                </div>
                {inquiry.email && (
                  <div className="col-md-6">
                    <div className="small text-muted-wood">Email</div>
                    <div>
                      <a href={`mailto:${inquiry.email}`}>{inquiry.email}</a>
                    </div>
                  </div>
                )}
                {inquiry.product && (
                  <div className="col-md-6">
                    <div className="small text-muted-wood">Product</div>
                    <a href={`/shop/${inquiry.product.id}`} target="_blank" rel="noopener noreferrer" className="fw-bold">
                      {inquiry.product.name} ↗
                    </a>
                  </div>
                )}
              </div>

              <hr />

              <div className="small text-muted-wood mb-1">Message</div>
              <div className="bg-wood-50 rounded p-3" style={{ whiteSpace: "pre-line" }}>
                {inquiry.message}
              </div>
            </div>
          </div>

          <div className="panel">
            <div className="panel-header">Quick Reply</div>
            <div className="panel-body d-flex flex-wrap gap-2">
              <a href={`tel:${inquiry.phone}`} className="btn btn-wood">
                📞 Call
              </a>
              <a href={`https://wa.me/${digits}?text=${waText}`} target="_blank" rel="noopener noreferrer" className="btn btn-whatsapp">
                💬 WhatsApp
              </a>
              {inquiry.email && (
                <a href={`mailto:${inquiry.email}?subject=${mailSubject}`} className="btn btn-outline-wood">
                  ✉️ Email
                </a>
              )}
            </div>
          </div>
        </div>

        <div className="col-lg-4">
          <InquiryStatusForm inquiryId={inquiry.id} status={inquiry.status} adminNotes={inquiry.admin_notes} />

          <div className="panel">
            <div className="panel-body">
              <DeleteInquiryButton inquiryId={inquiry.id} />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
