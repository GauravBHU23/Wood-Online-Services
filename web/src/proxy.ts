import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

const PROTECTED_PREFIXES = ["/account", "/checkout", "/orders"];
const ADMIN_PREFIX = "/admin";

export async function proxy(request: NextRequest) {
  const { supabaseResponse, user } = await updateSession(request);
  const path = request.nextUrl.pathname;

  const needsAuth = PROTECTED_PREFIXES.some((p) => path.startsWith(p));
  const needsAdmin = path.startsWith(ADMIN_PREFIX) && path !== "/admin/login";

  if ((needsAuth || needsAdmin) && !user) {
    const redirectTo = needsAdmin ? "/admin/login" : "/account/login";
    const url = request.nextUrl.clone();
    url.pathname = redirectTo;
    url.searchParams.set("returnUrl", path);
    return NextResponse.redirect(url);
  }

  // Role check for /admin/** happens again server-side in the admin layout (via profiles.role) —
  // proxy only gates "is anyone signed in", never authorization, since it cannot cheaply
  // read profiles.role without an extra round trip on every request.

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
