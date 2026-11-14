import { XMLParser, XMLValidator } from 'fast-xml-parser';

const HOUR = 60 * 60 * 1000;
const CACHE_TIME = 30 * 60 * 1000;
const TIMEOUT = 10000;
const BASE_URL = 'https://opendata.fmi.fi/wfs';
const helsinkiTime = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/Helsinki', year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', hour12: false,
});

let cachedForecast = null;
let cachedAt = 0;
let pendingRequest = null;

function localParts(time) {
  return Object.fromEntries(helsinkiTime.formatToParts(new Date(time)).map(({ type, value }) => [type, value]));
}

function dateKey({ year, month, day }) {
  return `${year}-${month}-${day}`;
}

export function getOuluDateKey(time = Date.now()) {
  return dateKey(localParts(time));
}

function calendarDate(parts, offset) {
  return new Date(Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day) + offset, 12));
}

export function describeWeather(code) {
  if (code === 1) return { icon: 'sunny-outline', description: 'selkeää', snow: false };
  if (code === 2) return { icon: 'partly-sunny-outline', description: 'puolipilvistä', snow: false };
  if (code === 3) return { icon: 'cloud-outline', description: 'pilvistä', snow: false };
  if ([21, 22, 23, 31, 32, 33].includes(code)) {
    return { icon: 'rainy-outline', description: 'vesisadetta', snow: false };
  }
  if ([41, 42, 43, 51, 52, 53].includes(code)) {
    return { icon: 'snow-outline', description: 'lumisadetta', snow: true };
  }
  if ([61, 62, 63, 64].includes(code)) {
    return { icon: 'thunderstorm-outline', description: 'ukkosta', snow: false };
  }
  if ([71, 72, 73, 81, 82, 83].includes(code)) {
    return { icon: 'rainy-outline', description: 'räntäsadetta', snow: false };
  }
  if ([91, 92].includes(code)) return { icon: 'cloud-outline', description: 'sumua', snow: false };
  return { icon: 'help-circle-outline', description: 'säätila ei tiedossa', snow: false };
}

export function parseOuluForecast(xml, now = Date.now()) {
  if (typeof xml !== 'string' || /<!DOCTYPE/i.test(xml) || XMLValidator.validate(xml) !== true) {
    throw new Error('Invalid FMI forecast XML');
  }
  const parsed = new XMLParser({ removeNSPrefix: true, parseTagValue: false }).parse(xml);
  const rawMembers = parsed?.FeatureCollection?.member;
  const members = Array.isArray(rawMembers) ? rawMembers : rawMembers ? [rawMembers] : [];
  const hours = new Map();
  for (const member of members) {
    const item = member?.BsWfsElement;
    if (!item || typeof item.Time !== 'string' || typeof item.ParameterValue !== 'string') continue;
    const time = Date.parse(item.Time);
    const value = item.ParameterValue.trim() === '' ? NaN : Number(item.ParameterValue);
    if (!Number.isFinite(time) || !Number.isFinite(value)) continue;
    if (item.ParameterName !== 'temperature' && item.ParameterName !== 'WeatherSymbol3') continue;
    const hour = hours.get(time) || { time };
    hour[item.ParameterName] = value;
    hours.set(time, hour);
  }

  const entries = [...hours.values()].map((entry) => ({ ...entry, local: localParts(entry.time) }));
  const today = localParts(now);
  const days = [0, 1, 2].map((offset) => {
    const date = calendarDate(today, offset);
    const key = date.toISOString().slice(0, 10);
    const candidates = entries.filter((entry) => dateKey(entry.local) === key && Number.isFinite(entry.temperature));
    const distance = offset === 0
      ? (entry) => Math.abs(entry.time - now)
      : (entry) => Math.abs(Number(entry.local.hour) - 12) * HOUR;
    const selected = candidates.filter((entry) => distance(entry) <= HOUR)
      .sort((a, b) => distance(a) - distance(b))[0];
    const snowTimes = entries
      .filter((entry) => dateKey(entry.local) === key &&
        (offset > 0 || entry.time >= now || entry.time === selected?.time) &&
        describeWeather(entry.WeatherSymbol3).snow)
      .map((entry) => entry.time)
      .sort((a, b) => a - b);
    if (!selected) return { date: date.getTime(), dateKey: key, time: null, temperature: null, snowTimes };
    return {
      date: date.getTime(),
      dateKey: key,
      time: selected.time,
      temperature: Math.round(selected.temperature) || 0,
      snowTimes,
      ...describeWeather(selected.WeatherSymbol3),
    };
  });
  if (days.every((day) => day.temperature === null)) throw new Error('FMI forecast has no usable temperatures');

  return { days };
}

async function fetchForecast() {
  const now = Date.now();
  const query = [
    ['service', 'WFS'],
    ['version', '2.0.0'],
    ['request', 'getFeature'],
    ['storedquery_id', 'fmi::forecast::edited::weather::scandinavia::point::simple'],
    ['place', 'Oulu'],
    ['parameters', 'temperature,WeatherSymbol3'],
    ['timestep', '60'],
    ['starttime', new Date(now - HOUR).toISOString()],
    ['endtime', new Date(now + 72 * HOUR).toISOString()],
  ].map(([key, value]) => `${key}=${encodeURIComponent(value)}`).join('&');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT);
  try {
    const response = await fetch(`${BASE_URL}?${query}`, { signal: controller.signal });
    if (!response.ok) throw new Error(`FMI forecast request failed (${response.status})`);
    const forecast = parseOuluForecast(await response.text());
    cachedForecast = forecast;
    cachedAt = Date.now();
    return forecast;
  } finally {
    clearTimeout(timeout);
  }
}

export function getOuluForecast() {
  const now = Date.now();
  if (cachedForecast && now >= cachedAt && now - cachedAt < CACHE_TIME &&
      cachedForecast.days[0].dateKey === getOuluDateKey(now) &&
      (cachedForecast.days[0].time === null || Math.abs(cachedForecast.days[0].time - now) <= HOUR)) {
    return Promise.resolve(cachedForecast);
  }
  if (!pendingRequest) {
    pendingRequest = fetchForecast().finally(() => { pendingRequest = null; });
  }
  return pendingRequest;
}
