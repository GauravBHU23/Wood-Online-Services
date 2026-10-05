"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";

// Ported from wwwroot/js/notify.js's confirmDialog() — same classes (.wos-modal-overlay, .wos-modal).

interface ConfirmOptions {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "default" | "danger";
}

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm must be used within ConfirmProvider");
  return ctx;
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ options: ConfirmOptions; resolve: (v: boolean) => void } | null>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const lastFocused = useRef<HTMLElement | null>(null);

  const confirm = useCallback<ConfirmFn>((options) => {
    lastFocused.current = document.activeElement as HTMLElement | null;
    return new Promise((resolve) => {
      setState({ options, resolve });
    });
  }, []);

  function handle(result: boolean) {
    state?.resolve(result);
    setState(null);
    lastFocused.current?.focus();
  }

  // Focuses the cancel button on open (the safer default action) and traps Tab/Shift+Tab
  // between the two buttons so keyboard focus can't escape behind the overlay. Escape cancels,
  // matching the click-outside-to-dismiss convention the overlay already implies visually.
  useEffect(() => {
    if (!state) return;
    cancelRef.current?.focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        handle(false);
        return;
      }
      if (e.key !== "Tab") return;
      const focusables = [cancelRef.current, confirmRef.current].filter((el): el is HTMLButtonElement => !!el);
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {state && (
        <div className="wos-modal-overlay is-visible" role="dialog" aria-modal="true" aria-labelledby="wos-modal-title">
          <div className={`wos-modal wos-modal--${state.options.tone === "danger" ? "danger" : "default"}`}>
            <h2 className="wos-modal__title" id="wos-modal-title">
              {state.options.title ?? "Confirm"}
            </h2>
            <p className="wos-modal__message">{state.options.message}</p>
            <div className="wos-modal__actions">
              <button ref={cancelRef} type="button" className="btn btn-outline-wood" onClick={() => handle(false)}>
                {state.options.cancelLabel ?? "Cancel"}
              </button>
              <button
                ref={confirmRef}
                type="button"
                className={`btn ${state.options.tone === "danger" ? "btn-danger" : "btn-wood"}`}
                onClick={() => handle(true)}
              >
                {state.options.confirmLabel ?? "OK"}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}
