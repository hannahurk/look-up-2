# Space, Translated

A full-screen generative artwork, rendered on the HTML Canvas, that translates live NASA space-weather and near-Earth-object data into slow, ambient motion — not a dashboard, not a literal solar-system diagram.

## What's driving it

A Vercel serverless function (`api/nasa-data.js`) is the only thing that talks to NASA. It holds the real API key server-side (`process.env.NASA_API_KEY`, never sent to the browser), requests four endpoints in parallel with `Promise.allSettled` so one failure doesn't block the rest, and returns a small normalized payload:

- [`neo/rest/v1/feed`](https://api.nasa.gov) — today's near-Earth objects
- [`DONKI/FLR`](https://api.nasa.gov) — solar flares, trailing ~7 days
- [`DONKI/CME`](https://api.nasa.gov) — coronal mass ejections, trailing ~7 days
- [`DONKI/GST`](https://api.nasa.gov) — geomagnetic storms, trailing ~7 days

The browser (`app.js`) fetches `/api/nasa-data`, never NASA directly, and re-fetches every 10 minutes.

## How the data reads as motion

- **Solar-flare intensity** (peak flare class × magnitude in the window) sets the atmospheric core's brightness and radius.
- **CME speed** (average, km/s) sets particle velocity and trail length.
- **Geomagnetic intensity** (max Kp / 9) sets turbulence in the flow field the particles and ribbons follow.
- **Number of space-weather events** (flares + CMEs, plus a bump for any storm) sets particle density.
- **Each tracked asteroid** becomes one orbiting body.
  - Diameter → body size
  - Velocity → orbital speed
  - Miss distance → orbital radius
- **Potentially hazardous asteroids**, and generally elevated conditions (an X-class flare or Kp ≥ 5), bring in a restrained amber tint — never a saturated warning color.

Displayed values ease toward the latest fetched numbers rather than snapping, so a data refresh never looks abrupt.

## If NASA is unreachable

The scene keeps running on whatever it last had (or a quiet neutral default on first load) — it never blocks on the network or shows an error state. The only indicator is a single small dot in the bottom-right corner: dim gray when no source is live, soft teal when at least one is. There are no numeric displays or panels.

## Files

- `index.html` — the canvas element, the grain overlay, and the status dot
- `style.css` — full-viewport layout, the CSS/SVG grain texture, and status-dot styling
- `app.js` — the generative art engine: starfield, atmospheric core, flowing ribbons, fine particle streams, orbital paths and bodies, and the data-fetch/fallback logic
- `api/nasa-data.js` — the Vercel serverless function that fetches and normalizes the NASA data

No React, TypeScript, build tooling, or npm packages — plain HTML/CSS/JS, deployed as-is.

## Setup

Set `NASA_API_KEY` in the Vercel project's environment variables (Project Settings → Environment Variables) to your own key from [api.nasa.gov](https://api.nasa.gov). It's read only inside `api/nasa-data.js`; nothing in the repo needs to contain it.
