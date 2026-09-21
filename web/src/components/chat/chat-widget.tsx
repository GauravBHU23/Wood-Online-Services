"use client";

import { useEffect, useRef, useState } from "react";

interface ChatMessage {
  role: "user" | "bot";
  text: string;
}

// Ported from Views/Shared/_Layout.cshtml's #chatPanel + wwwroot/js/chatbot.js — same classes
// (.chat-launcher, .chat-panel, .chat-msg--bot/--user, .chat-suggestion) and behaviour.
export function ChatWidget({ shopName, whatsappNumber }: { shopName: string; whatsappNumber: string }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open && messages.length === 0) {
      fetch("/api/chat/greeting")
        .then((r) => r.json())
        .then((json) => {
          if (json.success) {
            setMessages([{ role: "bot", text: json.data.message }]);
            setSuggestions(json.data.suggestions ?? []);
          }
        })
        .catch(() => {
          setMessages([{ role: "bot", text: `Hello! Welcome to ${shopName}.` }]);
        });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, sending]);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || sending) return;

    setMessages((prev) => [...prev, { role: "user", text: trimmed }]);
    setInput("");
    setSuggestions([]);
    setSending(true);

    try {
      const res = await fetch("/api/chat/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed }),
      });
      const json = await res.json();
      if (json.success) {
        setMessages((prev) => [...prev, { role: "bot", text: json.data.message }]);
        setSuggestions(json.data.suggestions ?? []);
      } else {
        setMessages((prev) => [...prev, { role: "bot", text: json.message || "Sorry, I could not process that. Please try again." }]);
      }
    } catch {
      setMessages((prev) => [...prev, { role: "bot", text: "Sorry, something went wrong. Please try again." }]);
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <button type="button" id="chatLauncher" className="chat-launcher" aria-label="Chat with us" aria-expanded={open} aria-controls="chatPanel" onClick={() => setOpen((v) => !v)}>
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M20 2H4a2 2 0 0 0-2 2v18l4-4h14a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2zM7 9h10v2H7V9zm6 5H7v-2h6v2zm4-6H7V6h10v2z" />
        </svg>
      </button>

      <div id="chatPanel" className={`chat-panel${open ? " is-open" : ""}`} role="dialog" aria-label="Chat with us">
        <div className="chat-header">
          <div>
            <div className="chat-header__title">{shopName}</div>
            <div className="chat-header__status">Usually replies instantly</div>
          </div>
          <button type="button" className="chat-close" aria-label="Close chat" onClick={() => setOpen(false)}>
            &times;
          </button>
        </div>

        <div id="chatBody" className="chat-body" role="log" aria-live="polite" ref={bodyRef}>
          {messages.map((m, i) => (
            <div key={i} className={`chat-msg chat-msg--${m.role === "user" ? "user" : "bot"}`}>
              {m.text}
            </div>
          ))}
          {sending && (
            <div className="chat-typing" aria-hidden="true">
              <span></span>
              <span></span>
              <span></span>
            </div>
          )}
          {suggestions.length > 0 && !sending && (
            <div className="chat-suggestions">
              {suggestions.map((s) => (
                <button key={s} type="button" className="chat-suggestion" onClick={() => send(s)}>
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="chat-footer">
          <form
            id="chatForm"
            data-no-guard
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
          >
            <label htmlFor="chatInput" className="visually-hidden">
              Your question
            </label>
            <input
              type="text"
              id="chatInput"
              maxLength={200}
              autoComplete="off"
              placeholder="Ask about products, prices, delivery..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
            />
            <button type="submit" aria-label="Send" disabled={sending}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
              </svg>
            </button>
          </form>
        </div>
      </div>

      <a className="whatsapp-float" href={`https://wa.me/${whatsappNumber}`} target="_blank" rel="noopener noreferrer" aria-label="Chat on WhatsApp">
        <svg width="30" height="30" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M17.47 14.38c-.3-.15-1.75-.86-2.02-.96-.27-.1-.47-.15-.67.15-.2.3-.77.96-.94 1.16-.17.2-.35.22-.64.07-.3-.15-1.25-.46-2.38-1.47-.88-.78-1.47-1.75-1.64-2.05-.17-.3-.02-.46.13-.6.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.6-.92-2.2-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.22 3.08c.15.2 2.1 3.2 5.08 4.49.71.3 1.26.49 1.69.63.71.22 1.36.19 1.87.12.57-.09 1.75-.72 2-1.41.25-.7.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35M12.04 21.5h-.01a9.47 9.47 0 0 1-4.83-1.32l-.35-.2-3.59.94.96-3.5-.23-.36a9.44 9.44 0 0 1-1.45-5.05c0-5.22 4.26-9.47 9.5-9.47a9.44 9.44 0 0 1 9.49 9.48c0 5.22-4.26 9.48-9.49 9.48M20.52 3.49A11.8 11.8 0 0 0 12.04 0C5.5 0 .19 5.31.18 11.84c0 2.09.55 4.13 1.6 5.93L.08 24l6.37-1.67a11.9 11.9 0 0 0 5.59 1.42h.01c6.54 0 11.86-5.31 11.86-11.84 0-3.16-1.23-6.14-3.47-8.38" />
        </svg>
      </a>
    </>
  );
}
