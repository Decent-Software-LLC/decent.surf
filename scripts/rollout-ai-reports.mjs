import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { TIDE_STATIONS } from "../lib/tide-stations.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const homepage = await readFile(path.join(root, "index.html"), "utf8");
const spotArray = homepage.match(/const spots = \[([\s\S]*?)\n      \]\.map/)?.[1];
if (!spotArray) throw new Error("Could not find the homepage spot list");

const rows = Function(`"use strict"; return [${spotArray}];`)();
const slugify = (name) => name.toLowerCase().normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "").replace(/[’'ʻ]/g, "")
  .replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
const timezones = { east: "America/New_York", west: "America/Los_Angeles", hawaii: "Pacific/Honolulu" };
const spots = Object.fromEntries(rows.map(([name, place, region, latitude, longitude]) => {
  const slug = slugify(name);
  return [slug, {
    name, place, region, latitude, longitude,
    timezone: timezones[region],
    ...(TIDE_STATIONS[slug] ? { tideStation: TIDE_STATIONS[slug] } : {})
  }];
}));

const spotDirectories = (await readdir(path.join(root, "spots"), { withFileTypes: true }))
  .filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
const missingPages = Object.keys(spots).filter((slug) => !spotDirectories.includes(slug));
const extraPages = spotDirectories.filter((slug) => !spots[slug]);
if (missingPages.length || extraPages.length) {
  throw new Error(`Spot registry mismatch. Missing: ${missingPages.join(", ") || "none"}; extra: ${extraPages.join(", ") || "none"}`);
}

const serialized = JSON.stringify(spots, null, 2).replace(/"([^"\n]+)":/g, '"$1":');
await writeFile(path.join(root, "lib", "spots.mjs"), `// Generated from the canonical homepage spot list by scripts/rollout-ai-reports.mjs.\nexport const SPOTS = ${serialized};\n`);

for (const slug of spotDirectories) {
  const pagePath = path.join(root, "spots", slug, "index.html");
  let html = await readFile(pagePath, "utf8");
  html = html.replace(/\n      ai-surf-report \{[\s\S]*?\n      @keyframes report-pulse \{[^\n]+\}/, "");
  if (!html.includes("/components/ai-surf-report.css")) {
    html = html.replace(
      '    <link rel="apple-touch-icon" href="/assets/icons/apple-touch-icon.png" />',
      '    <link rel="apple-touch-icon" href="/assets/icons/apple-touch-icon.png" />\n    <link rel="stylesheet" href="/components/ai-surf-report.css?v=1" />'
    );
  }
  if (html.includes("/components/ai-surf-report.js")) {
    html = html.replace(/\/components\/ai-surf-report\.js\?v=\d+/, "/components/ai-surf-report.js?v=8");
  } else {
    html = html.replace(
      '    <script type="module" src="/components/dawn-patrol.js"></script>',
      '    <script type="module" src="/components/dawn-patrol.js"></script>\n    <script type="module" src="/components/ai-surf-report.js?v=8"></script>'
    );
  }
  if (!html.includes(`<ai-surf-report spot-slug="${slug}">`)) {
    html = html.replace(
      "      <live-camera></live-camera>",
      `      <live-camera></live-camera>\n      <ai-surf-report spot-slug="${slug}"></ai-surf-report>`
    );
  }
  await writeFile(pagePath, html);
}

console.log(`Rolled out AI reports to ${spotDirectories.length} location pages.`);
