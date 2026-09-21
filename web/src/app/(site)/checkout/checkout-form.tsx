"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { checkoutSchema, type CheckoutInput } from "@/lib/validation/schemas";
import { placeOrderAction } from "@/lib/payments/actions";
import { useToast } from "@/components/ui/toast-provider";
import type { CartSummary } from "@/lib/data/cart";

// Ported from Views/Checkout/Index.cshtml.
export function CheckoutForm({
  cart,
  onlineAvailable,
  initialAddress,
}: {
  cart: CartSummary;
  onlineAvailable: boolean;
  initialAddress: Omit<CheckoutInput, "paymentMethod">;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [values, setValues] = useState<CheckoutInput>({
    ...initialAddress,
    paymentMethod: onlineAvailable ? "online" : "cod",
  });
  const [saveAddress, setSaveAddress] = useState(true);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [formError, setFormError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    const parsed = checkoutSchema.safeParse(values);
    if (!parsed.success) {
      setErrors(parsed.error.flatten().fieldErrors as Record<string, string[]>);
      return;
    }
    setErrors({});

    startTransition(async () => {
      const result = await placeOrderAction(parsed.data, saveAddress);
      if (result.success && result.redirectTo) {
        toast.success("Your order has been placed successfully.");
        router.push(result.redirectTo);
      } else if (result.redirectTo) {
        // Order saved but payment failed to start — route to the order page with the message.
        toast.error(result.message ?? "Could not start the payment.");
        router.push(result.redirectTo);
      } else {
        setFormError(result.message ?? "Could not place your order.");
      }
    });
  }

  return (
    <>
      <div className="bg-wood-50 border-bottom border-wood py-4">
        <div className="container">
          <h1 className="mb-0">Checkout</h1>
        </div>
      </div>

      <div className="container py-4">
        <div className="steps">
          <div className="step done">1. Cart</div>
          <div className="step active">2. Address &amp; Payment</div>
          <div className="step">3. Confirmation</div>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          <div className="row g-4">
            <div className="col-lg-7">
              <div className="panel mb-3">
                <div className="panel-header">Delivery Address</div>
                <div className="panel-body">
                  {formError && <div className="alert alert-danger py-2 small">{formError}</div>}

                  <div className="row g-3">
                    <div className="col-md-6">
                      <label className="form-label">
                        Full Name <span className="text-danger">*</span>
                      </label>
                      <input
                        className="form-control"
                        autoComplete="name"
                        value={values.shippingName}
                        onChange={(e) => setValues((v) => ({ ...v, shippingName: e.target.value }))}
                      />
                      {errors.shippingName?.[0] && <span className="field-error d-block">{errors.shippingName[0]}</span>}
                    </div>

                    <div className="col-md-6">
                      <label className="form-label">
                        Phone Number <span className="text-danger">*</span>
                      </label>
                      <input
                        className="form-control"
                        type="tel"
                        autoComplete="tel"
                        value={values.shippingPhone}
                        onChange={(e) => setValues((v) => ({ ...v, shippingPhone: e.target.value }))}
                      />
                      {errors.shippingPhone?.[0] && <span className="field-error d-block">{errors.shippingPhone[0]}</span>}
                    </div>

                    <div className="col-12">
                      <label className="form-label">
                        Address <span className="text-danger">*</span>
                      </label>
                      <textarea
                        rows={2}
                        className="form-control"
                        placeholder="House or flat number, street, area, landmark"
                        value={values.shippingAddress}
                        onChange={(e) => setValues((v) => ({ ...v, shippingAddress: e.target.value }))}
                      />
                      {errors.shippingAddress?.[0] && <span className="field-error d-block">{errors.shippingAddress[0]}</span>}
                    </div>

                    <div className="col-md-5">
                      <label className="form-label">
                        City <span className="text-danger">*</span>
                      </label>
                      <input
                        className="form-control"
                        autoComplete="address-level2"
                        value={values.shippingCity}
                        onChange={(e) => setValues((v) => ({ ...v, shippingCity: e.target.value }))}
                      />
                      {errors.shippingCity?.[0] && <span className="field-error d-block">{errors.shippingCity[0]}</span>}
                    </div>

                    <div className="col-md-4">
                      <label className="form-label">
                        State <span className="text-danger">*</span>
                      </label>
                      <input
                        className="form-control"
                        autoComplete="address-level1"
                        value={values.shippingState}
                        onChange={(e) => setValues((v) => ({ ...v, shippingState: e.target.value }))}
                      />
                      {errors.shippingState?.[0] && <span className="field-error d-block">{errors.shippingState[0]}</span>}
                    </div>

                    <div className="col-md-3">
                      <label className="form-label">
                        PIN Code <span className="text-danger">*</span>
                      </label>
                      <input
                        className="form-control"
                        inputMode="numeric"
                        maxLength={6}
                        autoComplete="postal-code"
                        value={values.shippingPinCode}
                        onChange={(e) => setValues((v) => ({ ...v, shippingPinCode: e.target.value }))}
                      />
                      {errors.shippingPinCode?.[0] && <span className="field-error d-block">{errors.shippingPinCode[0]}</span>}
                    </div>

                    <div className="col-12">
                      <label className="form-label">Delivery Notes (optional)</label>
                      <textarea
                        rows={2}
                        className="form-control"
                        maxLength={500}
                        placeholder="Any specific delivery time or directions, please write them here"
                        value={values.notes}
                        onChange={(e) => setValues((v) => ({ ...v, notes: e.target.value }))}
                      />
                    </div>

                    <div className="col-12">
                      <div className="form-check">
                        <input
                          type="checkbox"
                          id="saveAddress"
                          className="form-check-input"
                          checked={saveAddress}
                          onChange={(e) => setSaveAddress(e.target.checked)}
                        />
                        <label htmlFor="saveAddress" className="form-check-label">
                          Save this address to my profile
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="panel">
                <div className="panel-header">Payment Method</div>
                <div className="panel-body">
                  {onlineAvailable && (
                    <label className={`pay-option${values.paymentMethod === "online" ? " is-selected" : ""}`}>
                      <input
                        className="form-check-input"
                        type="radio"
                        name="paymentMethod"
                        checked={values.paymentMethod === "online"}
                        onChange={() => setValues((v) => ({ ...v, paymentMethod: "online" }))}
                      />
                      <span className="pay-option__title">Pay Online</span>
                      <div className="pay-option__hint">
                        Pay securely using UPI, credit card, debit card, net banking or a wallet. You will be
                        redirected to our payment partner to complete the payment.
                      </div>
                      <div className="pay-methods">
                        <span className="pay-chip">UPI</span>
                        <span className="pay-chip">Credit Card</span>
                        <span className="pay-chip">Debit Card</span>
                        <span className="pay-chip">Net Banking</span>
                        <span className="pay-chip">Wallets</span>
                      </div>
                    </label>
                  )}

                  {!onlineAvailable && (
                    <div className="pay-option" style={{ opacity: 0.65, cursor: "default" }}>
                      <span className="pay-option__title">Pay Online (UPI / Card / Net Banking)</span>
                      <div className="pay-option__hint">
                        Online payment is not available right now. Please use Cash on Delivery, or contact us and we
                        will arrange a payment link for you.
                      </div>
                      <div className="pay-methods">
                        <span className="pay-chip">UPI</span>
                        <span className="pay-chip">Credit Card</span>
                        <span className="pay-chip">Debit Card</span>
                        <span className="pay-chip">Net Banking</span>
                        <span className="pay-chip">Wallets</span>
                      </div>
                    </div>
                  )}

                  <label className={`pay-option${values.paymentMethod === "cod" ? " is-selected" : ""}`}>
                    <input
                      className="form-check-input"
                      type="radio"
                      name="paymentMethod"
                      checked={values.paymentMethod === "cod"}
                      onChange={() => setValues((v) => ({ ...v, paymentMethod: "cod" }))}
                    />
                    <span className="pay-option__title">Cash on Delivery</span>
                    <div className="pay-option__hint">
                      Pay in cash when the furniture reaches your home. For large orders we call to confirm first.
                    </div>
                  </label>

                  <div className="secure-note">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                      <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z" />
                    </svg>
                    <span>Your payment is processed on a secure gateway. We never see or store your card details.</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="col-lg-5">
              <div className="panel" style={{ position: "sticky", top: "1rem" }}>
                <div className="panel-header">Your Order</div>
                <div className="panel-body">
                  {cart.lines.map((line) => (
                    <div key={line.id} className="d-flex gap-2 mb-3 pb-3 border-bottom">
                      <img
                        src={line.product.image_url || "/img/cat-custom.svg"}
                        alt=""
                        style={{ width: 64, height: 52, objectFit: "cover", borderRadius: 6, border: "1px solid var(--line)" }}
                        loading="lazy"
                      />
                      <div className="flex-grow-1">
                        <div className="fw-bold" style={{ fontSize: ".92rem", lineHeight: 1.3 }}>
                          {line.product.name}
                        </div>
                        <div className="small text-muted-wood">
                          ₹{Math.round(line.product.price).toLocaleString("en-IN")} &times; {line.quantity}
                        </div>
                      </div>
                      <div className="fw-bold text-nowrap">₹{Math.round(line.product.price * line.quantity).toLocaleString("en-IN")}</div>
                    </div>
                  ))}

                  <div className="d-flex justify-content-between mb-2">
                    <span>Subtotal</span>
                    <span>₹{Math.round(cart.subTotal).toLocaleString("en-IN")}</span>
                  </div>

                  <div className="d-flex justify-content-between mb-2">
                    <span>Delivery</span>
                    {cart.shippingCharge <= 0 ? (
                      <span className="text-success fw-bold">Free</span>
                    ) : (
                      <span>₹{Math.round(cart.shippingCharge).toLocaleString("en-IN")}</span>
                    )}
                  </div>

                  <hr />

                  <div className="d-flex justify-content-between mb-3">
                    <span className="fw-bold" style={{ fontSize: "1.05rem" }}>
                      Total
                    </span>
                    <span className="price">₹{Math.round(cart.total).toLocaleString("en-IN")}</span>
                  </div>

                  <button type="submit" className={`btn btn-wood btn-lg w-100${pending ? " is-busy" : ""}`} disabled={pending}>
                    {pending && <span className="wos-btn-spinner" aria-hidden="true" />}
                    {pending ? "Processing your order..." : "Place Order"}
                  </button>

                  <p className="small text-muted-wood text-center mt-3 mb-0">
                    After you place the order we will call you to confirm it.
                  </p>
                </div>
              </div>

              <Link href="/cart" className="btn btn-outline-wood w-100 mt-3">
                Back to Cart
              </Link>
            </div>
          </div>
        </form>
      </div>
    </>
  );
}
