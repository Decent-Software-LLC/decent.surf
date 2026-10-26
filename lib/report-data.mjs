import { SPOTS } from "./spots.mjs";

const MARINE_FIELDS = [
  "wave_height",
  "wave_period",
  "wave_peak_period",
  "wave_direction",
  "swell_wave_height",
  "swell_wave_period",
  "swell_wave_direction",
  "sea_surface_temperature"
];

const WEATHER_FIELDS = [
  "temperature_2m",
  "apparent_temperature",
  "precipitation_probability",
  "weather_code",
  "is_day",
  "cloud_cover",
  "visibility",
  "wind_speed_10m",
  "wind_direction_10m",
  "wind_gusts_10m"
];

const compass = (degrees) => {
  if (!Number.isFinite(degrees)) return null;
  return ["N", "NE", "E", "SE", "S", "SW", "W", "NW"][Math.round(degrees / 45) % 8];
};

const weatherLabel = (code) => ({
  0: "clear", 1: "mainly clear", 2: "partly cloudy", 3: "overcast",
  45: "fog", 48: "depositing rime fog", 51: "light drizzle", 53: "drizzle", 55: "heavy drizzle",
  56: "light freezing drizzle", 57: "freezing drizzle", 61: "light rain", 63: "rain", 65: "heavy rain",
  66: "light freezing rain", 67: "freezing rain", 71: "light snow", 73: "snow", 75: "heavy snow",
  77: "snow grains", 80: "light rain showers", 81: "rain showers", 82: "heavy rain showers",
  85: "light snow showers", 86: "heavy snow showers", 95: "thunderstorms", 96: "thunderstorms with light hail",
  99: "thunderstorms with heavy hail"
})[code] || null;

const finite = (value) => Number.isFinite(Number(value)) ? Number(value) : null;
const values = (rows, key) => rows.map((row) => row[key]).filter(Number.isFinite);
const min = (items) => items.length ? Math.min(...items) : null;
const max = (items) => items.length ? Math.max(...items) : null;
const mean = (items) => items.length ? items.reduce((sum, item) => sum + item, 0) / items.length : null;
const rounded = (value, digits = 1) => Number.isFinite(value) ? Number(value.toFixed(digits)) : null;

function friendlyTime(isoLocal) {
  const hour = Number(isoLocal?.slice(11, 13));
  if (!Number.isFinite(hour)) return null;
  const suffix = hour >= 12 ? "PM" : "AM";
  return `${hour % 12 || 12}:00 ${suffix}`;
}

function friendlyDate(isoLocal) {
  const [year, month, day] = String(isoLocal || "").slice(0, 10).split("-").map(Number);
  if (![year, month, day].every(Number.isFinite)) return null;
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" })
    .format(new Date(Date.UTC(year, month - 1, day)));
}

function localDateTimeParts(timeZone) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  }).formatToParts(new Date()).filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
  return {
    compactDate: `${parts.year}${parts.month}${parts.day}`,
    localKey: `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}`
  };
}

function hourlyRows(hourly, fields) {
  return (hourly?.time || []).map((time, index) => Object.fromEntries([
    ["time", time],
    ...fields.map((field) => [field, finite(hourly[field]?.[index])])
  ]));
}

function summarizeDay(date, rows) {
  const waveHeights = values(rows, "waveHeightFt");
  const wavePeriods = values(rows, "wavePeriodSec");
  const swellHeights = values(rows, "swellHeightFt");
  const winds = values(rows, "windMph");
  const gusts = values(rows, "windGustMph");
  const precipitation = values(rows, "precipitationProbabilityPct");
  const air = values(rows, "airTemperatureF");
  const water = values(rows, "waterTemperatureF");
  const waveDirections = values(rows, "waveDirectionDeg");
  const windDirections = values(rows, "windDirectionDeg");

  return {
    dateLabel: friendlyDate(`${date}T12:00`),
    waveHeightFt: { min: rounded(min(waveHeights)), max: rounded(max(waveHeights)) },
    wavePeriodSec: { average: rounded(mean(wavePeriods)), max: rounded(max(wavePeriods)) },
    swellHeightFt: { average: rounded(mean(swellHeights)), max: rounded(max(swellHeights)) },
    waveDirection: { degrees: rounded(mean(waveDirections), 0), compass: compass(mean(waveDirections)) },
    windMph: { average: rounded(mean(winds)), max: rounded(max(winds)) },
    windGustMph: { max: rounded(max(gusts)) },
    windDirection: { degrees: rounded(mean(windDirections), 0), compass: compass(mean(windDirections)) },
    precipitationProbabilityPct: { max: rounded(max(precipitation), 0) },
    airTemperatureF: { min: rounded(min(air), 0), max: rounded(max(air), 0) },
    waterTemperatureF: { average: rounded(mean(water), 0) }
  };
}

function mergeTimelines(marine, weather) {
  const marineRows = hourlyRows(marine.hourly, MARINE_FIELDS);
  const weatherByTime = new Map(hourlyRows(weather.hourly, WEATHER_FIELDS).map((row) => [row.time, row]));

  return marineRows.map((marineRow) => {
    const weatherRow = weatherByTime.get(marineRow.time) || {};
    return {
      time: marineRow.time,
      dateLabel: friendlyDate(marineRow.time),
      timeLabel: friendlyTime(marineRow.time),
      waveHeightFt: marineRow.wave_height,
      wavePeriodSec: marineRow.wave_period,
      wavePeakPeriodSec: marineRow.wave_peak_period > 0 ? marineRow.wave_peak_period : null,
      waveDirectionDeg: marineRow.wave_direction,
      waveDirection: compass(marineRow.wave_direction),
      swellHeightFt: marineRow.swell_wave_height,
      swellPeriodSec: marineRow.swell_wave_period,
      swellDirectionDeg: marineRow.swell_wave_direction,
      swellDirection: compass(marineRow.swell_wave_direction),
      waterTemperatureF: marineRow.sea_surface_temperature,
      airTemperatureF: weatherRow.temperature_2m,
      apparentTemperatureF: weatherRow.apparent_temperature,
      precipitationProbabilityPct: weatherRow.precipitation_probability,
      weatherCode: weatherRow.weather_code,
      weather: weatherLabel(weatherRow.weather_code),
      isDay: weatherRow.is_day === 1,
      cloudCoverPct: weatherRow.cloud_cover,
      visibilityMiles: Number.isFinite(weatherRow.visibility) ? rounded(weatherRow.visibility / 5280) : null,
      windMph: weatherRow.wind_speed_10m,
      windDirectionDeg: weatherRow.wind_direction_10m,
      windDirection: compass(weatherRow.wind_direction_10m),
      windGustMph: weatherRow.wind_gusts_10m
    };
  });
}

function extrema(rows) {
  const highestWave = rows.filter((row) => Number.isFinite(row.waveHeightFt)).sort((a, b) => b.waveHeightFt - a.waveHeightFt)[0];
  const longestPeriod = rows.filter((row) => Number.isFinite(row.wavePeriodSec)).sort((a, b) => b.wavePeriodSec - a.wavePeriodSec)[0];
  const lightestWind = rows.filter((row) => Number.isFinite(row.windMph)).sort((a, b) => a.windMph - b.windMph)[0];
  return {
    highestWave: highestWave ? { time: highestWave.time, feet: highestWave.waveHeightFt, periodSec: highestWave.wavePeriodSec } : null,
    longestPeriod: longestPeriod ? { time: longestPeriod.time, seconds: longestPeriod.wavePeriodSec, waveHeightFt: longestPeriod.waveHeightFt } : null,
    lightestWind: lightestWind ? { time: lightestWind.time, mph: lightestWind.windMph, direction: lightestWind.windDirection } : null
  };
}

async function fetchJson(url, label, headers = {}) {
  const response = await fetch(url, { headers, signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`${label} returned ${response.status}`);
  return response.json();
}

function milesBetween(a, b) {
  const radians = (degrees) => degrees * Math.PI / 180;
  const dLat = radians(b.latitude - a.latitude);
  const dLon = radians(b.longitude - a.longitude);
  const lat1 = radians(a.latitude);
  const lat2 = radians(b.latitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return rounded(3958.8 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h)));
}

function compactAlert(feature) {
  const alert = feature?.properties || {};
  return {
    id: alert.id || feature?.id || null,
    event: alert.event || null,
    headline: alert.headline || null,
    severity: alert.severity || null,
    urgency: alert.urgency || null,
    certainty: alert.certainty || null,
    effective: alert.effective || null,
    expires: alert.expires || alert.ends || null,
    description: alert.description || null,
    instruction: alert.instruction || null,
    sourceUrl: alert.web || alert.id || feature?.id || null
  };
}

async function fetchNwsSafety(spot) {
  const point = `${spot.latitude},${spot.longitude}`;
  const data = await fetchJson(
    `https://api.weather.gov/alerts/active?point=${encodeURIComponent(point)}`,
    "NWS alerts",
    { Accept: "application/geo+json", "User-Agent": "decent.surf (https://decent.surf)" }
  );
  const activeAlerts = (data.features || []).map(compactAlert);
  const ripCurrentAlerts = activeAlerts.filter((alert) => /rip current/i.test(`${alert.event} ${alert.headline}`));
  const shoreRelevantAlerts = activeAlerts.filter((alert) =>
    /rip current|high surf|beach hazard|shore break|surf zone|coastal flood|coastal hazard/i
      .test(`${alert.event} ${alert.headline}`)
  );
  return {
    checked: true,
    activeAlerts: shoreRelevantAlerts,
    shoreRelevantAlerts,
    ripCurrent: {
      activePointAlertFound: ripCurrentAlerts.length > 0,
      activeAlerts: ripCurrentAlerts,
      note: ripCurrentAlerts.length ? null : "No active point-based NWS rip-current alert was returned; this is not an all-clear."
    }
  };
}

async function fetchTides(spot) {
  if (!spot.tideStation) return { checked: false, reason: "No tide station is configured for this location" };
  const localNow = localDateTimeParts(spot.timezone);
  const params = new URLSearchParams({
    product: "predictions",
    application: "decent.surf",
    begin_date: localNow.compactDate,
    range: "72",
    datum: "MLLW",
    station: spot.tideStation.id,
    time_zone: "lst_ldt",
    units: "english",
    interval: "hilo",
    format: "json"
  });
  const data = await fetchJson(`https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?${params}`, "NOAA tides");
  if (data.error) throw new Error(`NOAA tides returned ${data.error.message || "an error"}`);
  return {
    checked: true,
    station: {
      ...spot.tideStation,
      distanceMiles: milesBetween(spot, spot.tideStation)
    },
    datum: "MLLW",
    predictions: (data.predictions || []).filter((prediction) => prediction.t >= localNow.localKey).map((prediction) => ({
      dateLabel: friendlyDate(prediction.t),
      timeLabel: friendlyTime(prediction.t),
      type: prediction.type === "H" ? "high" : prediction.type === "L" ? "low" : prediction.type,
      heightFt: rounded(Number(prediction.v), 2)
    }))
  };
}

async function buildSafetyPackage(spot) {
  const [nwsResult, tideResult] = await Promise.allSettled([
    fetchNwsSafety(spot),
    fetchTides(spot)
  ]);
  return {
    checkedAt: new Date().toISOString(),
    nws: nwsResult.status === "fulfilled"
      ? nwsResult.value
      : { checked: false, reason: nwsResult.reason?.message || "NWS alerts unavailable" },
    tides: tideResult.status === "fulfilled"
      ? tideResult.value
      : { checked: false, reason: tideResult.reason?.message || "NOAA tides unavailable" },
    interpretation: "No active alert does not mean conditions are safe. Tides and alerts are decision support, not an all-clear."
  };
}

export function getSpot(slug) {
  return SPOTS[slug] || null;
}

export async function buildReportPackage(slug) {
  const spot = getSpot(slug);
  if (!spot) throw new Error("Unknown surf spot");

  const location = { latitude: String(spot.latitude), longitude: String(spot.longitude) };
  const marineParams = new URLSearchParams({
    ...location,
    hourly: MARINE_FIELDS.join(","),
    forecast_hours: "72",
    length_unit: "imperial",
    temperature_unit: "fahrenheit",
    timezone: spot.timezone,
    cell_selection: "sea"
  });
  const weatherParams = new URLSearchParams({
    ...location,
    hourly: WEATHER_FIELDS.join(","),
    forecast_hours: "72",
    temperature_unit: "fahrenheit",
    wind_speed_unit: "mph",
    precipitation_unit: "inch",
    timezone: spot.timezone
  });

  const [marine, weather, safety] = await Promise.all([
    fetchJson(`https://marine-api.open-meteo.com/v1/marine?${marineParams}`, "Open-Meteo Marine"),
    fetchJson(`https://api.open-meteo.com/v1/forecast?${weatherParams}`, "Open-Meteo Weather"),
    buildSafetyPackage(spot)
  ]);
  const rows = mergeTimelines(marine, weather);
  if (!rows.length) throw new Error("Open-Meteo returned no hourly marine data");

  const grouped = Object.groupBy
    ? Object.groupBy(rows, (row) => row.time.slice(0, 10))
    : rows.reduce((days, row) => ((days[row.time.slice(0, 10)] ||= []).push(row), days), {});
  const daylightGrouped = Object.fromEntries(Object.entries(grouped).map(([date, dayRows]) => [
    date,
    dayRows.filter((row) => row.isDay)
  ]).filter(([, dayRows]) => dayRows.length));

  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    forecastHours: 72,
    spot,
    current: rows[0],
    highlights: extrema(rows),
    dailySummaries: Object.entries(grouped).map(([date, dayRows]) => summarizeDay(date, dayRows)),
    daylightDailySummaries: Object.entries(daylightGrouped).map(([date, dayRows]) => summarizeDay(date, dayRows)),
    threeHourly: rows.filter((_, index) => index % 3 === 0),
    daylightCandidates: rows.filter((row, index) => row.isDay && index % 3 === 0),
    safety,
    sources: {
      marine: "Open-Meteo Marine Weather API",
      weather: "Open-Meteo Weather Forecast API",
      alerts: "National Weather Service API",
      tides: "NOAA CO-OPS Data API",
      marineModelCoordinates: { latitude: marine.latitude, longitude: marine.longitude },
      weatherModelCoordinates: { latitude: weather.latitude, longitude: weather.longitude }
    },
    units: {
      marine: marine.hourly_units,
      weather: weather.hourly_units
    }
  };
}
