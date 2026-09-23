import { PageLoader } from "@/components/ui/page-loader";

// Covers every nested admin list/detail page too (products, categories, orders, inquiries,
// reviews, feedback, users, settings) — a loading.tsx in a layout's own segment applies to all
// its children's navigations, so this one file covers the whole admin section's page-to-page
// transitions, not just /admin itself.
export default function AdminLoading() {
  return <PageLoader text="Loading..." />;
}
