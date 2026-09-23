"use client";

import { useFormStatus } from "react-dom";

// Shared by the customer header dropdown and the admin nav dropdown — both submit a plain
// <form action={logoutAction}>, a native Server Action form. useFormStatus reads that ANCESTOR
// form's pending state (it only works when rendered inside the <form> it's reporting on), so this
// needs no props and no local state of its own to show the same is-busy/spinner pattern used
// everywhere else in the app while the sign-out request is in flight.
export function LogoutButton({ className = "dropdown-item" }: { className?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={`${className}${pending ? " is-busy" : ""}`} disabled={pending}>
      {pending && <span className="wos-btn-spinner" aria-hidden="true" />}
      {pending ? "Signing out..." : "Sign Out"}
    </button>
  );
}
