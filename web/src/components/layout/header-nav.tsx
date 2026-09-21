"use client";

import Link from "next/link";
import { useState } from "react";
import { logoutAction } from "@/lib/auth/actions";
import { SearchBox } from "@/components/layout/search-box";

// Ported from the navbar markup in Views/Shared/_Layout.cshtml, re-implemented with React state
// instead of Bootstrap's JS (Bootstrap's own collapse/dropdown JS fights React's DOM diffing),
// keeping the exact same classes so it looks and behaves identically.
export function HeaderNav({
  cartCount,
  isSignedIn,
  isAdmin,
  fullName,
}: {
  cartCount: number;
  isSignedIn: boolean;
  isAdmin: boolean;
  fullName: string | null;
}) {
  const [navOpen, setNavOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);

  return (
    <>
      <div className="d-flex align-items-center gap-2 order-lg-2">
        <button
          className="mobile-search-toggle d-lg-none"
          type="button"
          aria-label="Search"
          aria-expanded={mobileSearchOpen}
          aria-controls="mobileSearchBar"
          onClick={() => setMobileSearchOpen((v) => !v)}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="11" cy="11" r="7"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
        </button>

        <button
          className="navbar-toggler"
          type="button"
          aria-controls="mainNav"
          aria-expanded={navOpen}
          aria-label="Toggle navigation"
          onClick={() => setNavOpen((v) => !v)}
        >
          <span className="navbar-toggler-icon"></span>
        </button>
      </div>

      {mobileSearchOpen && (
        <div className="mobile-search-bar d-lg-none w-100" id="mobileSearchBar">
          <SearchBox inputId="mobileSiteSearch" />
        </div>
      )}

      <div className={`collapse navbar-collapse${navOpen ? " show" : ""}`} id="mainNav">
        <ul className="navbar-nav me-auto mb-2 mb-lg-0">
          <li className="nav-item">
            <Link className="nav-link" href="/">
              Home
            </Link>
          </li>
          <li className="nav-item">
            <Link className="nav-link" href="/shop">
              Products
            </Link>
          </li>
          <li className="nav-item">
            <Link className="nav-link" href="/about">
              About Us
            </Link>
          </li>
          <li className="nav-item">
            <Link className="nav-link" href="/contact">
              Contact
            </Link>
          </li>
        </ul>

        <div className="search-wrap me-lg-3 my-2 my-lg-0 d-none d-lg-block" style={{ minWidth: 230 }}>
          <SearchBox inputId="siteSearch" />
        </div>

        <ul className="navbar-nav align-items-lg-center gap-lg-1">
          <li className="nav-item">
            <Link className="nav-link position-relative js-cart-link" href="/cart" aria-label="Cart">
              Cart
              {cartCount > 0 && <span className="cart-badge">{cartCount}</span>}
            </Link>
          </li>

          {isSignedIn ? (
            <li className={`nav-item dropdown${accountOpen ? " show" : ""}`}>
              <a
                className="nav-link dropdown-toggle"
                href="#"
                role="button"
                aria-expanded={accountOpen}
                onClick={(e) => {
                  e.preventDefault();
                  setAccountOpen((v) => !v);
                }}
              >
                {fullName || "Account"}
              </a>
              <ul className={`dropdown-menu dropdown-menu-end${accountOpen ? " show" : ""}`}>
                <li>
                  <Link className="dropdown-item" href="/orders" onClick={() => setAccountOpen(false)}>
                    My Orders
                  </Link>
                </li>
                <li>
                  <Link className="dropdown-item" href="/account/profile" onClick={() => setAccountOpen(false)}>
                    My Profile
                  </Link>
                </li>
                {isAdmin && (
                  <>
                    <li>
                      <hr className="dropdown-divider" />
                    </li>
                    <li>
                      <Link className="dropdown-item fw-bold" href="/admin" onClick={() => setAccountOpen(false)}>
                        Admin Panel
                      </Link>
                    </li>
                  </>
                )}
                <li>
                  <hr className="dropdown-divider" />
                </li>
                <li>
                  <form action={logoutAction} className="px-1">
                    <button type="submit" className="dropdown-item">
                      Sign Out
                    </button>
                  </form>
                </li>
              </ul>
            </li>
          ) : (
            <>
              <li className="nav-item">
                <Link className="nav-link" href="/account/login">
                  Sign In
                </Link>
              </li>
              <li className="nav-item">
                <Link className="btn btn-wood btn-sm ms-lg-2" href="/account/register">
                  Register
                </Link>
              </li>
            </>
          )}
        </ul>
      </div>
    </>
  );
}
