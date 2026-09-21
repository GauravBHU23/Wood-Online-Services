"use client";

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";

// Ported from wwwroot/js/notify.js's toast()/dismiss() — same classes/markup
// (.wos-toast-host, .wos-toast--{type}, drain bar via --wos-toast-duration, hover-to-pause)
// so notifications look and behave identically to the original.

type ToastTone = "success" | "error" | "warning" | "info";

interface Toast {
  id: number;
  tone: ToastTone;
  message: string;
  title?: string;
  duration: number;
  dismissing?: boolean;
}

interface ToastContextValue {
  show: (tone: ToastTone, message: string, options?: { title?: string; duration?: number }) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  warning: (message: string) => void;
  info: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

const ICONS: Record<ToastTone, string> = {
  success: "✓",
  error: "✗",
  warning: "!",
  info: "ℹ",
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idRef = useRef(0);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, dismissing: true } : t)));
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 260);
    const timer = timers.current.get(id);
    if (timer) clearTimeout(timer);
    timers.current.delete(id);
  }, []);

  const show = useCallback(
    (tone: ToastTone, message: string, options?: { title?: string; duration?: number }) => {
      if (!message) return;
      const id = ++idRef.current;
      const duration = options?.duration ?? (tone === "error" ? 8000 : 4500);

      setToasts((prev) => [...prev, { id, tone, message, title: options?.title, duration }]);

      if (duration > 0) {
        const timer = setTimeout(() => dismiss(id), duration);
        timers.current.set(id, timer);
      }
    },
    [dismiss]
  );

  function pause(id: number) {
    const timer = timers.current.get(id);
    if (timer) clearTimeout(timer);
  }

  function resume(id: number, toast: Toast) {
    if (toast.duration <= 0) return;
    const timer = setTimeout(() => dismiss(id), 2000);
    timers.current.set(id, timer);
  }

  const value: ToastContextValue = {
    show,
    success: (m) => show("success", m),
    error: (m) => show("error", m),
    warning: (m) => show("warning", m),
    info: (m) => show("info", m),
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="wos-toast-host" role="region" aria-label="Notifications">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`wos-toast wos-toast--${t.tone}${t.dismissing ? "" : " is-visible"}${t.duration <= 0 ? " wos-toast--persistent" : ""}`}
            role={t.tone === "error" ? "alert" : "status"}
            aria-live={t.tone === "error" ? "assertive" : "polite"}
            style={t.duration > 0 ? ({ "--wos-toast-duration": `${t.duration}ms` } as React.CSSProperties) : undefined}
            onMouseEnter={() => pause(t.id)}
            onMouseLeave={() => resume(t.id, t)}
          >
            <span className="wos-toast__icon" aria-hidden="true" dangerouslySetInnerHTML={{ __html: ICONS[t.tone] }} />
            <div className="wos-toast__body">
              {t.title && <div className="wos-toast__title">{t.title}</div>}
              <div className="wos-toast__message">{t.message}</div>
            </div>
            <button type="button" className="wos-toast__close" aria-label="Dismiss" onClick={() => dismiss(t.id)}>
              &times;
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
