"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

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

  const confirm = useCallback<ConfirmFn>((options) => {
    return new Promise((resolve) => {
      setState({ options, resolve });
    });
  }, []);

  function handle(result: boolean) {
    state?.resolve(result);
    setState(null);
  }

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {state && (
        <div className="wos-modal-overlay is-visible" role="dialog" aria-modal="true">
          <div className={`wos-modal wos-modal--${state.options.tone === "danger" ? "danger" : "default"}`}>
            <h2 className="wos-modal__title">{state.options.title ?? "Confirm"}</h2>
            <p className="wos-modal__message">{state.options.message}</p>
            <div className="wos-modal__actions">
              <button type="button" className="btn btn-outline-wood" onClick={() => handle(false)}>
                {state.options.cancelLabel ?? "Cancel"}
              </button>
              <button
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
