"use client";

import { useEffect, useState } from "react";

interface VisitorInfo {
  ipAddress: string;
  location: string | null;
  totalVisits: number;
}

// Ported from Views/Shared/_Layout.cshtml's #visitorBadge, backed by /api/visitor/info.
export function VisitorBadge() {
  const [info, setInfo] = useState<VisitorInfo | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/visitor/info")
      .then((r) => r.json())
      .then((json) => {
        if (!cancelled && json.success) setInfo(json.data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  if (!info) return null;

  return (
    <div id="visitorBadge" className="visitor-badge">
      <span className="visitor-badge__item">
        <span className="visitor-badge__dot" aria-hidden="true"></span>
        Visitors: <span className="js-visitor-count visitor-badge__value">{info.totalVisits.toLocaleString("en-IN")}</span>
      </span>
      <span className="visitor-badge__sep" aria-hidden="true"></span>
      <span className="visitor-badge__item">
        Your IP: <span className="js-visitor-ip visitor-badge__value">{info.ipAddress}</span>
      </span>
      <span className="visitor-badge__sep" aria-hidden="true"></span>
      <span className="visitor-badge__item js-visitor-location visitor-badge__value">{info.location || "-"}</span>
    </div>
  );
}
