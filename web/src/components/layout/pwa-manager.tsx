"use client";

import { useEffect, useRef, useState } from "react";
import { useToast } from "@/components/ui/toast-provider";

// Ported from wwwroot/js/site.js#initPwa. Registers the service worker, shows the install
// prompt after a 12s delay (dismissible, remembered via localStorage), and toggles the offline
// banner. Same classes (.pwa-prompt.is-visible, #offlineBanner.is-visible) as the original.

interface BeforeInstallPromptEvent extends Event {
  prompt: () => void;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function PwaManager() {
  const toast = useToast();
  const [visible, setVisible] = useState(false);
  const deferredPromptRef = useRef<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      window.addEventListener("load", () => {
        navigator.serviceWorker.register("/sw.js").catch(() => {
          // Offline support is a bonus; a failed registration is not worth a message.
        });
      });
    }

    function onBeforeInstallPrompt(e: Event) {
      e.preventDefault();
      deferredPromptRef.current = e as BeforeInstallPromptEvent;

      let dismissed = false;
      try {
        dismissed = localStorage.getItem("pwa-dismissed") === "1";
      } catch {
        // ignore
      }
      if (dismissed) return;

      setTimeout(() => setVisible(true), 12000);
    }

    function onOnlineOffline() {
      const banner = document.getElementById("offlineBanner");
      banner?.classList.toggle("is-visible", !navigator.onLine);
    }

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("online", onOnlineOffline);
    window.addEventListener("offline", onOnlineOffline);
    onOnlineOffline();

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("online", onOnlineOffline);
      window.removeEventListener("offline", onOnlineOffline);
    };
  }, []);

  async function handleInstall() {
    setVisible(false);
    const prompt = deferredPromptRef.current;
    if (!prompt) return;

    prompt.prompt();
    const choice = await prompt.userChoice;
    if (choice.outcome === "accepted") toast.success("App installed.");
    deferredPromptRef.current = null;
  }

  function handleDismiss() {
    setVisible(false);
    try {
      localStorage.setItem("pwa-dismissed", "1");
    } catch {
      // ignore
    }
  }

  if (!visible) return null;

  return (
    <div className="pwa-prompt is-visible">
      <div className="fw-bold mb-1" style={{ color: "var(--wood-900)" }}>
        Install our app
      </div>
      <p className="small text-muted-wood mb-3">Add Wood Online Service to your home screen for faster access and offline browsing.</p>
      <div className="d-flex gap-2">
        <button type="button" className="btn btn-wood btn-sm" onClick={handleInstall}>
          Install
        </button>
        <button type="button" className="btn btn-outline-wood btn-sm" onClick={handleDismiss}>
          Not now
        </button>
      </div>
    </div>
  );
}
