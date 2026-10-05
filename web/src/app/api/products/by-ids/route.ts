import { apiSuccess } from "@/lib/api-response";
import { getProductsByIds } from "@/lib/data/products";

// Backs the "Recently Viewed" strip — the client tracks viewed product IDs in localStorage
// (no account/session needed) and asks for the current product data here, since price/stock/
// availability can change after a product was viewed. Public by design, same as /api/search/
// suggest: it only ever returns products already visible on the catalogue pages.
const MAX_IDS = 20;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const idsParam = url.searchParams.get("ids") ?? "";

  const ids = idsParam
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isInteger(n) && n > 0)
    .slice(0, MAX_IDS);

  if (ids.length === 0) return apiSuccess([]);

  const products = await getProductsByIds(ids);
  return apiSuccess(products);
}
