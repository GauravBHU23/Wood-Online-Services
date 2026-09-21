"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { changePasswordSchema, type ChangePasswordInput } from "@/lib/validation/schemas";
import { changePasswordAction } from "@/lib/auth/profile-actions";
import { AuthCard } from "@/components/forms/auth-card";
import { Field, inputClass } from "@/components/forms/field";
import { useToast } from "@/components/ui/toast-provider";

// Ported from Views/Account/ChangePassword.cshtml.
export function ChangePasswordForm() {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [values, setValues] = useState<ChangePasswordInput>({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [formError, setFormError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    const parsed = changePasswordSchema.safeParse(values);
    if (!parsed.success) {
      setErrors(parsed.error.flatten().fieldErrors as Record<string, string[]>);
      return;
    }
    setErrors({});

    startTransition(async () => {
      const result = await changePasswordAction(parsed.data);
      if (result.success) {
        toast.success(result.message ?? "Your password has been changed.");
        router.push(result.redirectToAdminDashboard ? "/admin" : "/account/profile");
        router.refresh();
      } else {
        setFormError(result.message ?? "Could not change your password.");
      }
    });
  }

  return (
    <AuthCard title="Change Password">
      <form onSubmit={handleSubmit} noValidate>
        {formError && <div className="alert alert-danger py-2 small">{formError}</div>}

        <Field label="Current Password" htmlFor="currentPassword" error={errors.currentPassword?.[0]}>
          <input
            id="currentPassword"
            type="password"
            className={inputClass}
            autoComplete="current-password"
            value={values.currentPassword}
            onChange={(e) => setValues((v) => ({ ...v, currentPassword: e.target.value }))}
          />
        </Field>

        <Field label="New Password" htmlFor="newPassword" error={errors.newPassword?.[0]}>
          <input
            id="newPassword"
            type="password"
            className={inputClass}
            autoComplete="new-password"
            value={values.newPassword}
            onChange={(e) => setValues((v) => ({ ...v, newPassword: e.target.value }))}
          />
        </Field>

        <Field label="Confirm Password" htmlFor="confirmPassword" error={errors.confirmPassword?.[0]}>
          <input
            id="confirmPassword"
            type="password"
            className={inputClass}
            autoComplete="new-password"
            value={values.confirmPassword}
            onChange={(e) => setValues((v) => ({ ...v, confirmPassword: e.target.value }))}
          />
        </Field>

        <div className="d-flex gap-2">
          <button type="submit" className={`btn btn-wood${pending ? " is-busy" : ""}`} disabled={pending}>
            {pending && <span className="wos-btn-spinner" aria-hidden="true" />}
            {pending ? "Updating..." : "Change Password"}
          </button>
          <Link href="/account/profile" className="btn btn-outline-wood">
            Back
          </Link>
        </div>
      </form>
    </AuthCard>
  );
}
