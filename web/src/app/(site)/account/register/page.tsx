import type { Metadata } from "next";
import { RegisterForm } from "./register-form";

export const metadata: Metadata = { title: "Create Account" };

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ returnUrl?: string }>;
}) {
  const { returnUrl } = await searchParams;
  return <RegisterForm returnUrl={returnUrl} />;
}
