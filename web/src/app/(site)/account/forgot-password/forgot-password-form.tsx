"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { forgotPasswordSchema, type ForgotPasswordInput } from "@/lib/validation/schemas";
import { forgotPasswordAction } from "@/lib/auth/profile-actions";
import { AuthCard } from "@/components/forms/auth-card";
import { Field, inputClass } from "@/components/forms/field";
import { SubmitButton } from "@/components/forms/submit-button";

// Ported from Views/Account/ForgotPassword.cshtml.
export function ForgotPasswordForm() {
  const [pending, startTransition] = useTransition();
  const [values, setValues] = useState<ForgotPasswordInput>({ email: "" });
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    const parsed = forgotPasswordSchema.safeParse(values);
    if (!parsed.success) {
      setErrors(parsed.error.flatten().fieldErrors as Record<string, string[]>);
      return;
    }
    setErrors({});

    startTransition(async () => {
      const result = await forgotPasswordAction(parsed.data);
      if (result.success) {
        setSent(true);
      } else {
        setFormError(result.message ?? "Could not send a reset link.");
      }
    });
  }

  return (
    <AuthCard title="Forgot your password?">
      {sent ? (
        <p className="text-muted-wood small mb-0">
          A password reset link has been sent to your email. Please check your inbox, including the spam folder.
        </p>
      ) : (
        <>
          <p className="text-muted-wood small mb-4">
            Enter the email address on your account and we will send you a link to set a new password. The link
            works once and expires after a short time.
          </p>

          <form onSubmit={handleSubmit} noValidate>
            {formError && <div className="alert alert-danger py-2 small">{formError}</div>}

            <Field label="Email" htmlFor="email" error={errors.email?.[0]}>
              <input
                id="email"
                type="email"
                className={inputClass}
                autoComplete="username"
                placeholder="you@example.com"
                value={values.email}
                onChange={(e) => setValues({ email: e.target.value })}
              />
            </Field>

            <SubmitButton pending={pending} pendingText="Sending...">
              Send Reset Link
            </SubmitButton>
          </form>

          <hr className="my-4" />

          <p className="text-center mb-0 small">
            Remembered it?{" "}
            <Link href="/account/login" className="fw-bold">
              Back to sign in
            </Link>
          </p>
        </>
      )}
    </AuthCard>
  );
}
