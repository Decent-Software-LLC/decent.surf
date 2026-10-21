import { buildReportPackage, getSpot } from "../lib/report-data.mjs";

const MODEL = process.env.NVIDIA_MODEL || "nvidia/nemotron-3.5-lightning-30b-a3b";
const NVIDIA_ENDPOINT = "https://integrate.api.nvidia.com/v1/chat/completions";

const systemPrompt = `Write a concise 72-hour surf report for decent.surf in a knowledgeable, relaxed voice without surfer caricature or hype.

Accuracy rules:
- Use only the supplied modeled data. Never invent tides, observations, local hazards, crowds, closures, bathymetry, wave quality, or live-camera observations.
- The supplied wave height is modeled significant wave height near the coordinates, not guaranteed breaking-wave face height at the beach. Say "modeled wave height" on first reference and do not translate it into face height.
- Wave and wind directions indicate where they come from. Say "wind from the north," never "northbound."
- Do not call conditions clean, glassy, safe, good, dangerous, offshore, or onshore unless the supplied facts explicitly establish that claim.
- Do not use regional terms such as tradewinds outside an appropriate region.
- Select the Best window only from daylightCandidates. Never extend the window across a row that is absent from daylightCandidates. Describe it as the "most promising modeled daylight window," because tides and local effects are not included.
- Use the supplied dateLabel and timeLabel in reader-facing text. Never print ISO dates or 24-hour times.
- Use these exact sustained-wind categories: 0–4 mph light; 5–12 mph moderate; 13–20 mph breezy; 21–30 mph strong; 31+ mph very strong. Never say wind is becoming lighter if its later category is stronger.
- Report visibility in rounded miles only when it materially affects a surf decision. Do not report visibility in feet.
- Do not infer choppy, clean, blown-out, offshore, or onshore conditions from wind speed and compass direction alone; shoreline orientation and local effects are not supplied.
- Avoid prescriptive wetsuit claims. State water temperature and suggest choosing exposure protection for personal tolerance and session length.
- If a field is absent or uncertain, omit the claim rather than guessing.

Writing rules:
- Return Markdown only. Do not add a report title; the UI already supplies one.
- Use exactly these headings in this order: Snapshot, Best window, 72-hour outlook, Weather notes, Check before paddling out.
- Keep it between 225 and 325 words.
- Prefer specific, decision-useful facts over filler. Keep safety language calm and practical.
- Do not wrap the Markdown in a code fence.`;

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
