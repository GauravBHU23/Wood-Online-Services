import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { invalidateAllSessions } from "@/lib/auth/session";
import type { OrderWithItems } from "@/lib/data/orders";

// Ported from Areas/Admin/Controllers/UsersController.cs. "Blocked" reuses Supabase Auth's own
// ban mechanism (updateUserById({ ban_duration })) — set far in the future it stops future
// sign-ins/token-refreshes exactly like a lockout does. That alone doesn't cut an ALREADY-active
// session immediately though (their current access token stays valid until it naturally
// expires), so blockUser() also rotates profiles.current_session_id — see lib/auth/session.ts —
// which src/proxy.ts checks on every request, rejecting the blocked user's session on its very
// next request. Ported from UsersController.cs:155's same force-logout-other-devices behavior.

export interface UserListItem {
  userId: string;
  fullName: string;
  email: string;
  phoneNumber: string | null;
  city: string | null;
  state: string | null;
  createdDate: string;
  isAdmin: boolean;
  isBlocked: boolean;
  orderCount: number;
  totalSpend: number;
}

export interface AdminUserListResult {
  items: UserListItem[];
  totalCount: number;
  page: number;
  pageSize: number;
  blockedCount: number;
}

const PAGE_SIZE = 25;

export async function getAdminUsers(filters: { search?: string; filter?: string; page?: number }): Promise<AdminUserListResult> {
  const admin = createAdminClient();
  const page = Math.max(1, filters.page ?? 1);

  // Supabase Auth's admin API paginates users itself; profiles carries the app-specific fields.
  // For a directory of this scale, listUsers with a generous perPage then filtering in memory
  // (same approach the original used for its lockout-end/blocked comparisons) is simplest.
  const usersResult = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const authUsers = usersResult.data.users;

  const profilesResult = await admin.from("profiles").select("id, full_name, address, city, state, role, created_at");
  const profiles = new Map((profilesResult.data ?? []).map((p) => [p.id, p]));

  let combined = authUsers.map((u) => {
    const profile = profiles.get(u.id);
    const isBlocked = !!u.banned_until && new Date(u.banned_until) > new Date();
    return {
      userId: u.id,
      fullName: profile?.full_name || "",
      email: u.email ?? "",
      phoneNumber: (u.user_metadata?.phone as string | undefined) ?? null,
      city: profile?.city ?? null,
      state: profile?.state ?? null,
      createdDate: profile?.created_at ?? u.created_at,
      isAdmin: profile?.role === "admin",
      isBlocked,
    };
  });

  if (filters.search?.trim()) {
    const term = filters.search.trim().toLowerCase();
    combined = combined.filter(
      (u) => u.fullName.toLowerCase().includes(term) || u.email.toLowerCase().includes(term) || (u.phoneNumber ?? "").includes(term)
    );
  }

  const blockedCount = combined.filter((u) => u.isBlocked).length;

  if (filters.filter === "blocked") {
    combined = combined.filter((u) => u.isBlocked);
  }

  combined.sort((a, b) => new Date(b.createdDate).getTime() - new Date(a.createdDate).getTime());

  const totalCount = combined.length;
  const from = (page - 1) * PAGE_SIZE;
  const pageItems = combined.slice(from, from + PAGE_SIZE);

  // Order totals pulled in one pass rather than per-row.
  const userIds = pageItems.map((u) => u.userId);
  const ordersResult = await admin.from("orders").select("user_id, total_amount, order_status").in("user_id", userIds.length > 0 ? userIds : ["00000000-0000-0000-0000-000000000000"]);
  const orderRows: { user_id: string; total_amount: number; order_status: string }[] = ordersResult.data ?? [];

  const items: UserListItem[] = pageItems.map((u) => {
    const userOrders = orderRows.filter((o) => o.user_id === u.userId && o.order_status !== "cancelled");
    return {
      ...u,
      orderCount: userOrders.length,
      totalSpend: userOrders.reduce((sum, o) => sum + o.total_amount, 0),
    };
  });

  return { items, totalCount, page, pageSize: PAGE_SIZE, blockedCount };
}

export interface UserDetail {
  userId: string;
  fullName: string;
  email: string;
  phoneNumber: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  pinCode: string | null;
  createdDate: string;
  isAdmin: boolean;
  isBlocked: boolean;
  orders: OrderWithItems[];
}

export async function getAdminUserById(id: string): Promise<UserDetail | null> {
  const admin = createAdminClient();
  const userResult = await admin.auth.admin.getUserById(id);
  if (!userResult.data.user) return null;

  const profileResult = await admin.from("profiles").select("*").eq("id", id).maybeSingle();
  const profile = profileResult.data;

  const ordersResult = await admin.from("orders").select("*, items:order_items(*)").eq("user_id", id).order("order_date", { ascending: false });

  const u = userResult.data.user;
  const isBlocked = !!u.banned_until && new Date(u.banned_until) > new Date();

  return {
    userId: id,
    fullName: profile?.full_name ?? "",
    email: u.email ?? "",
    phoneNumber: (u.user_metadata?.phone as string | undefined) ?? null,
    address: profile?.address ?? null,
    city: profile?.city ?? null,
    state: profile?.state ?? null,
    pinCode: profile?.pin_code ?? null,
    createdDate: profile?.created_at ?? u.created_at,
    isAdmin: profile?.role === "admin",
    isBlocked,
    orders: (ordersResult.data ?? []) as unknown as OrderWithItems[],
  };
}

const BLOCKED_DURATION = "876000h"; // ~100 years — effectively forever without literally being infinite.

export async function blockUser(id: string): Promise<{ success: boolean; message: string; fullName?: string }> {
  const admin = createAdminClient();
  const profileResult = await admin.from("profiles").select("full_name, role").eq("id", id).maybeSingle();
  const profile = profileResult.data as { full_name: string; role: "customer" | "admin" } | null;

  if (profile?.role === "admin") {
    return { success: false, message: "Admin accounts cannot be blocked from here." };
  }

  const { error } = await admin.auth.admin.updateUserById(id, { ban_duration: BLOCKED_DURATION });
  if (error) return { success: false, message: "Could not block this customer." };

  await invalidateAllSessions(id);

  return { success: true, message: `${profile?.full_name ?? "Customer"} has been blocked.`, fullName: profile?.full_name };
}

export async function unblockUser(id: string): Promise<{ success: boolean; message: string }> {
  const admin = createAdminClient();
  const profileResult = await admin.from("profiles").select("full_name").eq("id", id).maybeSingle();
  const profile = profileResult.data as { full_name: string } | null;

  const { error } = await admin.auth.admin.updateUserById(id, { ban_duration: "none" });
  if (error) return { success: false, message: "Could not unblock this customer." };

  return { success: true, message: `${profile?.full_name ?? "Customer"} has been unblocked.` };
}
