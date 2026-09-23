"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { loginSchema, type LoginInput } from "@/lib/validation/schemas";
import { loginAction } from "@/lib/auth/actions";
import { AuthCard } from "@/components/forms/auth-card";
import { Field, inputClass } from "@/components/forms/field";
import { SubmitButton } from "@/components/forms/submit-button";
import { useToast } from "@/components/ui/toast-provider";

// Ported from Views/Account/Login.cshtml.
export function LoginForm({
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
  const [values, setValues] = useState<LoginInput>({ email: "", password: "", rememberMe: true });
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
      const result = await loginAction(parsed.data);
      if (result.success) {
        toast.success(result.message ?? "Welcome back!");
        if (result.message?.includes("must set a new password")) {
          router.push("/account/change-password");
        } else {
          router.push(returnUrl || "/");
        }
        router.refresh();
      } else {
        setFormError(result.message ?? "Could not sign in.");
      }
    });
  }

  const registerHref = `/account/register${returnUrl ? `?returnUrl=${encodeURIComponent(returnUrl)}` : ""}`;

  return (
    <>
      <AuthCard title="Sign In">
        <form onSubmit={handleSubmit} noValidate>
          {sessionExpired && !formError && (
            <div className="alert alert-warning py-2 small">
              You have been signed out because your account was signed in on another device.
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
              placeholder="you@example.com"
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

          <div className="d-flex justify-content-end mb-2">
            <Link href="/account/forgot-password" className="small">
              Forgot password?
            </Link>
          </div>

          <div className="form-check mb-3">
            <input
              id="rememberMe"
              type="checkbox"
              className="form-check-input"
              checked={values.rememberMe}
              onChange={(e) => setValues((v) => ({ ...v, rememberMe: e.target.checked }))}
            />
            <label htmlFor="rememberMe" className="form-check-label">
              Remember me
            </label>
          </div>

          <SubmitButton pending={pending} pendingText="Signing in...">
            Sign In
          </SubmitButton>
        </form>

        <hr className="my-4" />

        <p className="text-center mb-0 small">
          Do not have an account?{" "}
          <Link href={registerHref} className="fw-bold">
            Create an account
          </Link>
        </p>
      </AuthCard>

      <p className="text-center small text-muted-wood mt-3">
        You can browse products and send inquiries without an account. An account is only needed to place an order.
      </p>
    </>
  );
}
