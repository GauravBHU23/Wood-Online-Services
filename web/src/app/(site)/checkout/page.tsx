import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCart } from "@/lib/data/cart";
import * as cashfree from "@/lib/payments/cashfree";
import { CheckoutForm } from "./checkout-form";

export const metadata: Metadata = { title: "Checkout" };

// Ported from Controllers/CheckoutController.cs#Index. [Authorize] in the original -> redirect
// here; the cart-empty redirect happens the same way too.
export default async function CheckoutPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/account/login?returnUrl=/checkout");

  const admin = createAdminClient();
  // Neither query depends on the other's result — fetched in parallel instead of one after
  // another to shave a round trip off this page's load time.
  const [cart, profileResult] = await Promise.all([
    getCart(),
    admin.from("profiles").select("full_name, address, city, state, pin_code").eq("id", user.id).maybeSingle(),
  ]);
  if (cart.isEmpty) redirect("/cart");

  const profile = profileResult.data as {
    full_name: string;
    address: string | null;
    city: string | null;
    state: string | null;
    pin_code: string | null;
  } | null;

  const onlineAvailable = cashfree.isUsable();

  return (
    <CheckoutForm
      cart={cart}
      onlineAvailable={onlineAvailable}
      initialAddress={{
        shippingName: profile?.full_name ?? "",
        shippingPhone: (user.user_metadata?.phone as string | undefined) ?? "",
        shippingAddress: profile?.address ?? "",
        shippingCity: profile?.city ?? "",
        shippingState: profile?.state ?? "",
        shippingPinCode: profile?.pin_code ?? "",
        notes: "",
      }}
    />
  );
}
