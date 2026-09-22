"use client";

import { useState } from "react";
import { FeedbackPromptModal } from "./feedback-prompt-modal";

function readAndClearFlag(): boolean {
  try {
    if (sessionStorage.getItem("wos_show_feedback_prompt") === "1") {
      sessionStorage.removeItem("wos_show_feedback_prompt");
      return true;
    }
  } catch {
    // Private browsing or storage disabled — nothing to show.
  }
  return false;
}

/**
 * Watches for the "just registered" flag set by RegisterForm and shows the welcome prompt once.
 * Read via useState's lazy initializer (runs once, during the first render) rather than an
 * effect — this is a one-time synchronous read of a client-only API, not a subscription to an
 * external system, so it doesn't need the effect lifecycle at all.
 */
export function FeedbackPromptTrigger() {
  const [open, setOpen] = useState(readAndClearFlag);

  if (!open) return null;
  return <FeedbackPromptModal onClose={() => setOpen(false)} />;
}
