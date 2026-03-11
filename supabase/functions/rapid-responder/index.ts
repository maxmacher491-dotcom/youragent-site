import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

type JsonValue =
  | string
  | number
  | boolean
  | null
  | { [key: string]: JsonValue }
  | JsonValue[];

type JsonRecord = Record<string, JsonValue>;

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

const OPENAI_API_KEY =
  Deno.env.get("OPENAI_API_KEY") ||
  Deno.env.get("YRA_OPENAI_KEY") ||
  "";

const OPENAI_PROMPT_ID =
  Deno.env.get("OPENAI_PROMPT_ID") ||
  "pmpt_69aaed8435b0819088fb1b94c9b6bca6098305a85a5b6e08";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const GOOGLE_SHEETS_WEBHOOK_URL = Deno.env.get("GOOGLE_SHEETS_WEBHOOK_URL") || "";
const ALLOWED_ORIGINS_ENV = Deno.env.get("ALLOWED_ORIGINS") || "";

const OPENAI_URL = "https://api.openai.com/v1/responses";

const ALLOWED_EXACT_ORIGINS = new Set<string>(
  ALLOWED_ORIGINS_ENV.split(",").map((v) => v.trim()).filter(Boolean),
);

const ALLOWED_ORIGIN_PATTERNS: RegExp[] = [
  /^http:\/\/localhost:\d+$/i,
  /^http:\/\/127\.0\.0\.1:\d+$/i,
];

const DEFAULT_ALLOW_HEADERS = [
  "authorization",
  "x-client-info",
  "apikey",
  "content-type",
  "accept",
  "origin",
  "referer",
  "user-agent",
].join(", ");

function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return true;
  if (ALLOWED_EXACT_ORIGINS.has(origin)) return true;
  return ALLOWED_ORIGIN_PATTERNS.some((pattern) => pattern.test(origin));
}

function buildCorsHeaders(req: Request, origin: string | null): Headers {
  const headers = new Headers();
  const requestedHeaders = req.headers.get("access-control-request-headers");

  headers.set("Vary", "Origin, Access-Control-Request-Headers");
  headers.set("Access-Control-Allow-Methods", "OPTIONS, POST");
  headers.set(
    "Access-Control-Allow-Headers",
    requestedHeaders && requestedHeaders.trim() ? requestedHeaders : DEFAULT_ALLOW_HEADERS,
  );
  headers.set("Access-Control-Max-Age", "86400");

  if (origin && isAllowedOrigin(origin)) {
    headers.set("Access-Control-Allow-Origin", origin);
  }

  return headers;
}

function jsonResponse(
  req: Request,
  origin: string | null,
  status: number,
  body: JsonRecord,
): Response {
  const headers = buildCorsHeaders(req, origin);
  headers.set("Content-Type", "application/json; charset=utf-8");
  return new Response(JSON.stringify(body), { status, headers });
}

function detectMode(message: string): string {
  const text = message.toLowerCase();
  if (/(preis|pricing|kosten|angebot|demo|starten|buy|voice agent|chatbot|automation|crm|website|assistant)/.test(text)) return "sales";
  if (/(wie funktioniert|how does|integration|api|mehrsprachig|multilingual|whatsapp|setup|routing|language)/.test(text)) return "support";
  return "lead_qualification";
}

function extractLead(message: string) {
  const text = message.toLowerCase();

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

function extractOutputText(data: any): string {
  if (typeof data?.output_text === "string" && data.output_text.trim()) {
    return data.output_text.trim();
  }

  const parts: string[] = [];

  if (Array.isArray(data?.output)) {
    for (const item of data.output) {
      if (!Array.isArray(item?.content)) continue;
      for (const content of item.content) {
        if (typeof content?.text === "string" && content.text.trim()) {
          parts.push(content.text.trim());
        }
      }
    }
  }

  return parts.join("\n").trim();
}

async function openaiReply(payload: ChatPayload, mode: string) {
  const historyBlock = (payload.history || [])
    .slice(-8)
    .map((item) => `${item.role.toUpperCase()}: ${item.content}`)
    .join("\n");

  const compiledInput =
    `${mode ? `MODE: ${mode}\n\n` : ""}` +
    `Fallback website language: ${payload.lang || "en"}\n` +
    `Current page: ${payload.page || "/"}\n\n` +
    `Conversation history:\n${historyBlock || "No previous conversation."}\n\n` +
    `Context:\n${JSON.stringify(payload.context || {}, null, 2)}\n\n` +
    `Latest user message:\n${payload.message || ""}`;

  const response = await fetch(OPENAI_URL, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
      "Accept": "application/json",
    },
    body: JSON.stringify({
      prompt: {
        id: payload.promptId || OPENAI_PROMPT_ID,
      },
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: compiledInput,
            },
          ],
        },
      ],
    }),
  });

  const raw = await response.text();

  let data: any = null;
  try {
    data = raw ? JSON.parse(raw) : null;
  } catch {
    data = { raw };
  }

  if (!response.ok) {
    throw new Error(
      data?.error?.message || `OpenAI request failed with status ${response.status}`,
    );
  }

  return extractOutputText(data);
}

async function saveLead(row: Record<string, unknown>) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return;

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const { error } = await admin.from("youragent_leads").insert(row);
  if (error) console.error("saveLead failed:", error.message);
}

async function sendToGoogleSheets(row: Record<string, unknown>) {
  if (!GOOGLE_SHEETS_WEBHOOK_URL) return;
  try {
    await fetch(GOOGLE_SHEETS_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(row),
    });
  } catch (error) {
    console.error("sendToGoogleSheets failed:", error);
  }
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");

  if (!isAllowedOrigin(origin)) {
    return jsonResponse(req, origin, 403, {
      ok: false,
      error: "Origin not allowed",
    });
  }

  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: buildCorsHeaders(req, origin),
    });
  }

  if (req.method !== "POST") {
    return jsonResponse(req, origin, 405, {
      ok: false,
      error: "Method not allowed",
    });
  }

  if (!OPENAI_API_KEY) {
    return jsonResponse(req, origin, 500, {
      ok: false,
      error: "Missing OpenAI API key",
    });
  }

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
        created_at: new Date().toISOString(),
      };

      await saveLead(row);
      await sendToGoogleSheets(row);

      return jsonResponse(req, origin, 200, {
        ok: true,
        message: "Contact saved",
      });
    }

    const message = String(payload.message || "").trim();

    if (!message) {
      return jsonResponse(req, origin, 400, {
        ok: false,
        error: "Missing body.message",
      });
    }

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
      created_at: new Date().toISOString(),
    };

    await saveLead(row);
    await sendToGoogleSheets(row);

    return jsonResponse(req, origin, 200, {
      ok: true,
      reply,
      message: reply,
      mode,
      lead,
    });
  } catch (error) {
    return jsonResponse(req, origin, 500, {
      ok: false,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});
