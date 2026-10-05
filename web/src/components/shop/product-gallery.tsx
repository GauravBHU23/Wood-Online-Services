"use client";

import { useEffect, useState } from "react";

// Replaces the dead #mainImage/.gallery-thumb markup (ported from Views/Shop/Details.cshtml,
// wired to wwwroot/js/site.js in the original) with working thumbnail-swap + a click-to-zoom
// lightbox — neither was ever reconnected after the migration.
export function ProductGallery({ images, alt }: { images: string[]; alt: string }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const active = images[activeIndex] ?? images[0];

  useEffect(() => {
    if (!lightboxOpen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setLightboxOpen(false);
    }
    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [lightboxOpen]);

  return (
    <>
      <button
        type="button"
        className="gallery-main-btn mb-3"
        onClick={() => setLightboxOpen(true)}
        aria-label={`View larger image of ${alt}`}
      >
        <div className="gallery-main-wrap">
          <img id="mainImage" src={active} alt={alt} className="gallery-main" width={600} height={450} />
        </div>
        <span className="gallery-zoom-hint" aria-hidden="true">
          🔍 Tap to zoom
        </span>
      </button>

      {images.length > 1 && (
        <div className="d-flex gap-2 flex-wrap">
          {images.map((src, i) => (
            <button
              key={src + i}
              type="button"
              className="gallery-thumb-btn"
              onClick={() => setActiveIndex(i)}
              aria-label={`Show ${alt} view ${i + 1}`}
              aria-pressed={i === activeIndex}
            >
              <div className={`gallery-thumb-wrap${i === activeIndex ? " active" : ""}`}>
                <img src={src} alt={`${alt} view ${i + 1}`} className="gallery-thumb" loading="lazy" />
              </div>
            </button>
          ))}
        </div>
      )}

      {lightboxOpen && (
        <div
          className="gallery-lightbox"
          role="dialog"
          aria-modal="true"
          aria-label={`${alt} — enlarged image`}
          onClick={() => setLightboxOpen(false)}
        >
          <button type="button" className="gallery-lightbox-close" onClick={() => setLightboxOpen(false)} aria-label="Close">
            ✕
          </button>
          <img src={active} alt={alt} className="gallery-lightbox-img" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </>
  );
}
