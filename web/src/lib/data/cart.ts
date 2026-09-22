import { cookies } from "next/headers";
import { randomUUID } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Product } from "@/lib/data/products";
import type { Database } from "@/types/database";

// Ported from Services/CartService.cs. The cart lives in the DB (cart_items), keyed by
// cart_key = 'user:<uuid>' for signed-in customers or 'guest:<uuid>' for anonymous visitors,
// so it survives logout/device switch and can be merged into the account on sign-in.
//
// Signed-in reads/writes go through the user's own session (RLS: cart_items_owner_all).
// Guest reads/writes have no auth.uid() to scope a policy against, so they go through the
// service-role client instead, same as the .NET app trusted its own server-side CartService.
//
// Every query result below is bound to an explicitly-typed const before any array method
// call (.find/.map/.filter/spread) — chaining those straight off a query's `data` (even via
// `?? []`) makes TypeScript infer the element type as `never` for this postgrest-js version's
// conditional GetResult<> return type. See src/lib/data/products.ts for the same pattern.

export const GUEST_CART_COOKIE = "wos_cart";
const MAX_QUANTITY_PER_ITEM = 50;

type CartItemRow = Database["public"]["Tables"]["cart_items"]["Row"];

export interface CartLine {
  id: number;
  productId: number;
  quantity: number;
  product: Product;
}

export interface CartSummary {
  lines: CartLine[];
  subTotal: number;
  shippingCharge: number;
  total: number;
  itemCount: number;
  isEmpty: boolean;
}

/**
 * Returns the current cart_key WITHOUT writing anything. Safe to call from a Server Component
 * render (e.g. Header on every page) since Next.js forbids setting cookies outside a Server
 * Action/Route Handler. A guest who has no cookie yet simply reads as an empty cart — the cookie
 * gets minted the first time they actually mutate the cart (see getOrCreateCartKey below).
 */
export async function getCartKey(): Promise<{ key: string | null; userId: string | null }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    return { key: `user:${user.id}`, userId: user.id };
  }

  const cookieStore = await cookies();
  const existing = cookieStore.get(GUEST_CART_COOKIE)?.value;
  return { key: existing ? `guest:${existing}` : null, userId: null };
}

/**
 * Same as getCartKey, but creates and persists a fresh guest cookie when one doesn't exist yet.
 * Only call this from a Server Action or Route Handler (cart add/update/remove/read-for-checkout)
 * — never from a Server Component render path, or Next.js throws "Cookies can only be modified
 * in a Server Action or Route Handler".
 */
export async function getOrCreateCartKey(): Promise<{ key: string; userId: string | null }> {
  const { key, userId } = await getCartKey();
  if (key) return { key, userId };

  const cookieStore = await cookies();
  const fresh = randomUUID().replace(/-/g, "");
  cookieStore.set(GUEST_CART_COOKIE, fresh, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
  });
  return { key: `guest:${fresh}`, userId: null };
}

async function clientFor(userId: string | null): Promise<SupabaseClient<Database>> {
  // Signed-in customers use their own session (RLS scoped); guests use the service role
  // since there is no auth.uid() for a guest:<uuid> key to check a policy against.
  return userId ? await createClient() : createAdminClient();
}

async function shippingConfig(): Promise<{ shippingCharge: number; freeShippingAbove: number }> {
  const admin = createAdminClient();
  const result = await admin
    .from("site_settings")
    .select("shipping_charge, free_shipping_above")
    .single();
  const settings = result.data as { shipping_charge: number; free_shipping_above: number } | null;
  return {
    shippingCharge: settings?.shipping_charge ?? 500,
    freeShippingAbove: settings?.free_shipping_above ?? 20000,
  };
}

const EMPTY_CART: CartSummary = {
  lines: [],
  subTotal: 0,
  shippingCharge: 0,
  total: 0,
  itemCount: 0,
  isEmpty: true,
};

export async function getCart(): Promise<CartSummary> {
  const { key, userId } = await getCartKey();
  if (!key) return EMPTY_CART;
  const supabase = await clientFor(userId);

  const result = await supabase
    .from("cart_items")
    .select("id, product_id, quantity, added_at, product:products(*)")
    .eq("cart_key", key)
    .order("added_at");

  type RawRow = { id: number; product_id: number; quantity: number; product: Product | null };
  const rows: RawRow[] = (result.data ?? []) as unknown as RawRow[];

  // Drop anything that went out of stock or became custom-order-only while sitting in the cart.
  const staleIds: number[] = [];
  const fresh: RawRow[] = [];
  for (const r of rows) {
    if (!r.product || r.product.is_custom_order || !r.product.is_available) {
      staleIds.push(r.id);
    } else {
      fresh.push(r);
    }
  }

  if (staleIds.length > 0) {
    await supabase.from("cart_items").delete().in("id", staleIds);
  }

  const lines: CartLine[] = fresh.map((r) => ({
    id: r.id,
    productId: r.product_id,
    quantity: r.quantity,
    product: r.product as Product,
  }));

  const subTotal = lines.reduce((sum, l) => sum + l.product.price * l.quantity, 0);
  const { shippingCharge, freeShippingAbove } = await shippingConfig();
  const shipping = subTotal <= 0 || subTotal >= freeShippingAbove ? 0 : shippingCharge;

  return {
    lines,
    subTotal,
    shippingCharge: shipping,
    total: subTotal + shipping,
    itemCount: lines.reduce((sum, l) => sum + l.quantity, 0),
    isEmpty: lines.length === 0,
  };
}

export async function getCartCount(): Promise<number> {
  const { key, userId } = await getCartKey();
  if (!key) return 0;
  const supabase = await clientFor(userId);
  const result = await supabase.from("cart_items").select("quantity").eq("cart_key", key);
  const rows: Pick<CartItemRow, "quantity">[] = result.data ?? [];
  return rows.reduce((sum, r) => sum + r.quantity, 0);
}

export async function addToCart(productId: number, quantity: number) {
  const qty = Math.max(1, quantity);
  const { key, userId } = await getOrCreateCartKey();
  const supabase = await clientFor(userId);
  const admin = createAdminClient();

  const productResult = await admin.from("products").select("*").eq("id", productId).maybeSingle();
  const product = productResult.data as Product | null;
  if (!product) throw new Error("Product not found.");
  if (product.is_custom_order) {
    throw new Error(
      "This is a custom-order item and cannot be added to the cart. Please send an inquiry."
    );
  }
  if (!product.is_available || product.stock_quantity <= 0) {
    throw new Error("This product is currently out of stock.");
  }

  const existingResult = await supabase
    .from("cart_items")
    .select("id, quantity")
    .eq("cart_key", key)
    .eq("product_id", productId)
    .maybeSingle();
  const existing = existingResult.data as Pick<CartItemRow, "id" | "quantity"> | null;

  const desired = Math.min(
    (existing?.quantity ?? 0) + qty,
    Math.min(product.stock_quantity, MAX_QUANTITY_PER_ITEM)
  );

  if (existing) {
    const patch: Database["public"]["Tables"]["cart_items"]["Update"] = { quantity: desired };
    await supabase.from("cart_items").update(patch).eq("id", existing.id);
  } else {
    const insert: Database["public"]["Tables"]["cart_items"]["Insert"] = {
      cart_key: key,
      product_id: productId,
      quantity: desired,
    };
    await supabase.from("cart_items").insert(insert);
  }
}

export async function updateCartQuantity(productId: number, quantity: number) {
  const { key, userId } = await getOrCreateCartKey();
  const supabase = await clientFor(userId);

  if (quantity < 1) {
    await supabase.from("cart_items").delete().eq("cart_key", key).eq("product_id", productId);
    return;
  }

  const admin = createAdminClient();
  const productResult = await admin
    .from("products")
    .select("stock_quantity")
    .eq("id", productId)
    .maybeSingle();
  const product = productResult.data as Pick<Product, "stock_quantity"> | null;

  const cap = Math.min(product?.stock_quantity ?? MAX_QUANTITY_PER_ITEM, MAX_QUANTITY_PER_ITEM);
  const finalQty = Math.min(quantity, Math.max(cap, 1));

  const patch: Database["public"]["Tables"]["cart_items"]["Update"] = { quantity: finalQty };
  await supabase.from("cart_items").update(patch).eq("cart_key", key).eq("product_id", productId);
}

export async function removeFromCart(productId: number) {
  const { key, userId } = await getOrCreateCartKey();
  const supabase = await clientFor(userId);
  await supabase.from("cart_items").delete().eq("cart_key", key).eq("product_id", productId);
}

export async function clearCart(cartKey: string) {
  const admin = createAdminClient();
  await admin.from("cart_items").delete().eq("cart_key", cartKey);
}

/** On login, fold whatever the guest collected into their account cart. Call right after sign-in. */
export async function mergeGuestCartIntoUser(userId: string) {
  const cookieStore = await cookies();
  const guestId = cookieStore.get(GUEST_CART_COOKIE)?.value;
  if (!guestId) return;

  const admin = createAdminClient();
  const guestKey = `guest:${guestId}`;
  const userKey = `user:${userId}`;

  const guestItemsResult = await admin.from("cart_items").select("*").eq("cart_key", guestKey);
  const guestItems: CartItemRow[] = guestItemsResult.data ?? [];

  if (guestItems.length > 0) {
    const userItemsResult = await admin.from("cart_items").select("*").eq("cart_key", userKey);
    const userItems: CartItemRow[] = userItemsResult.data ?? [];

    for (const g of guestItems) {
      const match = userItems.find((u) => u.product_id === g.product_id);
      if (match) {
        const mergePatch: Database["public"]["Tables"]["cart_items"]["Update"] = {
          quantity: Math.min(match.quantity + g.quantity, MAX_QUANTITY_PER_ITEM),
        };
        await admin.from("cart_items").update(mergePatch).eq("id", match.id);
        await admin.from("cart_items").delete().eq("id", g.id);
      } else {
        const rekeyPatch: Database["public"]["Tables"]["cart_items"]["Update"] = {
          cart_key: userKey,
        };
        await admin.from("cart_items").update(rekeyPatch).eq("id", g.id);
      }
    }
  }

  cookieStore.delete(GUEST_CART_COOKIE);
}
