import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local", quiet: true });

const VOICE_ID = process.env.ELEVENLABS_VOICE_ID || "JBFqnCBsd6RMkjVDRZzb";
const MODEL_ID = process.env.ELEVENLABS_MODEL_ID || "eleven_flash_v2_5";

function setCors(request, response) {
  const origin = request.headers.origin;
  const allowed = origin === "https://decent.surf" || origin?.endsWith(".vercel.app");
  if (allowed) response.setHeader("Access-Control-Allow-Origin", origin);
  response.setHeader("Vary", "Origin");
}

function spokenText(markdown, spot) {
  const report = String(markdown || "")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/^[-*]\s+/gm, "")
    .replace(/\[(.*?)\]\(.*?\)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
  const location = String(spot || "").replace(/[^a-zA-Z0-9 .,'-]/g, "").trim();
  return `${location ? `${location} surf report. ` : ""}${report}`;
}

async function streamToBuffer(stream) {
  const chunks = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}

export default async function handler(request, response) {
  setCors(request, response);
  if (request.method === "OPTIONS") {
    response.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    response.setHeader("Access-Control-Allow-Headers", "Content-Type");
    return response.status(204).end();
  }
  if (request.method !== "POST") return response.status(405).json({ error: "Method not allowed" });
  if (!process.env.ELEVENLABS_API_KEY) return response.status(503).json({ error: "Audio service is not configured" });

  const text = spokenText(request.body?.markdown, request.body?.spot);
  if (text.length < 120 || text.length > 6000) return response.status(400).json({ error: "Invalid report text" });

  try {
    const client = new ElevenLabsClient();
    const audioStream = await client.textToSpeech.convert(VOICE_ID, {
      text,
      modelId: MODEL_ID,
      outputFormat: "mp3_44100_128",
      applyTextNormalization: "on",
      voiceSettings: { stability: 0.55, similarityBoost: 0.7 }
    });
    const audio = await streamToBuffer(audioStream);
    response.setHeader("Content-Type", "audio/mpeg");
    response.setHeader("Content-Length", String(audio.length));
    response.setHeader("Cache-Control", "private, no-store");
    return response.status(200).send(audio);
  } catch (error) {
    console.error("ElevenLabs report audio failed", error);
    return response.status(502).json({ error: "Report audio is temporarily unavailable" });
  }
}
