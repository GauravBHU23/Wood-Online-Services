import type { Metadata } from "next";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign In" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ returnUrl?: string; sessionExpired?: string }>;
}) {
  const { returnUrl, sessionExpired } = await searchParams;
  return <LoginForm returnUrl={returnUrl} sessionExpired={sessionExpired === "1"} />;
}
