"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { loginSchema, type LoginInput } from "@/lib/validation/schemas";
import { adminLoginAction } from "@/lib/auth/admin-actions";
import { Field, inputClass } from "@/components/forms/field";
import { SubmitButton } from "@/components/forms/submit-button";
import { useToast } from "@/components/ui/toast-provider";

// Ported from Areas/Admin/Views/Auth/Login.cshtml.
export function AdminLoginForm({
  returnUrl,
  sessionExpired,
  idleTimeout,
}: {
  returnUrl?: string;
  sessionExpired?: boolean;
  idleTimeout?: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [values, setValues] = useState<LoginInput>({ email: "", password: "" });
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [formError, setFormError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    const parsed = loginSchema.safeParse(values);
    if (!parsed.success) {
      setErrors(parsed.error.flatten().fieldErrors as Record<string, string[]>);
      return;
    }
    setErrors({});

    startTransition(async () => {
      const result = await adminLoginAction(parsed.data);
      if (result.success && result.otpToken) {
        toast.info(result.message ?? "We emailed you a 6-digit code.");
        const params = new URLSearchParams({ token: result.otpToken });
        if (returnUrl) params.set("returnUrl", returnUrl);
        router.push(`/admin/verify-otp?${params.toString()}`);
      } else {
        setFormError(result.message ?? "Could not sign in.");
      }
    });
  }

  return (
    <>
      <div className="panel">
        <div className="panel-header text-center">Admin Sign In</div>
        <div className="panel-body">
          <p className="text-muted-wood small mb-4 text-center">
            This sign-in is for shop administrators only and requires a one-time code sent to your email after your
            password.
          </p>

          <form onSubmit={handleSubmit} noValidate>
            {sessionExpired && !formError && (
              <div className="alert alert-warning py-2 small">
                You have been signed out because this account was signed in on another device.
              </div>
            )}
            {idleTimeout && !sessionExpired && !formError && (
              <div className="alert alert-warning py-2 small">
                You have been signed out after 20 minutes of inactivity, for your security.
              </div>
            )}
            {formError && <div className="alert alert-danger py-2 small">{formError}</div>}

            <Field label="Email" htmlFor="email" error={errors.email?.[0]}>
              <input
                id="email"
                type="email"
                className={inputClass}
                autoComplete="username"
                placeholder="admin@example.com"
                value={values.email}
                onChange={(e) => setValues((v) => ({ ...v, email: e.target.value }))}
              />
            </Field>

            <Field label="Password" htmlFor="password" error={errors.password?.[0]}>
              <input
                id="password"
                type="password"
                className={inputClass}
                autoComplete="current-password"
                value={values.password}
                onChange={(e) => setValues((v) => ({ ...v, password: e.target.value }))}
              />
            </Field>

            <div className="mt-2">
              <SubmitButton pending={pending} pendingText="Signing in...">
                Continue
              </SubmitButton>
            </div>
          </form>
        </div>
      </div>

      <p className="text-center small mt-3" style={{ color: "var(--wood-200,#e5d3c0)" }}>
        Not an admin?{" "}
        <Link href="/account/login" style={{ color: "#fff" }}>
          Customer sign in
        </Link>
      </p>
    </>
  );
}
