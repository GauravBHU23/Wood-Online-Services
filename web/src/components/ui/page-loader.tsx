// A route segment's loading.tsx replaces the page with this while the server fetches that
// page's data — Next.js shows it automatically on navigation, no wiring needed beyond the file
// existing. Reuses the .wos-loader/.wos-loader__spinner classes ported from wwwroot/js/notify.js
// (that file defined a showLoader()/hideLoader() pair exposed as window.WOS.showLoader, styled
// with these same classes, but never actually called it anywhere in the original app — this is
// the first thing that actually uses that visual design, now automatically, for every
// slower-loading route rather than needing a manual call before/after each fetch).
export function PageLoader({ text = "Loading..." }: { text?: string }) {
  return (
    <div className="wos-loader-overlay is-visible" role="status" aria-live="polite">
      <div className="wos-loader">
        <div className="wos-loader__spinner" aria-hidden="true" />
        <div className="wos-loader__text">{text}</div>
      </div>
    </div>
  );
}
