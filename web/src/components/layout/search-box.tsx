"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

// Ported from wwwroot/js/site.js#wireSearchBox — same classes/markup/keyboard behaviour
// (.search-wrap / .search-results / .search-result, arrow-key navigation, Escape to close).

interface SearchResult {
  id: number;
  name: string;
  category: string | null;
  woodType: string | null;
  price: number;
  isCustomOrder: boolean;
  image: string | null;
}

export function SearchBox({ inputId }: { inputId: string }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, []);

  // Fetching is a genuine external-system sync (the debounced network request), so it stays in
  // the effect; the loading flag it depends on is set from the event handler that triggers this
  // effect (handleQueryChange) instead of synchronously inside the effect body itself.
  useEffect(() => {
    const term = query.trim();
    if (term.length < 2) return;

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search/suggest?q=${encodeURIComponent(term)}`);
        const json = await res.json();
        setResults(json.success ? json.data ?? [] : null);
        setOpen(true);
        setActiveIndex(-1);
      } catch {
        setResults(null);
        setOpen(true);
      } finally {
        setLoading(false);
      }
    }, 250);
    debounceRef.current = timer;

    return () => clearTimeout(timer);
  }, [query]);

  function handleQueryChange(value: string) {
    setQuery(value);
    if (value.trim().length < 2) {
      setResults(null);
      setOpen(false);
      setLoading(false);
      if (debounceRef.current) clearTimeout(debounceRef.current);
    } else {
      setLoading(true);
    }
  }

  function goTo(id: number) {
    setOpen(false);
    router.push(`/shop/${id}`);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || !results || results.length === 0) return;

    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((prev) => {
        let next = prev + (e.key === "ArrowDown" ? 1 : -1);
        if (next < 0) next = results.length - 1;
        if (next >= results.length) next = 0;
        return next;
      });
    } else if (e.key === "Enter" && activeIndex >= 0) {
      e.preventDefault();
      goTo(results[activeIndex].id);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div className="search-wrap" ref={containerRef}>
      <label htmlFor={inputId} className="visually-hidden">
        Search products
      </label>
      <input
        type="search"
        id={inputId}
        className="form-control form-control-sm"
        placeholder="Search products..."
        autoComplete="off"
        aria-label="Search products"
        aria-controls={`${inputId}Results`}
        value={query}
        onChange={(e) => handleQueryChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={() => query.trim().length >= 2 && results !== null && setOpen(true)}
      />
      <div id={`${inputId}Results`} className={`search-results${open ? " is-open" : ""}`} role="listbox" aria-label="Search suggestions">
        {loading ? (
          <div className="p-3">
            <div className="skeleton skeleton-text"></div>
            <div className="skeleton skeleton-text"></div>
          </div>
        ) : results === null ? null : results.length === 0 ? (
          <div className="search-empty">
            No products matched &ldquo;{query.trim()}&rdquo;.
            <br />
            <a href="/contact" className="small">
              Ask us about it
            </a>
          </div>
        ) : (
          results.map((item, i) => {
            const price = item.isCustomOrder ? "On request" : `₹${Math.round(item.price).toLocaleString("en-IN")}`;
            const meta = [item.category, item.woodType].filter(Boolean).join(" · ");
            return (
              <a
                key={item.id}
                className={`search-result${i === activeIndex ? " is-active" : ""}`}
                href={`/shop/${item.id}`}
                onClick={(e) => {
                  e.preventDefault();
                  goTo(item.id);
                }}
              >
                <img src={item.image || "/img/cat-custom.svg"} alt="" loading="lazy" />
                <span className="flex-grow-1" style={{ minWidth: 0 }}>
                  <span className="search-result__name d-block text-truncate">{item.name}</span>
                  <span className="search-result__meta">{meta}</span>
                </span>
                <span className="search-result__price">{price}</span>
              </a>
            );
          })
        )}
      </div>
    </div>
  );
}
