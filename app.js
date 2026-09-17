// Space, Translated — a generative reading of live NASA space-weather and
// near-Earth-object data. All motion is driven by real measurements fetched
// from /api/nasa-data (a serverless proxy that holds the actual NASA key);
// this file never sees or requests a NASA key itself.

(function () {
  'use strict';

  const REFRESH_MS = 10 * 60 * 1000;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const canvas = document.getElementById('art');
  const ctx = canvas.getContext('2d');
  const statusEl = document.getElementById('status');
  const statusText = document.getElementById('status-text');

  let width = 0;
  let height = 0;
  let dpr = Math.min(window.devicePixelRatio || 1, 2);

  // ---------- small math helpers ----------

  function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }

  function mapRange(v, inMin, inMax, outMin, outMax) {
    if (inMax === inMin) return outMin;
    const t = clamp((v - inMin) / (inMax - inMin), 0, 1);
    return outMin + t * (outMax - outMin);
  }

  function logMapRange(v, inMin, inMax, outMin, outMax) {
    const lv = Math.log10(Math.max(v, 1));
    const lMin = Math.log10(Math.max(inMin, 1));
    const lMax = Math.log10(Math.max(inMax, 1));
    return mapRange(lv, lMin, lMax, outMin, outMax);
  }

  function hashString(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function makeRandom(seed) {
    let s = seed || 1;
    return function () {
      s ^= s << 13;
      s ^= s >>> 17;
      s ^= s << 5;
      s = s >>> 0;
      return s / 4294967295;
    };
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  // A soft, organic angle field built from layered sine waves — gives
  // ribbons and particle streams a curling, wind-like motion without
  // needing an external noise library.
  function flowAngle(x, y, t, turbulence) {
    const scale = 0.0016 + turbulence * 0.0026;
    return (
      Math.sin(x * scale + t) * Math.cos(y * scale * 1.3 - t * 0.7) * Math.PI +
      Math.sin((x + y) * scale * 0.5 - t * 0.35) * 0.6
    );
  }

  // ---------- data ----------

  const FALLBACK_DATA = {
    timestamp: null,
    sourceStatus: { neo: 'unavailable', flares: 'unavailable', cmes: 'unavailable', storms: 'unavailable' },
    spaceWeather: { flareCount: 0, flareIntensity: 0, cmeCount: 0, cmeSpeed: 0, geomagneticIntensity: 0, kpIndex: 0 },
    asteroids: [],
  };

  let latestData = FALLBACK_DATA;

  // Smoothed, currently-displayed values — these ease toward latestData's
  // numbers rather than jumping, so a data refresh never looks abrupt.
  const shown = { flareIntensity: 0, cmeSpeed: 0, geomagneticIntensity: 0 };

  function isAnyLive(sourceStatus) {
    return Object.values(sourceStatus).some((s) => s === 'live');
  }

  function updateStatus() {
    const live = isAnyLive(latestData.sourceStatus);
    statusEl.classList.toggle('is-live', live);
    statusText.textContent = live
      ? 'Live NASA data connected.'
      : 'Live data unavailable — showing a quiet fallback state.';
  }

  async function fetchData() {
    try {
      const res = await fetch('/api/nasa-data');
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      latestData = data;
      rebuildOrbits(data.asteroids || []);
    } catch (err) {
      // Keep whatever we last had (or the fallback) and just reflect the
      // degraded state in the status dot — the artwork keeps running.
      latestData = { ...latestData, sourceStatus: FALLBACK_DATA.sourceStatus };
      console.error('nasa-data fetch failed:', err);
    }
    updateStatus();
  }

  // ---------- scene state ----------

  let stars = [];
  let orbits = [];
  let ribbons = [];
  let fineParticles = [];

  const palette = {
    core: [96, 165, 220],
    ribbonBlue: [90, 140, 210],
    ribbonTeal: [90, 200, 185],
    amber: [214, 158, 92],
    star: [235, 240, 248],
  };

  function mix(c1, c2, t) {
    return [lerp(c1[0], c2[0], t), lerp(c1[1], c2[1], t), lerp(c1[2], c2[2], t)];
  }

  function rgba(c, a) {
    return `rgba(${c[0] | 0}, ${c[1] | 0}, ${c[2] | 0}, ${a})`;
  }

  function buildStars() {
    const count = Math.round((width * height) / 9000);
    const rand = makeRandom(42);
    stars = [];
    for (let i = 0; i < count; i++) {
      stars.push({
        x: rand() * width,
        y: rand() * height,
        r: 0.4 + rand() * 1.3,
        base: 0.25 + rand() * 0.55,
        phase: rand() * Math.PI * 2,
        speed: 0.15 + rand() * 0.25,
      });
    }
  }

  function coreCenter() {
    return { x: width * 0.44, y: height * 0.47 };
  }

  function rebuildOrbits(asteroids) {
    const maxRadius = Math.min(width, height) * 0.46;
    const minRadius = Math.min(width, height) * 0.14;

    const missDistances = asteroids.map((a) => a.missDistance).filter((v) => v > 0);
    const minMiss = missDistances.length ? Math.min(...missDistances) : 1;
    const maxMiss = missDistances.length ? Math.max(...missDistances) : 1;

    orbits = asteroids.map((a) => {
      const rand = makeRandom(hashString(a.id || a.name || String(Math.random())));
      const radius = a.missDistance > 0
        ? logMapRange(a.missDistance, Math.max(minMiss, 1), Math.max(maxMiss, minMiss + 1), minRadius, maxRadius)
        : lerp(minRadius, maxRadius, rand());
      const bodyRadius = a.diameter > 0 ? logMapRange(a.diameter, 5, 2000, 1.2, 3.6) : 1.8;
      const angularSpeed = a.velocity > 0 ? mapRange(a.velocity, 3000, 120000, 0.05, 0.32) : 0.1;

      return {
        radius,
        eccentricity: 0.55 + rand() * 0.25,
        tilt: rand() * Math.PI,
        angle: rand() * Math.PI * 2,
        angularSpeed: angularSpeed * (rand() < 0.5 ? -1 : 1),
        bodyRadius,
        hazardous: Boolean(a.hazardous),
      };
    });
  }

  function makeRibbon() {
    return {
      points: [{ x: Math.random() * width, y: Math.random() * height }],
      maxPoints: 90 + Math.floor(Math.random() * 50),
      teal: Math.random() < 0.5,
    };
  }

  function makeFineParticle() {
    // A shooting star: a fixed diagonal heading, not the curling flow field
    // the ribbons use — a brief straight streak with a bright head and a
    // fading tail, entering from an edge.
    const angle = Math.PI * 0.15 + (Math.random() - 0.5) * 0.4;
    const fromLeft = Math.random() < 0.5;
    return {
      x: fromLeft ? -20 - Math.random() * width * 0.3 : Math.random() * width,
      y: fromLeft ? Math.random() * height * 0.6 : -20 - Math.random() * height * 0.3,
      angle,
      length: 16 + Math.random() * 18,
      life: 0,
      maxLife: 45 + Math.random() * 35,
    };
  }

  function rebuildParticles() {
    ribbons = [];
    for (let i = 0; i < 6; i++) ribbons.push(makeRibbon());
    fineParticles = [];
  }

  function resize() {
    width = window.innerWidth;
    height = window.innerHeight;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    buildStars();
    rebuildOrbits(latestData.asteroids || []);
    rebuildParticles();
  }

  // ---------- drawing ----------

  function drawBackdrop() {
    ctx.fillStyle = '#0a0b0e';
    ctx.fillRect(0, 0, width, height);
  }

  function drawStars(t) {
    for (const s of stars) {
      const twinkle = 0.7 + 0.3 * Math.sin(t * s.speed + s.phase);
      ctx.beginPath();
      ctx.fillStyle = rgba(palette.star, s.base * twinkle);
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawCore(t, center, elevated) {
    const intensity = shown.flareIntensity;
    const normalized = clamp(logMapRange(intensity, 1, 10000, 0, 1), 0, 1);
    const radius = mapRange(normalized, 0, 1, Math.min(width, height) * 0.045, Math.min(width, height) * 0.085);
    const brightness = mapRange(normalized, 0, 1, 0.12, 0.26);
    const breathe = 1 + Math.sin(t * 0.12) * 0.04;

    const color = elevated ? mix(palette.core, palette.amber, 0.22) : palette.core;
    const outerRadius = radius * breathe * 2.4;
    const gradient = ctx.createRadialGradient(
      center.x, center.y, 0,
      center.x, center.y, outerRadius
    );
    gradient.addColorStop(0, rgba(color, brightness));
    gradient.addColorStop(0.35, rgba(color, brightness * 0.45));
    gradient.addColorStop(0.7, rgba(color, brightness * 0.12));
    gradient.addColorStop(1, rgba(color, 0));

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(center.x, center.y, outerRadius, 0, Math.PI * 2);
    ctx.fill();
  }

  function orbitPosition(orbit, center) {
    const x0 = Math.cos(orbit.angle) * orbit.radius;
    const y0 = Math.sin(orbit.angle) * orbit.radius * orbit.eccentricity;
    const cos = Math.cos(orbit.tilt);
    const sin = Math.sin(orbit.tilt);
    return {
      x: center.x + x0 * cos - y0 * sin,
      y: center.y + x0 * sin + y0 * cos,
    };
  }

  function drawOrbits(center, elevated) {
    for (const orbit of orbits) {
      ctx.save();
      ctx.translate(center.x, center.y);
      ctx.rotate(orbit.tilt);
      ctx.scale(1, orbit.eccentricity);
      ctx.beginPath();
      ctx.arc(0, 0, orbit.radius, 0, Math.PI * 2);
      ctx.strokeStyle = orbit.hazardous && elevated
        ? rgba(palette.amber, 0.12)
        : rgba(palette.star, 0.06);
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawBodies(dt, center, elevated) {
    for (const orbit of orbits) {
      orbit.angle += orbit.angularSpeed * dt * (reduceMotion ? 0.15 : 1);
      const pos = orbitPosition(orbit, center);
      const color = orbit.hazardous ? mix(palette.amber, palette.core, elevated ? 0.25 : 0.5) : palette.core;
      const alpha = orbit.hazardous ? 0.55 : 0.42;

      const glow = ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, orbit.bodyRadius * 2.2);
      glow.addColorStop(0, rgba(color, alpha));
      glow.addColorStop(1, rgba(color, 0));
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, orbit.bodyRadius * 2.2, 0, Math.PI * 2);
      ctx.fill();

      ctx.beginPath();
      ctx.fillStyle = rgba(color, Math.min(alpha + 0.25, 1));
      ctx.arc(pos.x, pos.y, orbit.bodyRadius, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Ribbons and fine particle streams keep an explicit short history of
  // recent positions and draw it as a fading stroked line — this reads as a
  // clean, controlled "flow" rather than relying on the canvas itself to
  // accumulate trails, which is difficult to keep both flowing and legible.

  function stepTrail(p, t, speed, turbulence) {
    const head = p.points[p.points.length - 1];
    const angle = flowAngle(head.x, head.y, t, turbulence);
    const next = { x: head.x + Math.cos(angle) * speed, y: head.y + Math.sin(angle) * speed };
    p.points.push(next);
    if (p.points.length > p.maxPoints) p.points.shift();
    return next.x < -60 || next.x > width + 60 || next.y < -60 || next.y > height + 60;
  }

  function drawRibbon(r, elevated) {
    const color = elevated
      ? mix(palette.ribbonBlue, palette.amber, 0.18)
      : r.teal ? palette.ribbonTeal : palette.ribbonBlue;
    const n = r.points.length;
    for (let i = 1; i < n; i++) {
      const a = r.points[i - 1];
      const b = r.points[i];
      const f = i / n;
      ctx.beginPath();
      ctx.strokeStyle = rgba(color, f * f * 0.32);
      ctx.lineWidth = 0.6 + f * 1.1;
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
  }

  function stepFineParticle(p, speed) {
    p.x += Math.cos(p.angle) * speed;
    p.y += Math.sin(p.angle) * speed;
    p.life++;
    return (
      p.life > p.maxLife || p.x < -60 || p.x > width + 60 || p.y < -60 || p.y > height + 60
    );
  }

  function drawFineParticle(p, elevated) {
    const lifeFrac = p.life / p.maxLife;
    const fadeIn = Math.min(lifeFrac / 0.12, 1);
    const fadeOut = 1 - Math.max((lifeFrac - 0.75) / 0.25, 0);
    const alpha = Math.min(fadeIn, fadeOut);
    if (alpha <= 0) return;

    const dx = Math.cos(p.angle);
    const dy = Math.sin(p.angle);
    const tailX = p.x - dx * p.length;
    const tailY = p.y - dy * p.length;
    const color = elevated ? mix(palette.star, palette.amber, 0.3) : palette.star;

    const gradient = ctx.createLinearGradient(tailX, tailY, p.x, p.y);
    gradient.addColorStop(0, rgba(color, 0));
    gradient.addColorStop(1, rgba(color, alpha * 0.75));
    ctx.strokeStyle = gradient;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(tailX, tailY);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();

    ctx.beginPath();
    ctx.fillStyle = rgba(color, alpha);
    ctx.arc(p.x, p.y, 1, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawParticles(t, elevated) {
    const speedScale = mapRange(shown.cmeSpeed, 0, 2500, 0.4, 1.7);
    const turbulence = shown.geomagneticIntensity;

    for (let i = ribbons.length - 1; i >= 0; i--) {
      const r = ribbons[i];
      const dead = stepTrail(r, t, 1.9 * speedScale, turbulence);
      drawRibbon(r, elevated);
      if (dead) ribbons[i] = makeRibbon();
    }

    const targetFine = Math.round(clamp(shown.eventDensity || 0, 0, 16));
    while (fineParticles.length < targetFine) fineParticles.push(makeFineParticle());
    while (fineParticles.length > targetFine) fineParticles.pop();

    for (let i = fineParticles.length - 1; i >= 0; i--) {
      const p = fineParticles[i];
      const dead = stepFineParticle(p, 2.4 * speedScale);
      drawFineParticle(p, elevated);
      if (dead) fineParticles[i] = makeFineParticle();
    }
  }

  // ---------- animation loop ----------

  let lastTime = performance.now();
  let clock = 0;

  function frame(now) {
    const dtMs = clamp(now - lastTime, 0, 64);
    lastTime = now;
    const dt = dtMs / 16.6667;
    clock += dt * (reduceMotion ? 0.002 : 0.006);

    shown.flareIntensity = lerp(shown.flareIntensity, latestData.spaceWeather.flareIntensity, 0.01);
    shown.cmeSpeed = lerp(shown.cmeSpeed, latestData.spaceWeather.cmeSpeed, 0.01);
    shown.geomagneticIntensity = lerp(shown.geomagneticIntensity, latestData.spaceWeather.geomagneticIntensity, 0.01);
    const eventDensityTarget =
      latestData.spaceWeather.flareCount + latestData.spaceWeather.cmeCount + (latestData.spaceWeather.kpIndex > 0 ? 6 : 0);
    shown.eventDensity = lerp(shown.eventDensity || 0, mapRange(eventDensityTarget, 0, 30, 1, 16), 0.01);

    const elevated =
      latestData.spaceWeather.flareIntensity >= 1000 || latestData.spaceWeather.kpIndex >= 5;

    const center = coreCenter();

    drawBackdrop();
    drawStars(clock * 40);
    drawParticles(clock * 60, elevated);
    drawCore(clock * 40, center, elevated);
    drawOrbits(center, elevated);
    drawBodies(reduceMotion ? dt * 0.15 : dt, center, elevated);

    requestAnimationFrame(frame);
  }

  // ---------- boot ----------

  window.addEventListener('resize', resize);
  resize();
  ctx.fillStyle = 'rgb(10, 11, 14)';
  ctx.fillRect(0, 0, width, height);

  fetchData();
  setInterval(fetchData, REFRESH_MS);

  requestAnimationFrame(frame);
})();
