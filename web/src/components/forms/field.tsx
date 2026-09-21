import type { ReactNode } from "react";

// Ported from the .mb-3 / .form-label / .field-validation-error pattern used throughout
// Views/Account/*.cshtml, Views/Checkout/*.cshtml etc.
export function Field({
  label,
  htmlFor,
  error,
  required,
  className = "mb-3",
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  required?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={className}>
      <label htmlFor={htmlFor} className="form-label">
        {label}
      </label>{" "}
      {required && <span className="text-danger">*</span>}
      {children}
      {error && (
        <span className="field-validation-error" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}

export const inputClass = "form-control";
