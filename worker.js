// worker.js — Annoying AI Tendencies Detector backend (Cloudflare Workers)
//
// Migrated from the old Deno Deploy main.ts. Receives a paragraph from the
// frontend, fetches criteria.md from GitHub at runtime, asks the model to
// flag the eleven "annoying AI tendencies" sentence by sentence, returns
// structured JSON, and optionally logs the exchange to Qualtrics.
//
// WHY criteria.md is fetched over HTTP: Cloudflare Workers have no file
// system, so there is no Deno.readTextFile. The worker pulls criteria.md
// from this repo's raw GitHub URL on every request (cache: "no-store"), so
// editing criteria.md in GitHub updates behavior immediately — no redeploy.
//
// AI PROVIDER: auto-detected from env vars.
//   - If OPENAI_API_KEY is set  -> uses api.openai.com (matches the template).
//   - Otherwise                 -> uses your existing Azure OpenAI deployment.
// Set whichever key you want to use; you do NOT need both.
//
// Required environment variables (Cloudflare -> Settings -> Variables and Secrets):
//
//   CRITERIA_URL          (Text)    required. Raw GitHub URL of this repo's criteria.md
//                                   e.g. https://raw.githubusercontent.com/USER/REPO/main/criteria.md
//
//   --- pick ONE provider ---
//   OPENAI_API_KEY        (Secret)  OpenAI path. sk-...
//   OPENAI_MODEL          (Text)    optional, defaults to gpt-4o-mini
//     ...or...
//   AZURE_OPENAI_KEY      (Secret)  Azure path (your current setup)
//   AZURE_ENDPOINT        (Text)    optional, defaults to your western resource
//   AZURE_DEPLOYMENT_NAME (Text)    optional, defaults to gpt-4.1-mini
//   AZURE_API_VERSION     (Text)    optional, defaults to 2024-04-01-preview
//
//   --- optional logging ---
//   QUALTRICS_API_TOKEN   (Secret)
//   QUALTRICS_SURVEY_ID   (Text)    SV_...
//   QUALTRICS_DATACENTER  (Text)    e.g. uwo.eu
//   MAX_TOKENS            (Text)    optional, defaults to 2000
//
//   --- optional rate limiting ---
//   RL_LIMIT              (Text)    optional, requests per 60s per IP (default 20)
//   RATE_LIMITER          (Binding) optional, native Workers rate-limit binding.
//                                   If absent, a built-in in-memory limiter is used.
//
// Qualtrics survey must have embedded data fields: queryText, responseText
// (and feedback, if you later add thumbs-up/down).

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

// ── Rate limiting ──────────────────────────────────────────────────────────
// Caps requests per client IP to prevent runaway cost/abuse. Two modes:
//
//   1. If you add a native Workers Rate Limiting binding named RATE_LIMITER,
//      it is used automatically — hard, account-wide enforcement. (Configured
//      via wrangler, since the dashboard editor can't add this binding.)
//
//   2. Otherwise, the built-in in-memory limiter below runs with zero setup.
//      It is per-isolate and per-Cloudflare-location, so it is best-effort: it
//      reliably blunts a single client hammering the endpoint in a loop, but
//      counters reset as isolates recycle. Good enough for a private student
//      tool; use mode 1 if you need strict limits.
//
// Tune with the RL_LIMIT env var (requests per 60s per IP; default 20).
const ipHits = new Map(); // ip -> array of request timestamps (ms)
const RL_WINDOW_MS = 60 * 1000;

function memoryLimit(key, limit) {
  const now = Date.now();
  const recent = (ipHits.get(key) || []).filter(t => now - t < RL_WINDOW_MS);
  if (recent.length >= limit) {
    ipHits.set(key, recent);
    return false;
  }
  recent.push(now);
  ipHits.set(key, recent);
  // Bound memory: occasionally drop IPs with no recent hits.
  if (ipHits.size > 5000) {
    for (const [k, v] of ipHits) {
      if (v.every(t => now - t >= RL_WINDOW_MS)) ipHits.delete(k);
    }
  }
  return true;
}

async function withinRateLimit(req, env) {
  const ip = req.headers.get("CF-Connecting-IP") || "unknown";
  const limit = parseInt(env.RL_LIMIT || "20", 10);
  if (env.RATE_LIMITER && typeof env.RATE_LIMITER.limit === "function") {
    const { success } = await env.RATE_LIMITER.limit({ key: ip });
    return success;
  }
  return memoryLimit(ip, limit);
}

export default {
  async fetch(req, env) {
    // CORS preflight
    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }
    if (req.method !== "POST") {
      return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });
    }

    // Parse body
    let body;
    try {
      body = await req.json();
    } catch {
      return new Response("Invalid JSON", { status: 400, headers: corsHeaders });
    }

    // Rate limit every POST (analysis and feedback alike).
    if (!(await withinRateLimit(req, env))) {
      return new Response(
        JSON.stringify({ error: "Rate limit reached. Please wait a minute and try again." }),
        {
          status: 429,
          headers: { "Content-Type": "application/json", "Retry-After": "60", ...corsHeaders },
        }
      );
    }

    // Helper: log a row to Qualtrics. Returns a status string (never throws).
    async function logToQualtrics(values) {
      const { QUALTRICS_API_TOKEN, QUALTRICS_SURVEY_ID, QUALTRICS_DATACENTER } = env;
      if (!QUALTRICS_API_TOKEN || !QUALTRICS_SURVEY_ID || !QUALTRICS_DATACENTER) {
        return "Qualtrics not called (check env vars)";
      }
      try {
        const qt = await fetch(
          `https://${QUALTRICS_DATACENTER}.qualtrics.com/API/v3/surveys/${QUALTRICS_SURVEY_ID}/responses`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-API-TOKEN": QUALTRICS_API_TOKEN,
            },
            body: JSON.stringify({ values }),
          }
        );
        return `Qualtrics status: ${qt.status}`;
      } catch (e) {
        console.error(e);
        return "Qualtrics connection failed";
      }
    }

    // Optional feedback path (thumbs up/down). Short-circuits before any model
    // call. Harmless if your frontend never sends a "feedback" field.
    if (body.feedback) {
      const status = await logToQualtrics({
        queryText: body.query || "",
        responseText: body.responseText || "",
        feedback: body.feedback,
      });
      return new Response(`Feedback recorded. [${status}]`, {
        headers: { "Content-Type": "text/plain", ...corsHeaders },
      });
    }

    // --- Validate config -----------------------------------------------------
    const CRITERIA_URL = env.CRITERIA_URL;
    if (!CRITERIA_URL) {
      return new Response(
        JSON.stringify({ error: "Missing CRITERIA_URL. Check Cloudflare Variables and Secrets." }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const useOpenAI = !!env.OPENAI_API_KEY;
    if (!useOpenAI && !env.AZURE_OPENAI_KEY) {
      return new Response(
        JSON.stringify({ error: "Missing API key. Set OPENAI_API_KEY or AZURE_OPENAI_KEY." }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // --- Read the submitted paragraph ---------------------------------------
    const paragraph = (body.query || "").trim();

    // --- Load criteria.md from GitHub at runtime ----------------------------
    const criteria = await fetch(CRITERIA_URL, { cache: "no-store" })
      .then(r => r.text())
      .catch(() => "Error loading criteria.");

    const messages = [
      {
        role: "system",
        content: `${criteria}\n\nRespond ONLY with valid JSON. No markdown fences, no preamble.`,
      },
      {
        role: "user",
        content: `Analyze this paragraph:\n\n${paragraph}`,
      },
    ];

    const maxTokens = parseInt(env.MAX_TOKENS || "2000", 10);

    // --- Call the model (OpenAI or Azure) -----------------------------------
    let modelEndpoint, modelHeaders, modelBody;
    if (useOpenAI) {
      modelEndpoint = "https://api.openai.com/v1/chat/completions";
      modelHeaders = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      };
      modelBody = {
        model: env.OPENAI_MODEL || "gpt-4o-mini",
        messages,
        max_tokens: maxTokens,
        response_format: { type: "json_object" },
      };
    } else {
      const endpoint = env.AZURE_ENDPOINT || "https://chatbot-api-western.openai.azure.com";
      const deployment = env.AZURE_DEPLOYMENT_NAME || "gpt-4.1-mini";
      const apiVersion = env.AZURE_API_VERSION || "2024-04-01-preview";
      modelEndpoint = `${endpoint}/openai/deployments/${deployment}/chat/completions?api-version=${apiVersion}`;
      modelHeaders = {
        "Content-Type": "application/json",
        "api-key": env.AZURE_OPENAI_KEY,
      };
      modelBody = {
        messages,
        max_tokens: maxTokens,
        response_format: { type: "json_object" },
      };
    }

    let result;
    try {
      const modelResponse = await fetch(modelEndpoint, {
        method: "POST",
        headers: modelHeaders,
        body: JSON.stringify(modelBody),
      });
      const modelJson = await modelResponse.json();
      result =
        modelJson?.choices?.[0]?.message?.content ||
        JSON.stringify({ error: "No response from the model." });
    } catch (e) {
      console.error(e);
      return new Response(
        JSON.stringify({ error: "Model request failed." }),
        { status: 502, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Log the exchange. The status goes in an HTML comment appended AFTER the
    // JSON; the frontend strips HTML comments before JSON.parse, so this never
    // breaks parsing while still being visible if you hit the worker directly.
    const qualtricsStatus = await logToQualtrics({
      queryText: body.query || "",
      responseText: result,
    });

    return new Response(`${result}\n<!-- ${qualtricsStatus} -->`, {
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  },
};
