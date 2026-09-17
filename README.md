# Space, Translated

A ceiling sign that cycles through four full-screen views of live NASA data: today's Astronomy Picture of the Day, a space-weather readout, a live Earth image, and "Algorithm Art" — a generative canvas piece that translates the same live space-weather and near-Earth-object data into slow, ambient motion (not a dashboard, not a literal solar-system diagram).

## What's driving it

A Vercel serverless function (`api/nasa-data.js`) is the only thing that holds the real NASA API key (`process.env.NASA_API_KEY`, never sent to the browser). It requests five endpoints in parallel with `Promise.allSettled` — so one failure never blocks the rest — and returns a small normalized payload:

- [`planetary/apod`](https://api.nasa.gov) — today's Astronomy Picture of the Day
- [`neo/rest/v1/feed`](https://api.nasa.gov) — today's near-Earth objects
- [`DONKI/FLR`](https://api.nasa.gov) — solar flares, trailing ~7 days
- [`DONKI/CME`](https://api.nasa.gov) — coronal mass ejections, trailing ~7 days
- [`DONKI/GST`](https://api.nasa.gov) — geomagnetic storms, trailing ~7 days

Two more sources don't need a key at all, so `app.js` fetches them directly: [NASA's EPIC API](https://epic.gsfc.nasa.gov/) (Earth imagery) and [NOAA SWPC](https://www.swpc.noaa.gov/) (real-time solar wind). The browser never talks to `api.nasa.gov` itself — only `/api/nasa-data`, EPIC, and NOAA.

## The four screens

Each time the sign wakes from idle (not on every twitch while already awake), it advances: **APOD photo → Cosmic Meteorology → EPIC Earth image → Algorithm Art → back to APOD.**

- **APOD** — full-bleed image or video, whichever NASA published today.
- **Cosmic Meteorology** — NOAA solar wind speed and Bz (live, updated every minute), an aurora-watch badge when the field turns southward, and a one-line summary of the week's flare/CME/storm activity.
- **EPIC** — the most recent full-disk photo of Earth from the DSCOVR satellite.
- **Algorithm Art** — see below.

## How the data reads as motion (Algorithm Art)

- **Solar-flare intensity** (peak flare class × magnitude in the window) sets the atmospheric core's brightness and radius.
- **CME speed** (average, km/s) sets particle velocity and trail length.
- **Geomagnetic intensity** (max Kp / 9) sets turbulence in the flow field the ribbons follow.
- **Number of space-weather events** (flares + CMEs, plus a bump for any storm) sets particle density.
- **Each tracked asteroid** becomes one orbiting body.
  - Diameter → body size
  - Velocity → orbital speed
  - Miss distance → orbital radius
- **Potentially hazardous asteroids**, and generally elevated conditions (an X-class flare or Kp ≥ 5), bring in a restrained amber tint — never a saturated warning color.

Displayed values ease toward the latest fetched numbers rather than snapping, so a data refresh never looks abrupt. The canvas keeps running continuously in the background even while a different screen is showing, so Algorithm Art is always mid-motion when the cycle reaches it.

## If NASA is unreachable

Every screen keeps running on whatever it last had (or a quiet neutral default on first load) — nothing blocks on the network or shows an error state. The only indicator is a single small dot in the bottom-right corner: dim gray when no source is live, soft teal when at least one is. There are no numeric error displays or panels.

## Files

- `index.html` — markup for all four screens plus the canvas and status dot
- `style.css` — full-viewport layout, the weather "stat screen" style, the canvas/grain styling, and the mode-switching + idle/wake transitions
- `app.js` — fetches and renders APOD, EPIC, solar wind, and Cosmic Meteorology; runs the Algorithm Art generative engine; and drives the four-way idle/wake cycle
- `api/nasa-data.js` — the Vercel serverless function that fetches and normalizes APOD, NEO, and DONKI data

No React, TypeScript, build tooling, or npm packages — plain HTML/CSS/JS, deployed as-is.

## Setup

Set `NASA_API_KEY` in the Vercel project's environment variables (Project Settings → Environment Variables) to your own key from [api.nasa.gov](https://api.nasa.gov). It's read only inside `api/nasa-data.js`; nothing in the repo needs to contain it.
