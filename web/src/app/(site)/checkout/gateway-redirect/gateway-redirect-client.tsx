"use client";

import { useEffect, useState } from "react";
import Script from "next/script";
import Link from "next/link";

// Ported from Views/Checkout/GatewayRedirect.cshtml's inline script.
declare global {
  interface Window {
    Cashfree?: (config: { mode: string }) => {
      checkout: (options: { paymentSessionId: string; redirectTarget: string }) => void;
    };
  }
}

export function GatewayRedirectClient({ sessionId }: { sessionId: string; clientId: string }) {
  const [error, setError] = useState<string | null>(null);
  const [sdkReady, setSdkReady] = useState(false);

  useEffect(() => {
    if (!sdkReady) return;

    // This effect's job is launching Cashfree's redirect (a genuine external-system action);
    // the error state is only set on the failure path, and deferred via queueMicrotask so it
    // never runs as the first synchronous statement of the effect body.
    if (!sessionId || typeof window.Cashfree === "undefined") {
      queueMicrotask(() => setError("We could not start the payment page. Please try again from your orders page."));
      return;
    }

    try {
      const cashfree = window.Cashfree({ mode: "production" });
      cashfree.checkout({ paymentSessionId: sessionId, redirectTarget: "_self" });
    } catch {
      queueMicrotask(() => setError("We could not start the payment page. Please try again from your orders page."));
    }
  }, [sdkReady, sessionId]);

  return (
    <>
      <Script src="https://sdk.cashfree.com/js/v3/cashfree.js" onLoad={() => setSdkReady(true)} />

      <div className="container py-5">
        <div className="row">
          <div className="col-lg-6 mx-auto text-center">
            <div className="panel">
              <div className="panel-body py-5">
                <div className="spinner-border text-wood mb-4" role="status" style={{ width: "3rem", height: "3rem" }}>
                  <span className="visually-hidden">Loading...</span>
                </div>
                <h5 className="mb-2">Redirecting you to our payment partner</h5>
                <p className="text-muted-wood mb-4">Please do not close this window. You will be taken to a secure payment page.</p>
                {error && (
                  <div className="alert alert-danger text-start" role="alert">
                    {error}
                  </div>
                )}
                <noscript>
                  <div className="alert alert-warning text-start">
                    JavaScript is required to complete online payment. Please enable it, or <Link href="/orders">go to your orders</Link> to
                    retry with Cash on Delivery.
                  </div>
                </noscript>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
