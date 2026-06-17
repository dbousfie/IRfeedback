import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
const QUALTRICS_API_TOKEN = Deno.env.get("QUALTRICS_API_TOKEN");
const QUALTRICS_SURVEY_ID = Deno.env.get("QUALTRICS_SURVEY_ID");
const QUALTRICS_DATACENTER = Deno.env.get("QUALTRICS_DATACENTER");

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  }

  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  let body;
  try {
    body = await req.json();
  } catch (_) {
    return new Response("Invalid JSON", { status: 400 });
  }

  const raw = body.query.trim();
  let guidance = "";
  let paragraph = raw;

  if (raw.startsWith("dsb2025 -")) {
    const split = raw.split("\n");
    guidance = split[0].replace("dsb2025 -", "").trim();
    paragraph = split.slice(1).join("\n").trim();
  }

  const criteria = await Deno.readTextFile("criteria.md").catch(() => "Error loading criteria.");

  const messages = [
    {
      role: "system",
      content:
        `${criteria}\n\n${guidance ? `Instructor note: ${guidance}\n\n` : ""}Respond ONLY with valid JSON. No markdown fences, no preamble.`,
    },
    {
      role: "user",
      content: `Analyze this paragraph:\n\n${paragraph}`,
    },
  ];

  const openaiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4o",
      messages,
      response_format: { type: "json_object" },
    }),
  });

  const openaiJson = await openaiResponse.json();
  const result = openaiJson?.choices?.[0]?.message?.content || '{"error": "No response from OpenAI"}';

  let qualtricsStatus = "Qualtrics not called";

  if (QUALTRICS_API_TOKEN && QUALTRICS_SURVEY_ID && QUALTRICS_DATACENTER) {
    const qualtricsPayload = {
      values: {
        responseText: result,
        queryText: body.query,
      },
    };

    const qt = await fetch(`https://${QUALTRICS_DATACENTER}.qualtrics.com/API/v3/surveys/${QUALTRICS_SURVEY_ID}/responses`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-TOKEN": QUALTRICS_API_TOKEN,
      },
      body: JSON.stringify(qualtricsPayload),
    });

    qualtricsStatus = `Qualtrics status: ${qt.status}`;
  }

  return new Response(result, {
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
});
