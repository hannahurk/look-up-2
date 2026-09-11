# Look Up

A ceiling sign concept for a bus shelter — the interior roof panel above the bench shows NASA's Astronomy Picture of the Day, full-bleed, as if it were a skylight, with a small live space weather readout overlaid on top.

## Live data

- **Sky image / video** — [NASA's Astronomy Picture of the Day API](https://api.nasa.gov), refreshed hourly so an always-on kiosk rolls to the new day. Handles all three media types NASA returns: still images, hosted video files, and YouTube-embedded videos.
- **Space weather alert** — [NASA DONKI](https://ccmc.gsfc.nasa.gov/tools/DONKI/), refreshed hourly.
- **Solar wind speed & Bz** — [NOAA SWPC](https://www.swpc.noaa.gov/), no API key required, refreshed every minute.

## Features

- **Idle / wake cycle** — the image and weather panel dim to a resting state after a few seconds of no activity, then wake on movement. Mouse/touch/keyboard activity stands in for a real PIR or ultrasonic motion sensor on a physical installation.
- **Aurora watch badge** — a non-color cue appears alongside the solar wind reading when the interplanetary magnetic field turns southward (more likely to spark visible aurora).

## Running it

This is a plain static site — no build step. Open `index.html` directly, or serve the folder with anything static (`python3 -m http.server`, GitHub Pages, Vercel, etc.).

Before leaving it running long-term, swap the placeholder `DEMO_KEY` in `script.js` for your own free key from [api.nasa.gov](https://api.nasa.gov) — the shared demo key is capped at 30 requests/hour.

## Files

- `index.html` — markup
- `style.css` — full-bleed image styling, the weather panel, and the idle/wake dim transition
- `script.js` — fetches and renders today's APOD and space weather, and runs the idle/wake cycle
