import type { Metadata } from "next";
import { AdminLoginForm } from "./admin-login-form";

export const metadata: Metadata = { title: "Admin Sign In" };

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ returnUrl?: string; sessionExpired?: string; reason?: string }>;
}) {
  const { returnUrl, sessionExpired, reason } = await searchParams;
  return (
    <AdminLoginForm
      returnUrl={returnUrl}
      sessionExpired={sessionExpired === "1"}
      idleTimeout={reason === "idle"}
    />
  );
}
