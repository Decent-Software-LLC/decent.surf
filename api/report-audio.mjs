import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local", quiet: true });

const VOICE_ID = process.env.ELEVENLABS_VOICE_ID || "TX3LPaxmHKxFdv7VOQHJ";
const MODEL_ID = process.env.ELEVENLABS_MODEL_ID || "eleven_flash_v2_5";
const GEMINI_MODEL = process.env.GEMINI_TTS_MODEL || "gemini-3.8-flash-tts";
const GEMINI_VOICE = process.env.GEMINI_TTS_VOICE || "Zubenelgenubi";
const GEMINI_STYLE = "Casual, friendly and confident. Sound like a relaxed young West Coast surfer giving a useful morning surf report. Keep the delivery natural and the safety guidance clear, without exaggeration or forced slang.";

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

async function elevenLabsAudio(text) {
  const client = new ElevenLabsClient();
  const audioStream = await client.textToSpeech.convert(VOICE_ID, {
    text,
    modelId: MODEL_ID,
    outputFormat: "mp3_44100_128",
    applyTextNormalization: "on",
    voiceSettings: { stability: 0.42, similarityBoost: 0.78 }
  });
  return { audio: await streamToBuffer(audioStream), contentType: "audio/mpeg" };
}

async function geminiAudio(text) {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  const googleResponse = await fetch("https://generativelanguage.googleapis.com/v1beta/interactions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey
    },
    body: JSON.stringify({
      model: GEMINI_MODEL,
      input: [{
        type: "user_input",
        content: [{
          type: "text",
          text,
          annotations: [{ type: "speech_metadata", style: GEMINI_STYLE }]
        }]
      }],
      response_format: { type: "audio" },
      generation_config: { speech_config: [{ voice: GEMINI_VOICE }] }
    })
  });

  const result = await googleResponse.json().catch(() => ({}));
  if (!googleResponse.ok) {
    throw new Error(`Google TTS returned ${googleResponse.status}: ${result?.error?.message || "unknown error"}`);
  }
  const audioPart = result.steps
    ?.filter((step) => step.type === "model_output")
    .flatMap((step) => step.content || [])
    .filter((part) => part.type === "audio")
    .at(-1);
  if (!audioPart?.data) throw new Error("Google TTS returned no audio");
  return {
    audio: Buffer.from(audioPart.data, "base64"),
    contentType: audioPart.mime_type || "audio/wav"
  };
}

export default async function handler(request, response) {
  setCors(request, response);
  if (request.method === "OPTIONS") {
    response.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    response.setHeader("Access-Control-Allow-Headers", "Content-Type");
    return response.status(204).end();
  }
  if (request.method !== "POST") return response.status(405).json({ error: "Method not allowed" });
  const provider = request.body?.provider === "google" ? "google" : "elevenlabs";
  if (provider === "elevenlabs" && !process.env.ELEVENLABS_API_KEY) {
    return response.status(503).json({ error: "ElevenLabs audio is not configured" });
  }
  if (provider === "google" && !(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY)) {
    return response.status(503).json({ error: "Google Gemini audio is not configured" });
  }

  const text = spokenText(request.body?.markdown, request.body?.spot);
  if (text.length < 120 || text.length > 6000) return response.status(400).json({ error: "Invalid report text" });

  try {
    const { audio, contentType } = provider === "google"
      ? await geminiAudio(text)
      : await elevenLabsAudio(text);
    response.setHeader("Content-Type", contentType);
    response.setHeader("Content-Length", String(audio.length));
    response.setHeader("Cache-Control", "private, no-store");
    return response.status(200).send(audio);
  } catch (error) {
    console.error(`${provider} report audio failed`, error);
    return response.status(502).json({ error: `${provider === "google" ? "Google Gemini" : "ElevenLabs"} audio is temporarily unavailable` });
  }
}
