// Ported from the btn-wood w-100 btn-lg buttons used across Views/Account/*.cshtml.
export function SubmitButton({
  pending,
  children,
  pendingText = "Please wait...",
}: {
  pending: boolean;
  children: React.ReactNode;
  pendingText?: string;
}) {
  return (
    <button type="submit" className={`btn btn-wood w-100 btn-lg${pending ? " is-busy" : ""}`} disabled={pending}>
      {pending && <span className="wos-btn-spinner" aria-hidden="true" />}
      {pending ? pendingText : children}
    </button>
  );
}
