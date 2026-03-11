import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY") || "";
const OPENAI_PROMPT_ID = Deno.env.get("OPENAI_PROMPT_ID") || "pmpt_69aaed8435b0819088fb1b94c9b6bca6098305a85a5b6e08";
const OPENAI_MODEL = Deno.env.get("OPENAI_MODEL") || "gpt-4.1-mini";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const GOOGLE_SHEETS_WEBHOOK_URL = Deno.env.get("GOOGLE_SHEETS_WEBHOOK_URL") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};

type ChatPayload = {
  type?: string;
  message?: string;
  lang?: string;
  page?: string;
  history?: Array<{ role: string; content: string }>;
  promptId?: string;
  context?: Record<string, unknown>;
  name?: string;
  email?: string;
  company?: string;
};

function detectMode(message: string) {
  const text = (message || "").toLowerCase();
  if (/(preis|pricing|kosten|angebot|demo|starten|buy|voice agent|chatbot|automation|crm|website|assistant)/.test(text)) return "sales";
  if (/(wie funktioniert|how does|integration|api|mehrsprachig|multilingual|whatsapp|setup|routing|language)/.test(text)) return "support";
  return "lead_qualification";
}

function extractLead(message: string) {
  const text = (message || "").toLowerCase();
  let industry = "unknown";
  if (/(restaurant|gastronomie|café|cafe)/.test(text)) industry = "restaurant";
  else if (/(hotel|hospitality)/.test(text)) industry = "hotel";
  else if (/(arzt|clinic|praxis|medical)/.test(text)) industry = "medical";
  else if (/(kanzlei|law firm|lawyer)/.test(text)) industry = "legal";
  else if (/(agentur|agency)/.test(text)) industry = "agency";

  let desired_solution = "unknown";
  if (/(voice|anruf|telefon|call)/.test(text)) desired_solution = "voice_agent";
  else if (/(chatbot|chat)/.test(text)) desired_solution = "chatbot";
  else if (/(crm|routing)/.test(text)) desired_solution = "crm_routing";
  else if (/website/.test(text)) desired_solution = "website_system";
  else if (/(automation|automatis)/.test(text)) desired_solution = "automation";

  let urgency = "unknown";
  if (/(sofort|dringend|asap|urgent|heute|today)/.test(text)) urgency = "high";
  else if (/(bald|soon|next week|diese woche)/.test(text)) urgency = "medium";

  let contact_intent = "low";
  if (/(demo|kontakt|contact|angebot|offer|starten|start)/.test(text)) contact_intent = "high";
  else if (/(interesse|interested|mehr infos|more info)/.test(text)) contact_intent = "medium";

  let lead_score = "cold";
  if (contact_intent === "high") lead_score = "hot";
  else if (industry !== "unknown" || desired_solution !== "unknown") lead_score = "warm";

  return { industry, desired_solution, urgency, contact_intent, lead_score };
}

async function openaiReply(payload: ChatPayload, mode: string) {
  const historyBlock = (payload.history || [])
    .slice(-8)
    .map((item) => `${item.role.toUpperCase()}: ${item.content}`)
    .join("\n");

  const input = `${mode ? `MODE: ${mode}\n\n` : ""}Fallback website language: ${payload.lang || "en"}\nCurrent page: ${payload.page || "/"}\n\nConversation history:\n${historyBlock || "No previous conversation."}\n\nContext:\n${JSON.stringify(payload.context || {}, null, 2)}\n\nLatest user message:\n${payload.message || ""}`;

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      prompt: {
        id: payload.promptId || OPENAI_PROMPT_ID,
        version: "1"
      },
      input
    })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `OpenAI error ${response.status}`);
  }

  const data = await response.json();
  return String(data.output_text || "").trim();
}

async function saveLead(row: Record<string, unknown>) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return;
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  await admin.from("youragent_leads").insert(row);
}

async function sendToGoogleSheets(row: Record<string, unknown>) {
  if (!GOOGLE_SHEETS_WEBHOOK_URL) return;
  await fetch(GOOGLE_SHEETS_WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(row)
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const payload = (await req.json()) as ChatPayload;

    if (payload.type === "contact_form") {
      const row = {
        source: "contact_form",
        name: payload.name || "",
        email: payload.email || "",
        company: payload.company || "",
        message: payload.message || "",
        lang: payload.lang || "en",
        page: payload.page || "/",
        created_at: new Date().toISOString()
      };
      await saveLead(row);
      await sendToGoogleSheets(row);
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const message = String(payload.message || "").trim();
    if (!message) throw new Error("Missing message");

    const mode = detectMode(message);
    const lead = extractLead(message);
    const reply = await openaiReply(payload, mode);

    const row = {
      source: "live_preview",
      message,
      reply,
      lang: payload.lang || "en",
      page: payload.page || "/",
      mode,
      ...lead,
      created_at: new Date().toISOString()
    };

    await saveLead(row);
    await sendToGoogleSheets(row);

    return new Response(JSON.stringify({ reply, mode, lead }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
