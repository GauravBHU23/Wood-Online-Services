"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { registerSchema, type RegisterInput } from "@/lib/validation/schemas";
import { registerAction } from "@/lib/auth/actions";
import { AuthCard } from "@/components/forms/auth-card";
import { Field, inputClass } from "@/components/forms/field";
import { SubmitButton } from "@/components/forms/submit-button";
import { useToast } from "@/components/ui/toast-provider";

// Ported from Views/Account/Register.cshtml.
export function RegisterForm({ returnUrl }: { returnUrl?: string }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [values, setValues] = useState<RegisterInput>({
    fullName: "",
    email: "",
    phoneNumber: "",
    password: "",
    confirmPassword: "",
  });
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [formError, setFormError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    const parsed = registerSchema.safeParse(values);
    if (!parsed.success) {
      setErrors(parsed.error.flatten().fieldErrors as Record<string, string[]>);
      return;
    }
    setErrors({});

    startTransition(async () => {
      const result = await registerAction(parsed.data);
      if (result.success) {
        toast.success(result.message ?? "Your account is ready.");
        router.push(returnUrl || "/");
        router.refresh();
      } else {
        setFormError(result.message ?? "Could not create your account.");
        if (result.fieldErrors) setErrors(result.fieldErrors);
      }
    });
  }

  const loginHref = `/account/login${returnUrl ? `?returnUrl=${encodeURIComponent(returnUrl)}` : ""}`;

  return (
    <AuthCard title="Create an account" colClass="col-md-8 col-lg-6">
      <form onSubmit={handleSubmit} noValidate>
        {formError && <div className="alert alert-danger py-2 small">{formError}</div>}

        <Field label="Full Name" htmlFor="fullName" required error={errors.fullName?.[0]}>
          <input
            id="fullName"
            className={inputClass}
            autoComplete="name"
            placeholder="Your full name"
            value={values.fullName}
            onChange={(e) => setValues((v) => ({ ...v, fullName: e.target.value }))}
          />
        </Field>

        <div className="row g-3">
          <div className="col-md-6 mb-1">
            <Field label="Email" htmlFor="email" required error={errors.email?.[0]} className="">
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
          </div>

          <div className="col-md-6 mb-1">
            <Field label="Phone Number" htmlFor="phoneNumber" required error={errors.phoneNumber?.[0]} className="">
              <input
                id="phoneNumber"
                type="tel"
                className={inputClass}
                autoComplete="tel"
                placeholder="98765 43210"
                maxLength={10}
                value={values.phoneNumber}
                onChange={(e) => setValues((v) => ({ ...v, phoneNumber: e.target.value }))}
              />
            </Field>
          </div>
        </div>

        <div className="row g-3 mt-1">
          <div className="col-md-6 mb-1">
            <Field label="Password" htmlFor="password" required error={errors.password?.[0]} className="">
              <input
                id="password"
                type="password"
                className={inputClass}
                autoComplete="new-password"
                value={values.password}
                onChange={(e) => setValues((v) => ({ ...v, password: e.target.value }))}
              />
            </Field>
          </div>

          <div className="col-md-6 mb-1">
            <Field label="Confirm Password" htmlFor="confirmPassword" required error={errors.confirmPassword?.[0]} className="">
              <input
                id="confirmPassword"
                type="password"
                className={inputClass}
                autoComplete="new-password"
                value={values.confirmPassword}
                onChange={(e) => setValues((v) => ({ ...v, confirmPassword: e.target.value }))}
              />
            </Field>
          </div>
        </div>

        <p className="small text-muted-wood mt-2 mb-3">Password must be at least 8 characters.</p>

        <SubmitButton pending={pending} pendingText="Creating your account...">
          Create Account
        </SubmitButton>
      </form>

      <hr className="my-4" />

      <p className="text-center mb-0 small">
        Already have an account?{" "}
        <Link href={loginHref} className="fw-bold">
          Sign In
        </Link>
      </p>
    </AuthCard>
  );
}
