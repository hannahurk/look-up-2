// Look Up — a ceiling sign for a bus shelter, showing NASA's Astronomy
// Picture of the Day full-bleed.
//
// Swap in your own free key from https://api.nasa.gov before leaving this
// running long-term — DEMO_KEY is capped at 30 requests/hour, 50/day, shared
// by everyone using it.
const API_KEY = 'krkXh9ELpInytug2kH4D3QNwdJ1dkgEYfI0i1njL';

const APOD_URL = `https://api.nasa.gov/planetary/apod?api_key=${API_KEY}`;
const REFRESH_MS = 60 * 60 * 1000; // recheck hourly so an always-on kiosk rolls to the new day

async function loadAPOD() {
  const oculus = document.getElementById('oculus');
  try {
    const res = await fetch(APOD_URL);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    renderAPOD(data);
  } catch (err) {
    renderAPODError(err);
  } finally {
    oculus.classList.remove('is-loading');
  }
}

function youtubeEmbedUrl(url) {
  const match = (url || '').match(
    /(?:youtube\.com\/(?:embed\/|watch\?v=)|youtu\.be\/)([\w-]+)/
  );
  if (!match) return null;
  const id = match[1];
  return `https://www.youtube.com/embed/${id}?autoplay=1&mute=1&loop=1&playlist=${id}&controls=0&modestbranding=1&rel=0`;
}

function renderAPOD(data) {
  const oculus = document.getElementById('oculus');
  oculus.classList.remove('show-video', 'show-video-frame', 'show-fallback');

  const imgEl = document.getElementById('oculus-image');
  const videoEl = document.getElementById('oculus-video');
  const frameEl = document.getElementById('oculus-video-frame');

  videoEl.pause();
  videoEl.removeAttribute('src');
  videoEl.load();
  frameEl.src = '';

  if (data.media_type === 'image') {
    imgEl.src = data.hdurl || data.url;
    imgEl.alt = data.title;
  } else if (data.media_type === 'video') {
    const embedUrl = youtubeEmbedUrl(data.url);
    if (embedUrl) {
      frameEl.src = embedUrl;
      frameEl.title = data.title;
      oculus.classList.add('show-video-frame');
    } else {
      videoEl.src = data.url;
      videoEl.play().catch(() => {});
      oculus.classList.add('show-video');
    }
  } else {
    oculus.classList.add('show-fallback');
  }
}

function renderAPODError(err) {
  document.getElementById('oculus').classList.add('show-fallback');
  console.error('APOD fetch failed:', err);
}

// ---------- Space weather (DONKI notification type — no time shown) ----------

const WX_TYPE_LABELS = {
  CME: 'Coronal Mass Ejection',
  GST: 'Geomagnetic Storm',
  FLR: 'Solar Flare',
  SEP: 'Solar Energetic Particles',
  IPS: 'Interplanetary Shock',
  MPC: 'Magnetopause Crossing',
  RBE: 'Radiation Belt Enhancement',
  report: 'Weekly Report',
};

function donkiDateRange(daysBack) {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - daysBack);
  const iso = (d) => d.toISOString().slice(0, 10);
  return { startDate: iso(start), endDate: iso(end) };
}

function typeFromMessageID(messageID, messageType) {
  if (messageType && WX_TYPE_LABELS[messageType]) return messageType;
  const match = (messageID || '').match(/-([A-Z]{2,3})-\d+$/);
  return match ? match[1] : messageType;
}

async function loadSpaceWeather() {
  const { startDate, endDate } = donkiDateRange(3);
  const url = `https://api.nasa.gov/DONKI/notifications?startDate=${startDate}&endDate=${endDate}&type=all&api_key=${API_KEY}`;

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    renderSpaceWeather(data);
  } catch (err) {
    console.error('DONKI fetch failed:', err);
  }
}

function renderSpaceWeather(notifications) {
  const card = document.getElementById('wx-card');
  card.classList.remove('has-error');

  if (!Array.isArray(notifications) || notifications.length === 0) {
    document.getElementById('wx-alert').textContent = 'All quiet — no alerts in the last 3 days.';
    return;
  }

  const latest = [...notifications].sort(
    (a, b) => new Date(b.messageIssueTime) - new Date(a.messageIssueTime)
  )[0];

  const typeKey = typeFromMessageID(latest.messageID, latest.messageType);
  const label = WX_TYPE_LABELS[typeKey] || typeKey || 'Notification';

  document.getElementById('wx-alert').textContent = label;
}

// ---------- Solar wind (NOAA SWPC — near-real-time, no key required) ----------

const WIND_REFRESH_MS = 60 * 1000; // this feed updates about once a minute
const KM_S_TO_MPH = 2236.94;

async function loadSolarWind() {
  try {
    const [magRes, speedRes] = await Promise.all([
      fetch('https://services.swpc.noaa.gov/products/summary/solar-wind-mag-field.json'),
      fetch('https://services.swpc.noaa.gov/products/summary/solar-wind-speed.json'),
    ]);
    if (!magRes.ok || !speedRes.ok) throw new Error('HTTP ' + magRes.status + '/' + speedRes.status);
    const [mag] = await magRes.json();
    const [speed] = await speedRes.json();
    renderSolarWind(mag, speed);
  } catch (err) {
    document.getElementById('wx-card').classList.add('has-error');
    document.getElementById('wind-speed').textContent = '—';
    document.getElementById('wind-bz').textContent = '—';
    console.error('Solar wind fetch failed:', err);
  }
}

function renderSolarWind(mag, speed) {
  const card = document.getElementById('wx-card');
  card.classList.remove('has-error');

  const mph = Math.round(speed.proton_speed * KM_S_TO_MPH);
  document.getElementById('wind-speed').textContent = mph.toLocaleString('en-US');

  const bz = mag.bz_gsm;
  document.getElementById('wind-bz').textContent = (bz > 0 ? '+' : '') + bz;
  const isSouth = bz < -2; // southward field: more likely to spark aurora
  card.classList.toggle('is-south', isSouth);
  document.getElementById('aurora-badge').hidden = !isSouth;
}

// ---------- Near-Earth objects (NeoWs feed) ----------

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

async function loadNEO() {
  const today = todayISO();
  const url = `https://api.nasa.gov/neo/rest/v1/feed?start_date=${today}&end_date=${today}&api_key=${API_KEY}`;

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    renderNEO(data);
  } catch (err) {
    console.error('NEO fetch failed:', err);
  }
}

function renderNEO(data) {
  const card = document.getElementById('neo-card');
  card.classList.remove('has-error');

  const objects = Object.values(data.near_earth_objects || {}).flat();
  if (objects.length === 0) {
    document.getElementById('neo-alert').textContent = 'No tracked close approaches today.';
    return;
  }

  const closest = objects.reduce((closestSoFar, obj) => {
    const dist = parseFloat(obj.close_approach_data[0].miss_distance.lunar);
    return dist < closestSoFar.dist ? { obj, dist } : closestSoFar;
  }, { obj: null, dist: Infinity }).obj;

  const approach = closest.close_approach_data[0];
  const diameter = closest.estimated_diameter.meters;
  const avgDiameter = Math.round((diameter.estimated_diameter_min + diameter.estimated_diameter_max) / 2);
  const mph = Math.round(parseFloat(approach.relative_velocity.miles_per_hour));
  const lunar = parseFloat(approach.miss_distance.lunar).toFixed(1);

  document.getElementById('neo-name').textContent = closest.name;
  document.getElementById('neo-distance').textContent = lunar;
  document.getElementById('neo-diameter').textContent = avgDiameter.toLocaleString('en-US');
  document.getElementById('neo-speed').textContent = mph.toLocaleString('en-US');
  document.getElementById('neo-hazard-badge').hidden = !closest.is_potentially_hazardous_asteroid;
  document.getElementById('neo-alert').textContent = `${objects.length} tracked today`;
}

// ---------- EPIC (Earth Polychromatic Imaging Camera) ----------
//
// EPIC's own API host, not proxied through api.nasa.gov — no key needed.

const EPIC_URL = 'https://epic.gsfc.nasa.gov/api/natural';

async function loadEPIC() {
  try {
    const res = await fetch(EPIC_URL);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) throw new Error('No EPIC images available');
    renderEPIC(data[data.length - 1]);
  } catch (err) {
    console.error('EPIC fetch failed:', err);
  }
}

function renderEPIC(entry) {
  const [datePart] = entry.date.split(' ');
  const [year, month, day] = datePart.split('-');
  const img = document.getElementById('epic-image');
  img.src = `https://epic.gsfc.nasa.gov/archive/natural/${year}/${month}/${day}/jpg/${entry.image}.jpg`;
  img.alt = `Earth, imaged by NASA's EPIC camera on ${datePart}`;
}

// ---------- idle / wake cycle ----------
//
// Simulates the shelter's motion sensor with mouse/touch/keyboard activity —
// swap the listeners below for a real PIR/ultrasonic sensor signal on a
// physical install. Each time the sign wakes up from idle (not on every
// twitch while already awake), it cycles to the next screen: APOD photo →
// space weather → EPIC Earth image → near-Earth objects → back to APOD.

const IDLE_TIMEOUT_MS = 8000;
const MODE_ORDER = ['apod', 'wx', 'epic', 'neo'];
let idleTimer;
let mode = 'apod';

function wake() {
  const wasIdle = document.body.classList.contains('is-idle');
  document.body.classList.remove('is-idle');
  clearTimeout(idleTimer);
  idleTimer = setTimeout(goIdle, IDLE_TIMEOUT_MS);
  if (wasIdle) toggleMode();
}

function goIdle() {
  document.body.classList.add('is-idle');
}

function toggleMode() {
  mode = MODE_ORDER[(MODE_ORDER.indexOf(mode) + 1) % MODE_ORDER.length];
  document.body.classList.remove('mode-wx', 'mode-neo', 'mode-epic');
  if (mode !== 'apod') document.body.classList.add('mode-' + mode);
}

function startIdleCycle() {
  ['mousemove', 'touchstart', 'touchmove', 'keydown', 'click', 'scroll'].forEach((evt) => {
    window.addEventListener(evt, wake, { passive: true });
  });
  idleTimer = setTimeout(goIdle, IDLE_TIMEOUT_MS);
}

// ---------- boot ----------

loadAPOD();
loadSpaceWeather();
loadSolarWind();
loadNEO();
loadEPIC();
setInterval(loadAPOD, REFRESH_MS);
setInterval(loadSpaceWeather, REFRESH_MS);
setInterval(loadSolarWind, WIND_REFRESH_MS);
setInterval(loadNEO, REFRESH_MS);
setInterval(loadEPIC, REFRESH_MS);
startIdleCycle();
