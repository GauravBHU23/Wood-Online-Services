"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { adminLogoutAction } from "@/lib/auth/admin-actions";
import { useRouter } from "next/navigation";

interface NavItem {
  href: string;
  label: string;
  icon: string;
  badge?: number;
  badgeClass?: string;
}

// Ported from Areas/Admin/Views/Shared/_AdminLayout.cshtml's navbar + sidebar.
export function AdminChrome({
  shopName,
  adminName,
  newInquiries,
  pendingOrders,
  pendingReviews,
  feedbackCount,
  children,
}: {
  shopName: string;
  adminName: string;
  newInquiries: number;
  pendingOrders: number;
  pendingReviews: number;
  feedbackCount: number;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [navOpen, setNavOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);

  function isActive(section: string) {
    return pathname === `/admin/${section}` || pathname.startsWith(`/admin/${section}/`);
  }

  const overview: NavItem[] = [{ href: "/admin", label: "Dashboard", icon: "📊" }];
  const catalog: NavItem[] = [
    { href: "/admin/products", label: "Products", icon: "🪑" },
    { href: "/admin/categories", label: "Categories", icon: "📁" },
  ];
  const customers: NavItem[] = [
    { href: "/admin/users", label: "Customers", icon: "👤" },
    { href: "/admin/orders", label: "Orders", icon: "📦", badge: pendingOrders, badgeClass: "bg-warning text-dark" },
    { href: "/admin/inquiries", label: "Inquiries", icon: "💬", badge: newInquiries, badgeClass: "bg-danger" },
    { href: "/admin/reviews", label: "Reviews", icon: "⭐", badge: pendingReviews, badgeClass: "bg-warning text-dark" },
    { href: "/admin/feedback", label: "Feedback", icon: "💌", badge: feedbackCount, badgeClass: "bg-secondary" },
  ];

  function renderNavGroup(heading: string, items: NavItem[]) {
    return (
      <>
        <div className="sidebar-heading">{heading}</div>
        {items.map((item) => {
          const section = item.href.replace("/admin/", "").replace("/admin", "") || "dashboard";
          const active = item.href === "/admin" ? pathname === "/admin" : isActive(section);
          return (
            <Link key={item.href} className={active ? "nav-link active" : "nav-link"} href={item.href}>
              {item.icon} {item.label}
              {!!item.badge && <span className={`badge ${item.badgeClass ?? "bg-secondary"} ms-auto`}>{item.badge}</span>}
            </Link>
          );
        })}
      </>
    );
  }

  async function handleLogout() {
    await adminLogoutAction();
    router.push("/admin/login");
    router.refresh();
  }

  return (
    <>
      <nav className="navbar navbar-expand-lg navbar-wood sticky-top no-print">
        <div className="container-fluid px-3 px-lg-4">
          <Link className="navbar-brand d-flex align-items-center gap-2" href="/admin">
            <span style={{ fontFamily: "var(--font-display)", fontWeight: 700 }}>{shopName}</span>
            <span className="badge badge-wood">ADMIN</span>
          </Link>

          <div className="d-flex align-items-center gap-2 order-lg-2">
            <button className="admin-account-toggler d-lg-none" type="button" onClick={() => setAccountOpen((v) => !v)} aria-label="Account menu">
              👤
            </button>
            <button
              className="navbar-toggler"
              type="button"
              onClick={() => setNavOpen((v) => !v)}
              aria-label="Menu"
              aria-expanded={navOpen}
            >
              <span className="navbar-toggler-icon"></span>
            </button>
          </div>

          <div className={`collapse navbar-collapse order-lg-1${accountOpen ? " show" : ""}`}>
            <ul className="navbar-nav ms-auto align-items-lg-center">
              <li className="nav-item">
                <Link className="nav-link" href="/" target="_blank">
                  🌐 View Site
                </Link>
              </li>
              <li className={`nav-item dropdown${accountOpen ? " show" : ""}`}>
                <a
                  className="nav-link dropdown-toggle"
                  href="#"
                  role="button"
                  onClick={(e) => {
                    e.preventDefault();
                    setAccountOpen((v) => !v);
                  }}
                >
                  👤 {adminName}
                </a>
                <ul className={`dropdown-menu dropdown-menu-end${accountOpen ? " show" : ""}`}>
                  <li>
                    <Link className="dropdown-item" href="/account/profile">
                      Profile
                    </Link>
                  </li>
                  <li>
                    <Link className="dropdown-item" href="/account/change-password">
                      Change Password
                    </Link>
                  </li>
                  <li>
                    <hr className="dropdown-divider" />
                  </li>
                  <li>
                    <form action={handleLogout} className="px-1">
                      <button type="submit" className="dropdown-item">
                        Logout
                      </button>
                    </form>
                  </li>
                </ul>
              </li>
            </ul>
          </div>
        </div>
      </nav>

      <div className="container-fluid px-3 px-lg-4 py-4">
        <div className="row g-4">
          <aside className="col-lg-2 no-print">
            <div className={`collapse d-lg-block admin-sidebar${navOpen ? " show" : ""}`}>
              <nav className="nav flex-column">
                {renderNavGroup("Overview", overview)}
                {renderNavGroup("Catalog", catalog)}
                {renderNavGroup("Customers", customers)}
              </nav>
            </div>
          </aside>

          <div className="col-lg-10">{children}</div>
        </div>
      </div>
    </>
  );
}
