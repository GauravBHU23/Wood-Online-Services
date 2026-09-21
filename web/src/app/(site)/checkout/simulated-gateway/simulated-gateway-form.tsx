"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { applySimulatedOutcomeAction } from "@/lib/payments/actions";
import { useToast } from "@/components/ui/toast-provider";

const METHODS = ["UPI", "Credit Card", "Debit Card", "Net Banking", "Wallet"];

// Ported from Views/Checkout/SimulatedGateway.cshtml.
export function SimulatedGatewayForm({ requestId, amount, orderNumber }: { requestId: string; amount: number; orderNumber: string }) {
  const [method, setMethod] = useState(METHODS[0]);
  const [pending, startTransition] = useTransition();
  const [pendingOutcome, setPendingOutcome] = useState<"success" | "fail" | null>(null);
  const router = useRouter();
  const toast = useToast();

  function submit(outcome: "success" | "fail") {
    setPendingOutcome(outcome);
    startTransition(async () => {
      const result = await applySimulatedOutcomeAction(requestId, outcome, method);
      if (result.success) toast.success(result.message);
      else toast.error(result.message);
      router.push(result.redirectTo);
    });
  }

  return (
    <div className="container py-5">
      <div className="row">
        <div className="col-lg-6 mx-auto">
          <div className="alert alert-warning d-flex align-items-start gap-2 mb-4">
            <span style={{ fontSize: "1.15rem", lineHeight: 1 }}>⚠</span>
            <div className="small">
              <strong>Test payment page.</strong> This is a local stand-in for the payment gateway, used because a
              real gateway cannot reach a development machine. <strong>No money will be charged.</strong> Choose an
              outcome below to continue.
            </div>
          </div>

          <div className="panel">
            <div className="panel-header d-flex justify-content-between align-items-center">
              <span>Complete Your Payment</span>
              <span className="badge badge-soft">Test Mode</span>
            </div>

            <div className="panel-body">
              <div className="text-center mb-4 pb-4 border-bottom border-wood">
                <div className="small text-muted-wood">Amount payable</div>
                <div style={{ fontSize: "2.4rem", fontWeight: 700, fontFamily: "var(--font-display)", color: "var(--wood-900)", lineHeight: 1.1 }}>
                  ₹{Math.round(amount).toLocaleString("en-IN")}
                </div>
                <div className="small text-muted-wood mt-1">Order {orderNumber}</div>
              </div>

              <label className="form-label">Payment method</label>
              <div className="row g-2 mb-4">
                {METHODS.map((m, i) => (
                  <div key={m} className="col-6 col-sm-4">
                    <input
                      type="radio"
                      className="btn-check"
                      name="method"
                      id={`m-${i}`}
                      checked={method === m}
                      onChange={() => setMethod(m)}
                    />
                    <label className="btn btn-outline-wood btn-sm w-100" htmlFor={`m-${i}`}>
                      {m}
                    </label>
                  </div>
                ))}
              </div>

              <div className="d-grid gap-2">
                <button
                  type="button"
                  className={`btn btn-wood btn-lg${pending && pendingOutcome === "success" ? " is-busy" : ""}`}
                  disabled={pending}
                  onClick={() => submit("success")}
                >
                  {pending && pendingOutcome === "success" ? "Processing payment..." : `Pay ₹${Math.round(amount).toLocaleString("en-IN")}`}
                </button>

                <button
                  type="button"
                  className={`btn btn-outline-danger${pending && pendingOutcome === "fail" ? " is-busy" : ""}`}
                  disabled={pending}
                  onClick={() => submit("fail")}
                >
                  {pending && pendingOutcome === "fail" ? "Cancelling..." : "Simulate a failed payment"}
                </button>
              </div>

              <div className="secure-note justify-content-center mt-3">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z" />
                </svg>
                <span>On the live site this step happens on the gateway&apos;s own secure page.</span>
              </div>
            </div>
          </div>

          <p className="text-center small text-muted-wood mt-3 mb-0">
            Cancelling leaves the order saved and unpaid, so you can retry from your orders page.
          </p>
        </div>
      </div>
    </div>
  );
}
