import { apiSuccess } from "@/lib/api-response";
import { createClient } from "@/lib/supabase/server";

// Ported from Controllers/Api/SearchApiController.cs#Suggest. Public by design — it only ever
// returns products that are already visible on the catalogue pages.
const MAX_SUGGESTIONS = 8;

export async function GET(request: Request) {
  const url = new URL(request.url);
  let term = url.searchParams.get("q")?.trim() ?? "";

  if (term.length < 2) return apiSuccess([]);
  if (term.length > 60) term = term.slice(0, 60);

  const escaped = term.replace(/[%_]/g, "\\$&");
  const supabase = await createClient();

  const result = await supabase
    .from("products")
    .select("id, name, category:categories(name), wood_type, price, is_custom_order, average_rating, review_count, image_url")
    .eq("is_available", true)
    .or(`name.ilike.%${escaped}%,wood_type.ilike.%${escaped}%`)
    .order("is_featured", { ascending: false })
    .order("average_rating", { ascending: false })
    .limit(MAX_SUGGESTIONS);

  interface Row {
    id: number;
    name: string;
    category: { name: string } | null;
    wood_type: string | null;
    price: number;
    is_custom_order: boolean;
    average_rating: number;
    review_count: number;
    image_url: string | null;
  }
  const rows: Row[] = (result.data ?? []) as unknown as Row[];

  const results = rows.map((p) => ({
    id: p.id,
    name: p.name,
    category: p.category?.name ?? null,
    woodType: p.wood_type,
    price: p.price,
    isCustomOrder: p.is_custom_order,
    rating: p.average_rating,
    reviewCount: p.review_count,
    image: p.image_url,
  }));

  return apiSuccess(results);
}
