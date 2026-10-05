"use client";

import { useState } from "react";

// A plain <img> with a shimmering skeleton behind it until the browser actually paints it —
// every product thumbnail site-wide currently pops in abruptly against a flat placeholder color
// with no loading feedback. Not next/image (the project uses plain <img> throughout, e.g. because
// product photos are user-uploaded to Supabase storage with arbitrary dimensions), just the
// missing "is it loaded yet" signal added on top of the existing <img> markup.
export function LazyImage({
  src,
  alt,
  className = "",
  wrapperClassName = "",
  width,
  height,
  loading = "lazy",
}: {
  src: string;
  alt: string;
  className?: string;
  wrapperClassName?: string;
  width?: number;
  height?: number;
  loading?: "lazy" | "eager";
}) {
  const [loaded, setLoaded] = useState(false);

  return (
    <div className={`lazy-image-wrap${loaded ? "" : " is-loading"} ${wrapperClassName}`.trim()}>
      <img
        src={src}
        alt={alt}
        className={className}
        width={width}
        height={height}
        loading={loading}
        decoding="async"
        onLoad={() => setLoaded(true)}
      />
    </div>
  );
}
