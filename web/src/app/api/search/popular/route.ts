import { apiSuccess } from "@/lib/api-response";
import { createClient } from "@/lib/supabase/server";

// Ported from Controllers/Api/SearchApiController.cs#Popular.
export async function GET() {
  const supabase = await createClient();
  const result = await supabase
    .from("categories")
    .select("id, name")
    .eq("is_active", true)
    .order("display_order")
    .limit(6);

  const rows: { id: number; name: string }[] = result.data ?? [];
  return apiSuccess(rows);
}
