import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { VerifyOtpForm } from "./verify-otp-form";

export const metadata: Metadata = { title: "Verify Code" };

export default async function VerifyOtpPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; returnUrl?: string }>;
}) {
  const { token, returnUrl } = await searchParams;
  if (!token) redirect("/admin/login");

  return <VerifyOtpForm token={token} returnUrl={returnUrl} />;
}
