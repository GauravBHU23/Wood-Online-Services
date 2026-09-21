"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { verifyOtpSchema } from "@/lib/validation/schemas";
import { adminVerifyOtpAction, adminResendOtpAction } from "@/lib/auth/admin-actions";
import { Field, inputClass } from "@/components/forms/field";
import { SubmitButton } from "@/components/forms/submit-button";
import { useToast } from "@/components/ui/toast-provider";

const COOLDOWN_SECONDS = 180;

// Ported from Areas/Admin/Views/Auth/VerifyOtp.cshtml, including the resend countdown script.
export function VerifyOtpForm({ token: initialToken, returnUrl }: { token: string; returnUrl?: string }) {
  const router = useRouter();
  const toast = useToast();
  const [token, setToken] = useState(initialToken);
  const [code, setCode] = useState("");
  const [pending, setPending] = useState(false);
  const [resending, setResending] = useState(false);
  const [remaining, setRemaining] = useState(COOLDOWN_SECONDS);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Only arms the ticking interval; setting `remaining` itself happens in the caller (either
  // useState's initializer on mount, or the resend handler's event-driven update) so this never
  // calls setState synchronously from inside an effect body.
  const armCountdown = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  function startCountdown(seconds: number) {
    setRemaining(seconds);
    armCountdown();
  }

  useEffect(() => {
    armCountdown();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [armCountdown]);

  function formatTime(sec: number) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `(${m}:${s < 10 ? "0" : ""}${s})`;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setFieldError(null);

    const parsed = verifyOtpSchema.safeParse({ token, code });
    if (!parsed.success) {
      setFieldError(parsed.error.issues[0]?.message ?? "Please enter the 6-digit code.");
      return;
    }

    setPending(true);
    (async () => {
      const result = await adminVerifyOtpAction(parsed.data);
      setPending(false);

      if (result.success) {
        toast.success(result.message ?? "Welcome back!");
        if (result.message?.includes("must set a new password")) {
          router.push("/account/change-password");
        } else if (returnUrl) {
          router.push(returnUrl);
        } else {
          router.push("/admin");
        }
        router.refresh();
      } else {
        setFormError(result.message ?? "Could not verify that code.");
      }
    })();
  }

  async function handleResend() {
    setResending(true);
    try {
      const result = await adminResendOtpAction(token);
      if (result.success && result.newToken) {
        setToken(result.newToken);
        toast.success("A new code has been sent to your email.");
        startCountdown(COOLDOWN_SECONDS);
      } else if (result.secondsUntilAllowed > 0) {
        startCountdown(result.secondsUntilAllowed);
      } else {
        toast.error("Could not resend the code. Please sign in again.");
      }
    } finally {
      setResending(false);
    }
  }

  return (
    <>
      <div className="panel">
        <div className="panel-header text-center">Verify Your Sign-In</div>
        <div className="panel-body">
          <p className="text-muted-wood small mb-4 text-center">
            We emailed a 6-digit code to your admin account&apos;s email address. Enter it below to finish signing
            in. It expires in 10 minutes.
          </p>

          <form onSubmit={handleSubmit} noValidate>
            {formError && <div className="alert alert-danger py-2 small">{formError}</div>}

            <Field label="6-digit code" htmlFor="code" error={fieldError ?? undefined}>
              <input
                id="code"
                className={`${inputClass} form-control-lg text-center`}
                type="text"
                inputMode="numeric"
                pattern="\d{6}"
                maxLength={6}
                autoComplete="one-time-code"
                autoFocus
                style={{ letterSpacing: ".5em", fontSize: "1.4rem" }}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              />
            </Field>

            <SubmitButton pending={pending} pendingText="Verifying...">
              Verify &amp; Sign In
            </SubmitButton>
          </form>

          <div className="text-center mt-3">
            <button type="button" className="btn btn-outline-wood btn-sm" disabled={remaining > 0 || resending} onClick={handleResend}>
              Resend code {remaining > 0 && <span>{formatTime(remaining)}</span>}
            </button>
          </div>
        </div>
      </div>

      <p className="text-center small mt-3" style={{ color: "var(--wood-200,#e5d3c0)" }}>
        Code not arriving?{" "}
        <Link href="/admin/login" style={{ color: "#fff" }}>
          Start over
        </Link>{" "}
        to get a new one.
      </p>
    </>
  );
}
