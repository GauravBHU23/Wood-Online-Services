import { PageLoader } from "@/components/ui/page-loader";

// Covers the homepage and any (site) page without its own more specific loading.tsx (about,
// contact, cart, checkout, account/*, privacy/terms/license) — those are lighter, single-query
// pages, but still benefit from something visible during the server round trip rather than a
// blank screen on slower connections.
export default function SiteLoading() {
  return <PageLoader />;
}
