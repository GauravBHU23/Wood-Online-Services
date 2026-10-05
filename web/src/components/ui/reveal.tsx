"use client";

import { useEffect, useRef } from "react";

/**
 * Wires up the already-shipped but previously-unused .js-reveal/.js-reveal-group CSS
 * (site.css) to an IntersectionObserver, so sections fade/slide in once as they enter the
 * viewport. Pure CSS handles the actual transition; this only toggles .is-visible.
 */
export function Reveal({ children, className = "", group = false }: { children: React.ReactNode; className?: string; group?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const targets = group ? Array.from(el.querySelectorAll<HTMLElement>(":scope > *")) : [el];
    for (const t of targets) t.classList.add("js-reveal");

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -40px 0px" }
    );

    for (const t of targets) observer.observe(t);
    return () => observer.disconnect();
  }, [group]);

  return (
    <div ref={ref} className={`${group ? "js-reveal-group" : ""} ${className}`.trim()}>
      {children}
    </div>
  );
}
