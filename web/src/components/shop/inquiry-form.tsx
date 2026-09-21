"use client";

import { useState } from "react";
import { useToast } from "@/components/ui/toast-provider";

// Ported from the inline inquiry form in Views/Shop/Details.cshtml (and the standalone
// Views/Home/Contact.cshtml uses the same fields — see app/(site)/contact).
export function InquiryForm({ productId, defaultMessage = "" }: { productId?: number; defaultMessage?: string }) {
  const toast = useToast();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState(defaultMessage);
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);

    try {
      const res = await fetch("/api/inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, phone, email: email || undefined, productId, message }),
      });
      const json = await res.json();

      if (json.success) {
        toast.success(json.message ?? "Thank you! We have received your message.");
        setSent(true);
        setName("");
        setPhone("");
        setEmail("");
        setMessage(defaultMessage);
      } else {
        toast.error(json.message ?? "Please correct the highlighted fields and try again.");
      }
    } catch {
      toast.error("We could not reach the server. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (sent) {
    return <p className="text-muted-wood mb-0">Thank you! We have received your message and will contact you shortly.</p>;
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div className="row g-3">
        <div className="col-md-6">
          <label className="form-label" htmlFor="inqName">
            Your Name <span className="text-danger">*</span>
          </label>
          <input
            type="text"
            id="inqName"
            className="form-control"
            maxLength={100}
            required
            minLength={2}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="col-md-6">
          <label className="form-label" htmlFor="inqPhone">
            Phone / WhatsApp <span className="text-danger">*</span>
          </label>
          <input
            type="tel"
            id="inqPhone"
            className="form-control"
            maxLength={20}
            required
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </div>
        <div className="col-12">
          <label className="form-label" htmlFor="inqEmail">
            Email (optional)
          </label>
          <input
            type="email"
            id="inqEmail"
            className="form-control"
            maxLength={150}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="col-12">
          <label className="form-label" htmlFor="inqMsg">
            Message <span className="text-danger">*</span>
          </label>
          <textarea
            id="inqMsg"
            rows={4}
            className="form-control"
            maxLength={2000}
            required
            minLength={10}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
          <div className="char-counter">{message.length} / 2000</div>
        </div>
        <div className="col-12">
          <button type="submit" className={`btn btn-wood${submitting ? " is-busy" : ""}`} disabled={submitting}>
            {submitting && <span className="wos-btn-spinner" aria-hidden="true" />}
            {submitting ? "Sending..." : "Send Inquiry"}
          </button>
          <span className="small text-muted-wood ms-2">We usually reply within 24 hours.</span>
        </div>
      </div>
    </form>
  );
}
