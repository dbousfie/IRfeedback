import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const AZURE_API_KEY = Deno.env.get("AZURE_OPENAI_KEY");
const QUALTRICS_API_TOKEN = Deno.env.get("QUALTRICS_API_TOKEN");
const QUALTRICS_SURVEY_ID = Deno.env.get("QUALTRICS_SURVEY_ID");
const QUALTRICS_DATACENTER = Deno.env.get("QUALTRICS_DATACENTER");

const AZURE_DEPLOYMENT_NAME = "gpt-4.1-mini";
const AZURE_ENDPOINT = "https://chatbot-api-western.openai.azure.com";
const AZURE_API_VERSION = "2024-04-01-preview";

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

  let body: { query: string };
  try {
    body = await req.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  if (!AZURE_API_KEY) {
    return new Response("Missing Azure API key", { status: 500 });
  }

  const raw = body.query.trim();
  let guidance = "";
  let paragraph = raw;

  // Support db2025 instructor override
  const db2025Index = raw.indexOf("db2025");
  if (db2025Index !== -1) {
    paragraph = raw.substring(0, db2025Index).trim();
    guidance = raw.substring(db2025Index + 6).trim();
  }

  const criteria = await Deno.readTextFile("criteria.md").catch(() =>
    "Error loading criteria."
  );

  const messages = [
    {
      role: "system",
      content: `${criteria}\n\n${guidance ? `Instructor note: ${guidance}\n\n` : ""}Respond ONLY with valid JSON. No markdown fences, no preamble.`,
    },
    {
      role: "user",
      content: `Analyze this paragraph:\n\n${paragraph}`,
    },
  ];

  const azureResponse = await fetch(
    `${AZURE_ENDPOINT}/openai/deployments/${AZURE_DEPLOYMENT_NAME}/chat/completions?api-version=${AZURE_API_VERSION}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": AZURE_API_KEY,
      },
      body: JSON.stringify({
        messages,
        response_format: { type: "json_object" },
      }),
    }
  );

  const azureJson = await azureResponse.json();
  const result =
    azureJson?.choices?.[0]?.message?.content || '{"error": "No response from Azure OpenAI"}';

  let qualtricsStatus = "Qualtrics not called";

  if (QUALTRICS_API_TOKEN && QUALTRICS_SURVEY_ID && QUALTRICS_DATACENTER) {
    const qualtricsPayload = {
      values: {
        responseText: result,
        queryText: body.query,
      },
    };

    const qt = await fetch(
      `https://${QUALTRICS_DATACENTER}.qualtrics.com/API/v3/surveys/${QUALTRICS_SURVEY_ID}/responses`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-TOKEN": QUALTRICS_API_TOKEN,
        },
        body: JSON.stringify(qualtricsPayload),
      }
    );

    qualtricsStatus = `Qualtrics status: ${qt.status}`;
  }

  return new Response(result, {
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
});
