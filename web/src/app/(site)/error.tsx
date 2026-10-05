"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function SiteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("Site error boundary:", error);
  }, [error]);

  return (
    <div className="container py-5">
      <div className="panel mx-auto" style={{ maxWidth: "36rem" }}>
        <div className="panel-body text-center py-5">
          <div className="fs-1 mb-2">⚠️</div>
          <h1 className="mb-3">Something Went Wrong</h1>
          <p className="text-muted-wood mb-4">
            We hit an unexpected error loading this page. Please try again, or head back to the home page.
          </p>
          <div className="d-flex flex-wrap justify-content-center gap-2">
            <button type="button" onClick={reset} className="btn btn-wood btn-lg">
              Try Again
            </button>
            <Link href="/" className="btn btn-outline-wood btn-lg">
              Go Home
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
