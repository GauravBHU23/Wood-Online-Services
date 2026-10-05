"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Counts up to `value` once visible. Starts already showing the real number (so SSR output,
 * no-JS and crawlers see the correct figure immediately) and only resets to 0-and-animates
 * after hydration, client-side, as a purely cosmetic flourish.
 */
export function AnimatedCounter({ value, durationMs = 1200, suffix = "" }: { value: number; durationMs?: number; suffix?: string }) {
  const [display, setDisplay] = useState(value);
  const ref = useRef<HTMLSpanElement>(null);
  const started = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || value <= 0) return;

    const run = () => {
      if (started.current) return;
      started.current = true;
      setDisplay(0);
      const start = performance.now();
      const tick = (now: number) => {
        const progress = Math.min(1, (now - start) / durationMs);
        const eased = 1 - Math.pow(1 - progress, 3);
        setDisplay(Math.round(eased * value));
        if (progress < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    };

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          run();
          observer.disconnect();
        }
      },
      { threshold: 0.3 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [value, durationMs]);

  return (
    <span ref={ref}>
      {display.toLocaleString("en-IN")}
      {suffix}
    </span>
  );
}
