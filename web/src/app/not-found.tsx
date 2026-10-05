import Link from "next/link";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";

// Renders inside the root layout's <html>/<body> (that wrapper always applies), but outside the
// (site) route group's own layout — so it needs its own Header/Footer, same as that group's
// not-found.tsx, just for the case where the URL doesn't match ANY route segment at all and
// Next.js falls all the way back to this root-level file instead.
export default function RootNotFound() {
  return (
    <>
      <Header />
      <main>
        <div className="container py-5">
          <div className="panel mx-auto" style={{ maxWidth: "36rem" }}>
            <div className="panel-body text-center py-5">
              <div className="fs-1 mb-2">🪵</div>
              <h1 className="mb-3">Page Not Found</h1>
              <p className="text-muted-wood mb-4">
                The page you are looking for may have been moved, renamed, or no longer exists.
              </p>
              <div className="d-flex flex-wrap justify-content-center gap-2">
                <Link href="/" className="btn btn-wood btn-lg">
                  Go Home
                </Link>
                <Link href="/shop" className="btn btn-outline-wood btn-lg">
                  Browse Products
                </Link>
              </div>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
