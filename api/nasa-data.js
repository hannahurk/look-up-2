// Vercel serverless function — the only place the real NASA API key is used.
// Fetches NeoWs (today) and DONKI FLR/CME/GST (trailing ~7 days), normalizes
// them into a small shape the client can render from, and never forwards the
// key or the raw NASA payloads to the browser.

const NEO_URL = 'https://api.nasa.gov/neo/rest/v1/feed';
const FLR_URL = 'https://api.nasa.gov/DONKI/FLR';
const CME_URL = 'https://api.nasa.gov/DONKI/CME';
const GST_URL = 'https://api.nasa.gov/DONKI/GST';

const FLARE_CLASS_BASE = { A: 1, B: 10, C: 100, M: 1000, X: 10000 };

function isoDate(date) {
  return date.toISOString().slice(0, 10);
}

function dateRange(daysBack) {
  const end = new Date();
  const start = new Date();
  start.setUTCDate(start.getUTCDate() - daysBack);
  return { startDate: isoDate(start), endDate: isoDate(end) };
}

async function fetchJSON(url, apiKey) {
  if (!apiKey) throw new Error('NASA_API_KEY is not configured');
  const res = await fetch(url + (url.includes('?') ? '&' : '?') + `api_key=${apiKey}`);
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return res.json();
}

function flareIntensity(flares) {
  let max = 0;
  for (const flare of flares) {
    const classType = flare && flare.classType;
    if (!classType) continue;
    const letter = classType[0].toUpperCase();
    const base = FLARE_CLASS_BASE[letter];
    if (!base) continue;
    const magnitude = parseFloat(classType.slice(1));
    const value = base * (Number.isFinite(magnitude) ? magnitude : 1);
    if (value > max) max = value;
  }
  return max;
}

function averageCMESpeed(cmes) {
  const speeds = [];
  for (const cme of cmes) {
    const analyses = cme && cme.cmeAnalyses;
    if (!Array.isArray(analyses)) continue;
    for (const analysis of analyses) {
      if (analysis && typeof analysis.speed === 'number') speeds.push(analysis.speed);
    }
  }
  if (speeds.length === 0) return 0;
  return speeds.reduce((sum, v) => sum + v, 0) / speeds.length;
}

function maxKpIndex(storms) {
  let max = 0;
  for (const storm of storms) {
    const kpList = storm && storm.allKpIndex;
    if (!Array.isArray(kpList)) continue;
    for (const entry of kpList) {
      if (entry && typeof entry.kpIndex === 'number' && entry.kpIndex > max) {
        max = entry.kpIndex;
      }
    }
  }
  return max;
}

function normalizeAsteroids(neoFeed) {
  const byDate = (neoFeed && neoFeed.near_earth_objects) || {};
  const all = Object.values(byDate).flat();
  return all.map((obj) => {
    const approach = Array.isArray(obj.close_approach_data) ? obj.close_approach_data[0] : null;
    const diameterRange = obj.estimated_diameter && obj.estimated_diameter.meters;
    const diameter = diameterRange
      ? (diameterRange.estimated_diameter_min + diameterRange.estimated_diameter_max) / 2
      : 0;
    const velocity = approach ? parseFloat(approach.relative_velocity.kilometers_per_hour) : 0;
    const missDistance = approach ? parseFloat(approach.miss_distance.kilometers) : 0;

    return {
      id: obj.id || '',
      name: obj.name || '',
      diameter: Number.isFinite(diameter) ? diameter : 0,
      velocity: Number.isFinite(velocity) ? velocity : 0,
      missDistance: Number.isFinite(missDistance) ? missDistance : 0,
      hazardous: Boolean(obj.is_potentially_hazardous_asteroid),
    };
  });
}

module.exports = async (req, res) => {
  const apiKey = process.env.NASA_API_KEY;
  const today = isoDate(new Date());
  const { startDate, endDate } = dateRange(7);

  const [neoResult, flrResult, cmeResult, gstResult] = await Promise.allSettled([
    fetchJSON(`${NEO_URL}?start_date=${today}&end_date=${today}`, apiKey),
    fetchJSON(`${FLR_URL}?startDate=${startDate}&endDate=${endDate}`, apiKey),
    fetchJSON(`${CME_URL}?startDate=${startDate}&endDate=${endDate}`, apiKey),
    fetchJSON(`${GST_URL}?startDate=${startDate}&endDate=${endDate}`, apiKey),
  ]);

  const neo = neoResult.status === 'fulfilled' ? neoResult.value : null;
  const flares = flrResult.status === 'fulfilled' && Array.isArray(flrResult.value) ? flrResult.value : [];
  const cmes = cmeResult.status === 'fulfilled' && Array.isArray(cmeResult.value) ? cmeResult.value : [];
  const storms = gstResult.status === 'fulfilled' && Array.isArray(gstResult.value) ? gstResult.value : [];

  const kpIndex = maxKpIndex(storms);

  const payload = {
    timestamp: new Date().toISOString(),
    sourceStatus: {
      neo: neoResult.status === 'fulfilled' ? 'live' : 'unavailable',
      flares: flrResult.status === 'fulfilled' ? 'live' : 'unavailable',
      cmes: cmeResult.status === 'fulfilled' ? 'live' : 'unavailable',
      storms: gstResult.status === 'fulfilled' ? 'live' : 'unavailable',
    },
    spaceWeather: {
      flareCount: flares.length,
      flareIntensity: flareIntensity(flares),
      cmeCount: cmes.length,
      cmeSpeed: averageCMESpeed(cmes),
      geomagneticIntensity: Math.min(kpIndex / 9, 1),
      kpIndex,
    },
    asteroids: neo ? normalizeAsteroids(neo) : [],
  };

  res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=300');
  res.status(200).json(payload);
};
