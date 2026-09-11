// Look Up — a ceiling sign for a bus shelter, showing NASA's live sky and
// space weather data.
//
// Swap in your own free key from https://api.nasa.gov before leaving this
// running long-term — DEMO_KEY is capped at 30 requests/hour, 50/day, shared
// by everyone using it.
const API_KEY = 'krkXh9ELpInytug2kH4D3QNwdJ1dkgEYfI0i1njL';

const APOD_URL = `https://api.nasa.gov/planetary/apod?api_key=${API_KEY}`;
const REFRESH_MS = 60 * 60 * 1000; // recheck hourly so an always-on kiosk rolls to the new day

// ---------- Astronomy Picture of the Day ----------

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

  document.getElementById('apod-title').textContent = data.title;
  document.getElementById('apod-excerpt').textContent = data.explanation;

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
  const oculus = document.getElementById('oculus');
  oculus.classList.add('show-fallback');
  document.getElementById('apod-title').textContent = 'Signal lost';
  document.getElementById('apod-excerpt').textContent =
    "Couldn't reach today's sky. Check the connection, or visit apod.nasa.gov directly.";
  console.error('APOD fetch failed:', err);
}

// ---------- Live clock (local time — not tied to any API) ----------

function startClock() {
  const timeEl = document.getElementById('clock-time');
  const dateEl = document.getElementById('clock-date');

  function tick() {
    const now = new Date();
    const locale = LOCALES[currentLang];
    timeEl.textContent = now.toLocaleTimeString(locale, {
      hour: '2-digit',
      minute: '2-digit',
    });
    dateEl.textContent = now
      .toLocaleDateString(locale, { weekday: 'short', month: 'short', day: '2-digit' })
      .toUpperCase();
  }

  clockTick = tick;
  tick();
  setInterval(tick, 1000);
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
  const block = document.querySelector('.wx-block');
  const { startDate, endDate } = donkiDateRange(3);
  const url = `https://api.nasa.gov/DONKI/notifications?startDate=${startDate}&endDate=${endDate}&type=all&api_key=${API_KEY}`;

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    renderSpaceWeather(data);
  } catch (err) {
    block.classList.add('has-error');
    document.getElementById('wx-alert').textContent =
      "Couldn't reach DONKI. See ccmc.gsfc.nasa.gov/tools/DONKI directly.";
    console.error('DONKI fetch failed:', err);
  }
}

function renderSpaceWeather(notifications) {
  const block = document.querySelector('.wx-block');
  block.classList.remove('has-error');

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
  const block = document.querySelector('.wx-block');
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
    block.classList.add('has-error');
    document.getElementById('wind-speed').textContent = '—';
    document.getElementById('wind-bz').textContent = '—';
    console.error('Solar wind fetch failed:', err);
  }
}

function renderSolarWind(mag, speed) {
  const block = document.querySelector('.wx-block');
  block.classList.remove('has-error');

  const mph = Math.round(speed.proton_speed * KM_S_TO_MPH);
  document.getElementById('wind-speed').textContent = mph.toLocaleString('en-US');

  const bz = mag.bz_gsm;
  document.getElementById('wind-bz').textContent = (bz > 0 ? '+' : '') + bz;
  const isSouth = bz < -2; // southward field: more likely to spark aurora
  block.classList.toggle('is-south', isSouth);
  document.getElementById('aurora-badge').hidden = !isSouth;
}

// ---------- idle / wake cycle ----------
//
// Simulates the shelter's motion sensor with mouse/touch/keyboard activity —
// swap the listeners below for a real PIR/ultrasonic sensor signal on a
// physical install.

const IDLE_TIMEOUT_MS = 8000;
let idleTimer;

function wake() {
  document.body.classList.remove('is-idle');
  clearTimeout(idleTimer);
  idleTimer = setTimeout(goIdle, IDLE_TIMEOUT_MS);
}

function goIdle() {
  document.body.classList.add('is-idle');
}

function startIdleCycle() {
  ['mousemove', 'touchstart', 'touchmove', 'keydown', 'click', 'scroll'].forEach((evt) => {
    window.addEventListener(evt, wake, { passive: true });
  });
  idleTimer = setTimeout(goIdle, IDLE_TIMEOUT_MS);
}

// ---------- English/Spanish slideshow ----------
//
// Only the static sign chrome (headline, labels, units, credit, idle hint)
// swaps language. The live NASA content — image title, description, space
// weather alert text — comes back from NASA in English and stays that way;
// translating that reliably would need a separate translation API.

const LANG_INTERVAL_MS = 10000;
const LANG_FADE_MS = 700; // matches the .i18n transition duration in style.css
const LOCALES = { en: 'en-US', es: 'es-ES' };

const TRANSLATIONS = {
  en: {
    headline: 'HELLO',
    'credit-label': 'Image &amp; text:',
    'credit-source': 'NASA Astronomy Picture of the Day',
    'wx-label': 'Cosmic Meteorology',
    'wind-unit': 'mph solar wind',
    'bz-unit': 'nT Bz',
    'idle-hint': '&middot; movement wakes this sign &middot;',
  },
  es: {
    headline: 'HOLA',
    'credit-label': 'Imagen y texto:',
    'credit-source': 'Foto Astronómica del Día de la NASA',
    'wx-label': 'Meteorología Cósmica',
    'wind-unit': 'mph viento solar',
    'bz-unit': 'nT Bz',
    'idle-hint': '&middot; el movimiento despierta este letrero &middot;',
  },
};

let currentLang = 'en';
let clockTick = null;

function applyLanguage(lang) {
  const strings = TRANSLATIONS[lang];
  Object.keys(strings).forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.add('is-swapping');
    setTimeout(() => {
      el.innerHTML = strings[id];
      el.classList.remove('is-swapping');
    }, LANG_FADE_MS);
  });
  currentLang = lang;
  if (clockTick) clockTick();
}

function startLanguageCycle() {
  setInterval(() => {
    applyLanguage(currentLang === 'en' ? 'es' : 'en');
  }, LANG_INTERVAL_MS);
}

// ---------- boot ----------

startClock();
loadAPOD();
loadSpaceWeather();
loadSolarWind();
setInterval(loadAPOD, REFRESH_MS);
setInterval(loadSpaceWeather, REFRESH_MS);
setInterval(loadSolarWind, WIND_REFRESH_MS);
startIdleCycle();
startLanguageCycle();
