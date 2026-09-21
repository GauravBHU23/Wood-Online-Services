"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/client";
import { AuthCard } from "@/components/forms/auth-card";
import { Field, inputClass } from "@/components/forms/field";
import { SubmitButton } from "@/components/forms/submit-button";
import { useToast } from "@/components/ui/toast-provider";

// Ported from Views/Account/ResetPassword.cshtml. Supabase's recovery link redirects here with
// the session established via URL hash tokens (handled by the browser client's
// detectSessionInUrl) — auth.updateUser({ password }) then completes the reset, unlike the
// original's ASP.NET Identity token+email pair passed as hidden fields.

const schema = z
  .object({
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "The two passwords do not match.",
    path: ["confirmPassword"],
  });

export function ResetPasswordForm() {
  const router = useRouter();
  const toast = useToast();
  const [ready, setReady] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [values, setValues] = useState({ password: "", confirmPassword: "" });
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
        setReady(true);
        setEmail(session?.user.email ?? null);
      }
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        setReady(true);
        setEmail(data.session.user.email ?? null);
      }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    const parsed = schema.safeParse(values);
    if (!parsed.success) {
      setErrors(parsed.error.flatten().fieldErrors as Record<string, string[]>);
      return;
    }
    setErrors({});
    setPending(true);

    (async () => {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
      setPending(false);

      if (error) {
        setFormError("That reset link has expired or has already been used. Please request a new one.");
        return;
      }

      toast.success("Your password has been reset. Please sign in with your new password.");
      await supabase.auth.signOut();
      router.push("/account/login");
    })();
  }

  if (!ready) {
    return (
      <AuthCard title="Reset Password">
        <p className="text-muted-wood small mb-0">Verifying your reset link...</p>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Choose a new password">
      {email && (
        <p className="text-muted-wood small mb-4">
          Setting a new password for <strong>{email}</strong>.
        </p>
      )}

      <form onSubmit={handleSubmit} noValidate>
        {formError && <div className="alert alert-danger py-2 small">{formError}</div>}

        <Field label="New Password" htmlFor="password" error={errors.password?.[0]}>
          <input
            id="password"
            type="password"
            className={inputClass}
            autoComplete="new-password"
            value={values.password}
            onChange={(e) => setValues((v) => ({ ...v, password: e.target.value }))}
          />
        </Field>

        <Field label="Confirm New Password" htmlFor="confirmPassword" error={errors.confirmPassword?.[0]}>
          <input
            id="confirmPassword"
            type="password"
            className={inputClass}
            autoComplete="new-password"
            value={values.confirmPassword}
            onChange={(e) => setValues((v) => ({ ...v, confirmPassword: e.target.value }))}
          />
        </Field>

        <p className="small text-muted-wood mb-3">Password must be at least 8 characters.</p>

        <SubmitButton pending={pending} pendingText="Updating...">
          Set New Password
        </SubmitButton>
      </form>
    </AuthCard>
  );
}
