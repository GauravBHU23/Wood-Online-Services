import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getSiteSettingsPublic, type SiteSettingsPublic } from "@/lib/data/site-settings";
import { generateGeminiReply } from "@/lib/chatbot/gemini";

// Ported from Services/ChatbotService.cs. Answers customer questions from the shop's own data —
// real prices, real stock, real contact details — rather than canned marketing text. Intent is
// matched on keywords so the facts behind every answer come from the database, never a guess.
// When Gemini is configured those facts are handed to it purely to phrase a natural reply; the
// system instruction explicitly forbids it from adding anything not given to it.

export interface ChatProduct {
  id: number;
  name: string;
  price: number;
  isCustomOrder: boolean;
  image: string | null;
  woodType: string | null;
}

export interface ChatReply {
  message: string;
  suggestions: string[];
  products?: ChatProduct[];
}

const DEFAULT_SUGGESTIONS = [
  "What do you sell?",
  "Show me prices",
  "Where is your shop?",
  "Do you deliver?",
  "How do I order?",
];

const PHRASING_INSTRUCTION =
  "You are the customer-support chat assistant on a solid-wood furniture shop's website. " +
  "Rewrite the FACTS block below into a warm, natural, concise reply (2-5 sentences, plain " +
  "text, no markdown). Use ONLY the information in the FACTS block - never add a price, " +
  "product, policy, phone number or any other detail that is not explicitly stated there. " +
  "Do not invent anything. If the facts already read naturally, light touch-ups are fine.";

async function phrase(reply: ChatReply): Promise<ChatReply> {
  const phrased = await generateGeminiReply(PHRASING_INSTRUCTION, reply.message);
  if (!phrased) return reply;
  return { ...reply, message: phrased };
}

export async function greeting(): Promise<ChatReply> {
  const site = await getSiteSettingsPublic();
  return {
    message: `Hello! Welcome to ${site.shop_name}. Ask me about our furniture, prices, delivery or how to order.`,
    suggestions: DEFAULT_SUGGESTIONS,
  };
}

function matches(question: string, ...keywords: string[]): boolean {
  return keywords.some((k) => question.includes(k));
}

export async function answer(question: string): Promise<ChatReply> {
  const site = await getSiteSettingsPublic();
  let q = (question ?? "").trim().toLowerCase();
  if (q.length === 0) return greeting();
  if (q.length > 200) q = q.slice(0, 200);

  if (matches(q, "hi", "hello", "hey", "namaste", "good morning", "good evening")) return greeting();

  if (matches(q, "address", "where", "location", "shop", "reach", "direction", "map"))
    return phrase(location(site));

  if (matches(q, "phone", "call", "contact", "number", "whatsapp", "email")) return phrase(contact(site));

  if (matches(q, "time", "timing", "hour", "open", "close", "when")) return phrase(hours(site));

  if (matches(q, "deliver", "shipping", "courier", "transport", "charge")) return phrase(delivery(site));

  if (matches(q, "pay", "payment", "upi", "card", "cod", "cash", "online")) return phrase(payment());

  if (matches(q, "order", "buy", "purchase", "how do i", "how to")) return phrase(howToOrder(site));

  if (matches(q, "custom", "measurement", "size", "made to", "design", "quote", "quotation"))
    return phrase(customWork(site));

  if (matches(q, "wood", "material", "sheesham", "teak", "mango", "pine", "quality", "termite"))
    return phrase(await woodTypes());

  if (matches(q, "warranty", "guarantee", "return", "refund", "cancel", "damage")) return phrase(warranty(site));

  if (matches(q, "price", "cost", "rate", "cheap", "budget", "how much")) return pricing(site);

  const found = await searchProducts(q);
  if (found.length > 0) {
    return {
      message: `I found ${found.length} item${found.length === 1 ? "" : "s"} matching that:`,
      suggestions: ["Show me prices", "Do you deliver?", "How do I order?"],
      products: found,
    };
  }

  return unknown(site);
}

function location(site: SiteSettingsPublic): ChatReply {
  return {
    message:
      `Our shop is at:\n\n${site.address_line1}\n${site.address_line2}\n\n` +
      `Open ${site.working_hours}. Do come and see the wood in person - a photograph never shows the real grain.`,
    suggestions: ["What are your timings?", "What is your phone number?", "Do you deliver?"],
  };
}

function contact(site: SiteSettingsPublic): ChatReply {
  return {
    message:
      `You can reach us here:\n\nPhone: ${site.phone}\nWhatsApp: ${site.phone}\nEmail: ${site.email}\n\n` +
      `We are available ${site.working_hours}.`,
    suggestions: ["Where is your shop?", "What are your timings?", "How do I order?"],
  };
}

function hours(site: SiteSettingsPublic): ChatReply {
  return {
    message:
      `We are open ${site.working_hours}.\n\nYou can browse and order on the website at any time; we will call you to confirm during shop hours.`,
    suggestions: ["Where is your shop?", "How do I order?", "Do you deliver?"],
  };
}

function delivery(site: SiteSettingsPublic): ChatReply {
  return {
    message:
      `Yes, we deliver to your home.\n\nDelivery is free on orders of Rs. ${Math.round(site.free_shipping_above).toLocaleString("en-IN")} and above. Below that a charge of Rs. ${Math.round(site.shipping_charge).toLocaleString("en-IN")} applies.\n\n` +
      "Ready-stock items usually arrive in 3 to 7 working days. Made-to-order pieces take longer, and we agree the timeline with you before starting. We assemble the furniture at your home.",
    suggestions: ["How do I order?", "What payment methods do you take?", "Where is your shop?"],
  };
}

function payment(): ChatReply {
  return {
    message:
      "You can pay either way:\n\nOnline - UPI, credit card, debit card, net banking or a wallet. Payment is handled on a secure gateway; we never see your card details.\n\n" +
      "Cash on Delivery - pay when the furniture reaches your home. For large orders we call to confirm first.",
    suggestions: ["How do I order?", "Do you deliver?", "Can I cancel an order?"],
  };
}

function howToOrder(site: SiteSettingsPublic): ChatReply {
  return {
    message:
      "Ordering is straightforward:\n\n1. Browse the products and add what you like to your cart\n2. Create an account or sign in\n3. Enter your delivery address\n4. Pay online, or choose Cash on Delivery\n\n" +
      `We then call you to confirm, and you can track the order from your account.\n\nPrefer to talk? Call ${site.phone}.`,
    suggestions: ["Do you deliver?", "What payment methods do you take?", "Can I get custom sizes?"],
  };
}

function customWork(site: SiteSettingsPublic): ChatReply {
  return {
    message:
      "Yes, we make furniture to your own measurements.\n\nTell us the size, the design you have in mind and which wood you prefer, and we will prepare a quotation. A photograph or a rough sketch helps.\n\n" +
      `Temples, main doors and fitted units are almost always made to order, which is why they show 'Price on request' rather than a fixed price.\n\nSend the details on WhatsApp at ${site.phone} and we will come back with a price.`,
    suggestions: ["What woods do you use?", "How long does it take?", "Where is your shop?"],
  };
}

async function woodTypes(): Promise<ChatReply> {
  const supabase = await createClient();
  const result = await supabase
    .from("products")
    .select("wood_type")
    .eq("is_available", true)
    .not("wood_type", "is", null);
  const rows: { wood_type: string | null }[] = result.data ?? [];
  const woods = Array.from(new Set(rows.map((r) => r.wood_type).filter((w): w is string => !!w))).sort();
  const list = woods.length > 0 ? woods.join(", ") : "Sheesham, Teak, Mango Wood and Pine";

  return {
    message:
      `We work in ${list}.\n\nEverything is solid wood - the same timber inside and out, with no particle board or plywood filling. ` +
      "The timber is seasoned first so it will not crack or warp, then termite treated. Joints are cut mortise-and-tenon by hand rather than relying on nails and glue.\n\n" +
      "Polish is your choice: natural, walnut or mahogany.",
    suggestions: ["Show me prices", "Can I get custom sizes?", "Is there a warranty?"],
  };
}

function warranty(site: SiteSettingsPublic): ChatReply {
  return {
    message:
      "We warrant our joinery and workmanship for 12 months from delivery.\n\nPlease check the furniture at the time of delivery. If anything arrived damaged, tell us within 48 hours with photographs and we will repair or replace it.\n\n" +
      `You can cancel an order from your account until it has been dispatched. Made-to-order pieces cannot be cancelled once work has started, because they cannot be resold.\n\nAny problem at all, call ${site.phone}.`,
    suggestions: ["Do you deliver?", "How do I order?", "What is your address?"],
  };
}

async function pricing(site: SiteSettingsPublic): Promise<ChatReply> {
  const supabase = await createClient();
  const result = await supabase
    .from("products")
    .select("id, name, price, is_custom_order, image_url, wood_type")
    .eq("is_available", true)
    .eq("is_custom_order", false)
    .gt("price", 0);
  const priced: RawProduct[] = result.data ?? [];

  if (priced.length === 0) {
    return { message: `Please call ${site.phone} and we will share current prices.`, suggestions: DEFAULT_SUGGESTIONS };
  }

  const sorted = [...priced].sort((a, b) => a.price - b.price);
  const cheapest = sorted.slice(0, 4);
  const lowest = sorted[0].price;
  const highest = sorted[sorted.length - 1].price;

  return {
    message: `Our furniture ranges from Rs. ${Math.round(lowest).toLocaleString("en-IN")} to Rs. ${Math.round(highest).toLocaleString("en-IN")}, depending on the wood and the size.\n\nSome of our more affordable pieces:`,
    suggestions: ["Do you deliver?", "Can I get custom sizes?", "How do I order?"],
    products: cheapest.map(toChatProduct),
  };
}

interface RawProduct {
  id: number;
  name: string;
  price: number;
  is_custom_order: boolean;
  image_url: string | null;
  wood_type: string | null;
}

function toChatProduct(p: RawProduct): ChatProduct {
  return { id: p.id, name: p.name, price: p.price, isCustomOrder: p.is_custom_order, image: p.image_url, woodType: p.wood_type };
}

const STOP_WORDS = new Set([
  "do", "you", "have", "any", "the", "a", "an", "is", "are", "for",
  "me", "show", "i", "want", "need", "looking", "got", "there", "your",
]);

async function searchProducts(term: string): Promise<ChatProduct[]> {
  const words = term
    .split(/[\s,.?!]+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w))
    .slice(0, 4);

  if (words.length === 0) return [];

  const supabase = await createClient();

  // Every word must appear somewhere (name, wood type, category or description), so "teak bed"
  // does not match every bed — built as a chained .or() per word rather than a single filter.
  // Category name is matched too (ported from ChatbotService.cs's p.Category.Name.Contains(w)):
  // PostgREST's .or() only filters the base table's own columns, so each word's matching
  // category ids are resolved first and folded in as that word's `category_id.in.(...)` clause.
  const categoriesResult = await supabase.from("categories").select("id, name");
  const allCategories: { id: number; name: string }[] = (categoriesResult.data ?? []) as { id: number; name: string }[];

  let query = supabase
    .from("products")
    .select("id, name, price, is_custom_order, image_url, wood_type, category:categories(name), description")
    .eq("is_available", true);

  for (const word of words) {
    const escaped = word.replace(/[%_]/g, "\\$&");
    const lowerWord = word.toLowerCase();
    const matchingCategoryIds = allCategories
      .filter((c) => c.name.toLowerCase().includes(lowerWord))
      .map((c) => c.id);
    const categoryClause = matchingCategoryIds.length > 0 ? `,category_id.in.(${matchingCategoryIds.join(",")})` : "";

    query = query.or(
      `name.ilike.%${escaped}%,wood_type.ilike.%${escaped}%,description.ilike.%${escaped}%${categoryClause}`
    );
  }

  const result = await query.limit(4);
  const rows: RawProduct[] = (result.data ?? []) as unknown as RawProduct[];
  return rows.map(toChatProduct);
}

function unknown(site: SiteSettingsPublic): ChatReply {
  return {
    message:
      "I am not sure about that one, and I would rather not guess.\n\n" +
      `Please message us on WhatsApp at ${site.phone} or call the same number - we are available ${site.working_hours} and will answer properly.`,
    suggestions: ["What do you sell?", "Where is your shop?", "Do you deliver?", "How do I order?"],
  };
}
