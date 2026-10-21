const SPOTS = {
  "manasquan-inlet": {
    name: "Manasquan Inlet",
    place: "Manasquan, New Jersey",
    latitude: 40.1027,
    longitude: -74.0345,
    timezone: "America/New_York"
  }
};

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

async function fetchJson(url, label) {
  const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`${label} returned ${response.status}`);
  return response.json();
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

  const [marine, weather] = await Promise.all([
    fetchJson(`https://marine-api.open-meteo.com/v1/marine?${marineParams}`, "Open-Meteo Marine"),
    fetchJson(`https://api.open-meteo.com/v1/forecast?${weatherParams}`, "Open-Meteo Weather")
  ]);
  const rows = mergeTimelines(marine, weather);
  if (!rows.length) throw new Error("Open-Meteo returned no hourly marine data");

  const grouped = Object.groupBy
    ? Object.groupBy(rows, (row) => row.time.slice(0, 10))
    : rows.reduce((days, row) => ((days[row.time.slice(0, 10)] ||= []).push(row), days), {});

  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    forecastHours: 72,
    spot,
    current: rows[0],
    highlights: extrema(rows),
    dailySummaries: Object.entries(grouped).map(([date, dayRows]) => summarizeDay(date, dayRows)),
    threeHourly: rows.filter((_, index) => index % 3 === 0),
    daylightCandidates: rows.filter((row, index) => row.isDay && index % 3 === 0),
    sources: {
      marine: "Open-Meteo Marine Weather API",
      weather: "Open-Meteo Weather Forecast API",
      marineModelCoordinates: { latitude: marine.latitude, longitude: marine.longitude },
      weatherModelCoordinates: { latitude: weather.latitude, longitude: weather.longitude }
    },
    units: {
      marine: marine.hourly_units,
      weather: weather.hourly_units
    }
  };
}
