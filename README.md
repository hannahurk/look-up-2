# Look Up

A ceiling sign concept for a bus shelter — the interior roof panel above the bench shows NASA's Astronomy Picture of the Day, framed as a skylight, alongside live space weather and a local clock.

## Live data

- **Sky image** — [NASA's Astronomy Picture of the Day API](https://api.nasa.gov)
- **Space weather alert** — [NASA DONKI](https://ccmc.gsfc.nasa.gov/tools/DONKI/)
- **Solar wind speed & Bz** — [NOAA SWPC](https://www.swpc.noaa.gov/), no API key required
- **Clock** — the viewer's local system time, not tied to any API

All three panels refresh automatically (APOD hourly, DONKI hourly, solar wind every minute).

## Features

- **Idle / wake cycle** — the sign dims to a resting state after a few seconds of no activity, then wakes on movement. Mouse/touch/keyboard activity stands in for a real PIR or ultrasonic motion sensor on a physical installation.
- **English / Spanish slideshow** — the static sign chrome (headline, labels, units, credit, idle hint) alternates between English and Spanish every 10 seconds with a crossfade. The live NASA content itself stays in English, since translating that reliably needs a separate translation API.
- **Aurora watch badge** — a non-color cue appears alongside the solar wind reading when the interplanetary magnetic field turns southward (more likely to spark visible aurora).

## Running it

This is a plain static site — no build step. Open `index.html` directly, or serve the folder with anything static (`python3 -m http.server`, GitHub Pages, Vercel, etc.).

Before leaving it running long-term, swap the placeholder `DEMO_KEY` in `script.js` for your own free key from [api.nasa.gov](https://api.nasa.gov) — the shared demo key is capped at 30 requests/hour.

## Files

- `index.html` — markup
- `style.css` — all styling, including the light/dark-agnostic dark theme, idle/wake transitions, and the language-swap fade
- `script.js` — data fetching, the clock, the idle/wake cycle, and the language cycle
