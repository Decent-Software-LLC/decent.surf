# decent.surf

The coming-soon page for [decent.surf](https://decent.surf).

This is a dependency-free static site. Open `index.html` directly or serve the
directory with any static web server.

## AI surf report prototype

The `ai-surf-report` branch includes a Vercel Function prototype for Manasquan
Inlet. It combines 72 hours of Open-Meteo marine and weather forecasts, creates
a compact factual package, and asks an NVIDIA hosted model to write the report.

Configure the Vercel project with a Secret environment variable named
`NVIDIA_API_KEY`. The optional `NVIDIA_MODEL` Config variable defaults to
`nvidia/nemotron-3.5-lightning-30b-a3b`.

The audio report uses `GEMINI_API_KEY` for Google Gemini TTS. Optional `GEMINI_TTS_MODEL` and
`GEMINI_TTS_VOICE` variables default to `gemini-3.8-flash-tts` and
`Zubenelgenubi`.

The prototype endpoint is:

```text
GET /api/surf-report?slug=manasquan-inlet
```

The AI report is intentionally available only when the page is served through
Vercel or a compatible local function runtime. No API key is exposed to the
browser.
