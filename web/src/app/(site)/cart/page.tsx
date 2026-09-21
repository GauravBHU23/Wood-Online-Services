import type { Metadata } from "next";
import { getCart } from "@/lib/data/cart";
import { getSiteSettingsPublic } from "@/lib/data/site-settings";
import { CartTable } from "./cart-table";
import { ClearCartButton } from "./clear-cart-button";
import Link from "next/link";

export const metadata: Metadata = { title: "Your Cart" };

// Ported from Controllers/CartController.cs#Index + Views/Cart/Index.cshtml.
export default async function CartPage() {
  const [cart, site] = await Promise.all([getCart(), getSiteSettingsPublic()]);

  return (
    <>
      <div className="bg-wood-50 border-bottom border-wood py-4">
        <div className="container">
          <h1 className="mb-1">Your Cart</h1>
          <p className="text-muted-wood mb-0">
            {cart.itemCount} item{cart.itemCount === 1 ? "" : "s"}
          </p>
        </div>
      </div>

      <div className="container py-4">
        {cart.isEmpty ? (
          <div className="panel">
            <div className="empty-state">
              <div style={{ fontSize: "3.5rem" }}>🛒</div>
              <h3>Your cart is empty</h3>
              <p>Browse our products and add whatever you like to your cart.</p>
              <Link href="/shop" className="btn btn-wood mt-2">
                Browse Products
              </Link>
            </div>
          </div>
        ) : (
          <div className="row g-4">
            <div className="col-lg-8">
              <div className="panel">
                <div className="panel-header d-flex justify-content-between align-items-center">
                  <span>Cart Items</span>
                  <ClearCartButton />
                </div>

                <CartTable lines={cart.lines} />
              </div>

              <Link href="/shop" className="btn btn-outline-wood mt-3">
                ← Continue Shopping
              </Link>
            </div>

            <div className="col-lg-4">
              <div className="panel" style={{ position: "sticky", top: "1rem" }}>
                <div className="panel-header">Order Summary</div>
                <div className="panel-body">
                  <div className="d-flex justify-content-between mb-2">
                    <span>
                      Subtotal ({cart.itemCount} item{cart.itemCount === 1 ? "" : "s"})
                    </span>
                    <span className="fw-bold">₹{Math.round(cart.subTotal).toLocaleString("en-IN")}</span>
                  </div>

                  <div className="d-flex justify-content-between mb-2">
                    <span>Delivery</span>
                    {cart.shippingCharge <= 0 ? (
                      <span className="text-success fw-bold">Free</span>
                    ) : (
                      <span className="fw-bold">₹{Math.round(cart.shippingCharge).toLocaleString("en-IN")}</span>
                    )}
                  </div>

                  {cart.shippingCharge > 0 && (
                    <div className="alert alert-warning py-2 small mb-2">
                      ₹{Math.round(site.free_shipping_above - cart.subTotal).toLocaleString("en-IN")} more and your delivery becomes free.
                    </div>
                  )}

                  <hr />

                  <div className="d-flex justify-content-between mb-3">
                    <span className="fw-bold" style={{ fontSize: "1.05rem" }}>
                      Total
                    </span>
                    <span className="price">₹{Math.round(cart.total).toLocaleString("en-IN")}</span>
                  </div>

                  <Link href="/checkout" className="btn btn-wood btn-lg w-100">
                    Proceed to Checkout →
                  </Link>

                  <p className="small text-muted-wood text-center mt-3 mb-0">Cash on Delivery is available.</p>
                </div>
              </div>

              <div className="panel mt-3">
                <div className="panel-body">
                  <p className="small text-muted-wood mb-2">💬 Something to ask before ordering? Talk to us directly.</p>
                  <a href={`https://wa.me/${site.whatsapp_number}`} target="_blank" rel="noopener noreferrer" className="btn btn-whatsapp btn-sm w-100">
                    Ask on WhatsApp
                  </a>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
