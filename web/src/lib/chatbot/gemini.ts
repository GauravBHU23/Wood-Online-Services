import "server-only";

// Ported from Services/GeminiService.cs. Thin wrapper over the Gemini free-tier REST API. Used
// only to phrase natural-language responses around facts the caller already looked up — never
// given free rein to invent prices, stock, or policy (the system instruction restricts it to
// the supplied facts). Returns null on any failure so the caller falls back to canned wording.

const ENABLED = process.env.GEMINI_ENABLED === "true";
const API_KEY = process.env.GEMINI_API_KEY ?? "";
const MODEL = process.env.GEMINI_MODEL ?? "gemini-3.5-flash-lite";
const BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models/";

export async function generateGeminiReply(systemInstruction: string, userMessage: string): Promise<string | null> {
  if (!ENABLED || !API_KEY) return null;

  const payload = {
    system_instruction: { parts: [{ text: systemInstruction }] },
    contents: [{ role: "user", parts: [{ text: userMessage }] }],
    generationConfig: { temperature: 0.3, maxOutputTokens: 400 },
  };

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);

    const res = await fetch(`${BASE_URL}${MODEL}:generateContent?key=${encodeURIComponent(API_KEY)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) return null;

    const json = await res.json();
    const text: string | undefined = json?.candidates?.[0]?.content?.parts?.[0]?.text;
    return text?.trim() || null;
  } catch {
    return null;
  }
}
