import { writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SPOTS } from "../lib/spots.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const stationUrl = "https://api.tidesandcurrents.noaa.gov/mdapi/prod/webapi/stations.json?type=tidepredictions&units=english";
const response = await fetch(stationUrl, { signal: AbortSignal.timeout(30000) });
if (!response.ok) throw new Error(`NOAA station metadata returned ${response.status}`);
const stations = (await response.json()).stations || [];

const radians = (degrees) => degrees * Math.PI / 180;
const milesBetween = (spot, station) => {
  const dLat = radians(station.lat - spot.latitude);
  const dLon = radians(station.lng - spot.longitude);
  const lat1 = radians(spot.latitude);
  const lat2 = radians(station.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 3958.8 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
};

const matches = {};
for (const [slug, spot] of Object.entries(SPOTS)) {
  const nearest = stations.reduce((best, station) => {
    const distanceMiles = milesBetween(spot, station);
    return !best || distanceMiles < best.distanceMiles ? { station, distanceMiles } : best;
  }, null);
  if (!nearest || nearest.distanceMiles > 5) continue;
  matches[slug] = {
    id: nearest.station.id,
    name: nearest.station.name,
    latitude: Number(nearest.station.lat.toFixed(6)),
    longitude: Number(nearest.station.lng.toFixed(6)),
    distanceMiles: Number(nearest.distanceMiles.toFixed(2))
  };
}

const source = `// Generated from NOAA CO-OPS tide-prediction station metadata by scripts/find-noaa-tide-stations.mjs.\nexport const TIDE_STATIONS = ${JSON.stringify(matches, null, 2)};\n`;
await writeFile(path.join(root, "lib", "tide-stations.mjs"), source);
console.log(`Matched ${Object.keys(matches).length} of ${Object.keys(SPOTS).length} locations to a NOAA tide station within 5 miles.`);
