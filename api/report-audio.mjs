import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local", quiet: true });

const VOICE_ID = process.env.ELEVENLABS_VOICE_ID || "TX3LPaxmHKxFdv7VOQHJ";
const MODEL_ID = process.env.ELEVENLABS_MODEL_ID || "eleven_flash_v2_5";

function setCors(request, response) {
  const origin = request.headers.origin;
  const allowed = origin === "https://decent.surf" || origin?.endsWith(".vercel.app");
  if (allowed) response.setHeader("Access-Control-Allow-Origin", origin);
  response.setHeader("Vary", "Origin");
}

function cleanSpeech(value) {
  return String(value || "")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/^[-*]\s+/gm, "")
    .replace(/\[(.*?)\]\(.*?\)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

function reportSections(markdown) {
  const sections = new Map();
  const normalized = String(markdown || "").replace(
    /^(?:#{1,3}\s*|\*\*)?(Snapshot|Best window|72-hour outlook|Weather notes|Check before paddling out)(?:\*\*)?\s*$/gim,
    "### $1"
  );
  for (const block of normalized.split(/(?=^#{1,3}\s+)/m)) {
    const match = block.match(/^#{1,3}\s+([^\n]+)\n?([\s\S]*)$/);
    if (!match) continue;
    const heading = match[1].trim().toLowerCase();
    sections.set(heading, cleanSpeech(match[2]));
  }
  return sections;
}

export function spokenText(markdown, spot) {
  const sections = reportSections(markdown);
  const location = String(spot || "").replace(/[^a-zA-Z0-9 .,'-]/g, "").trim();
  const parts = [
    location ? `${location} surf report.` : "Your surf report.",
    sections.get("snapshot") ? `Right now. ${sections.get("snapshot")}` : "",
    sections.get("best window") ? `Best window. ${sections.get("best window")}` : "",
    sections.get("check before paddling out") ? `Before you paddle out. ${sections.get("check before paddling out")}` : ""
  ].filter(Boolean);
  const abridged = parts.length > 1 ? parts.join(" ") : cleanSpeech(markdown);
  return abridged.length <= 1800 ? abridged : `${abridged.slice(0, 1797).trimEnd()}...`;
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
      voiceSettings: { stability: 0.42, similarityBoost: 0.78 }
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
