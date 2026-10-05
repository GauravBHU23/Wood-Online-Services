"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("Admin error boundary:", error);
  }, [error]);

  return (
    <div className="container py-5">
      <div className="panel mx-auto" style={{ maxWidth: "36rem" }}>
        <div className="panel-body text-center py-5">
          <div className="fs-1 mb-2">⚠️</div>
          <h1 className="mb-3">Something Went Wrong</h1>
          <p className="text-muted-wood mb-4">This admin page hit an unexpected error. Please try again.</p>
          <div className="d-flex flex-wrap justify-content-center gap-2">
            <button type="button" onClick={reset} className="btn btn-wood btn-lg">
              Try Again
            </button>
            <Link href="/admin" className="btn btn-outline-wood btn-lg">
              Dashboard
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
