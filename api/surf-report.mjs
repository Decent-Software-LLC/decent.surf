import { buildReportPackage, getSpot } from "../lib/report-data.mjs";

const MODEL = process.env.NVIDIA_MODEL || "nvidia/nemotron-3.5-lightning-30b-a3b";
const NVIDIA_ENDPOINT = "https://integrate.api.nvidia.com/v1/chat/completions";

const systemPrompt = `You write concise, useful surf reports for decent.surf in a knowledgeable, relaxed surfer voice. Use only the supplied modeled data. Never invent tides, observed conditions, local hazards, crowds, closures, or bathymetry. Clearly distinguish a forecast from an observation. Mention wave height, period, direction, wind and weather when useful. Do not call conditions safe. Return Markdown only, with these headings: Snapshot, Best window, 72-hour outlook, Weather notes, Check before paddling out. Keep the report between 250 and 450 words. Do not wrap the Markdown in a code fence.`;

function setCors(request, response) {
  const origin = request.headers.origin;
  const allowed = origin === "https://decent.surf" || origin?.endsWith(".vercel.app");
  if (allowed) response.setHeader("Access-Control-Allow-Origin", origin);
  response.setHeader("Vary", "Origin");
}

function cleanMarkdown(value) {
  return String(value || "").trim().replace(/^```(?:markdown)?\s*/i, "").replace(/\s*```$/, "");
}

function messageContent(message) {
  if (typeof message?.content === "string") return message.content;
  if (Array.isArray(message?.content)) {
    return message.content.map((part) => typeof part === "string" ? part : part?.text || part?.content || "").join("\n");
  }
  return "";
}

export default async function handler(request, response) {
  setCors(request, response);
  if (request.method === "OPTIONS") {
    response.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    return response.status(204).end();
  }
  if (request.method !== "GET") return response.status(405).json({ error: "Method not allowed" });

  const slug = Array.isArray(request.query?.slug) ? request.query.slug[0] : request.query?.slug;
  if (!slug || !getSpot(slug)) return response.status(400).json({ error: "Unknown surf spot" });
  if (!process.env.NVIDIA_API_KEY) return response.status(503).json({ error: "AI report service is not configured" });

  try {
    const reportPackage = await buildReportPackage(slug);
    const nvidiaResponse = await fetch(NVIDIA_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.NVIDIA_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Write the surf report from this verified forecast package:\n${JSON.stringify(reportPackage)}` }
        ],
        temperature: 0.3,
        max_tokens: 1200,
        chat_template_kwargs: { enable_thinking: false },
        stream: false
      }),
      signal: AbortSignal.timeout(45000)
    });

    if (!nvidiaResponse.ok) {
      const detail = await nvidiaResponse.text();
      console.error("NVIDIA report request failed", nvidiaResponse.status, detail.slice(0, 500));
      throw new Error(`NVIDIA returned ${nvidiaResponse.status}`);
    }

    const completion = await nvidiaResponse.json();
    const choice = completion.choices?.[0];
    const markdown = cleanMarkdown(messageContent(choice?.message));
    if (markdown.length < 120 || markdown.length > 10000) {
      console.error("NVIDIA returned an invalid report", {
        finishReason: choice?.finish_reason || null,
        contentLength: markdown.length,
        hasReasoning: Boolean(choice?.message?.reasoning || choice?.message?.reasoning_content)
      });
      throw new Error("NVIDIA returned an invalid report");
    }

    response.setHeader("Content-Type", "application/json; charset=utf-8");
    response.setHeader("Cache-Control", "public, max-age=0, must-revalidate");
    response.setHeader("CDN-Cache-Control", "public, s-maxage=3600, stale-while-revalidate=300");
    response.setHeader("Vercel-CDN-Cache-Control", "public, s-maxage=3600, stale-while-revalidate=300");
    return response.status(200).json({
      spot: reportPackage.spot.name,
      generatedAt: reportPackage.generatedAt,
      forecastHours: reportPackage.forecastHours,
      model: MODEL,
      markdown,
      sources: reportPackage.sources
    });
  } catch (error) {
    console.error("Surf report generation failed", error);
    return response.status(502).json({ error: "The AI surf report is temporarily unavailable" });
  }
}
