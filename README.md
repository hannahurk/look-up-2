# Look Up

A ceiling sign concept for a bus shelter — the interior roof panel above the bench cycles through five full-bleed screens: NASA's Astronomy Picture of the Day, a space weather readout, a live Earth image, near-Earth object data, and Mars weather.

## Live data

- **Sky image / video** — [NASA's Astronomy Picture of the Day API](https://api.nasa.gov), refreshed hourly so an always-on kiosk rolls to the new day. Handles all three media types NASA returns: still images, hosted video files, and YouTube-embedded videos.
- **Space weather alert** — [NASA DONKI](https://ccmc.gsfc.nasa.gov/tools/DONKI/), refreshed hourly.
- **Solar wind speed & Bz** — [NOAA SWPC](https://www.swpc.noaa.gov/), no API key required, refreshed every minute.
- **Earth image** — [NASA's EPIC API](https://epic.gsfc.nasa.gov/) (its own host, no key needed), the most recent full-disk image of Earth from the DSCOVR satellite, refreshed hourly.
- **Near-Earth objects** — [NASA's NeoWs feed](https://api.nasa.gov), today's closest tracked asteroid approach: name, size, speed, miss distance (in lunar distances), and a hazard flag.
- **Mars weather** — [NASA's InSight weather API](https://api.nasa.gov). InSight's mission ended in December 2022, and this feed has been returning the same frozen October 2020 sols for a while now — there's no live Mars weather to show, so this screen displays InSight's last available reading and says plainly when it's from, rather than presenting stale data as current.

## Features

- **Idle / wake cycle** — the current screen dims to a resting state after a few seconds of no activity, then wakes on movement. Mouse/touch/keyboard activity stands in for a real PIR or ultrasonic motion sensor on a physical installation.
- **Five-screen cycle** — each time the sign wakes from idle (not on every twitch while already awake), it advances to the next screen: APOD photo → Cosmic Meteorology → EPIC Earth image → near-Earth object → Mars weather → back to APOD.
- **Aurora watch badge** — a non-color cue appears alongside the solar wind reading when the interplanetary magnetic field turns southward (more likely to spark visible aurora).

## Running it

This is a plain static site — no build step. Open `index.html` directly, or serve the folder with anything static (`python3 -m http.server`, GitHub Pages, Vercel, etc.).

Before leaving it running long-term, swap the placeholder `DEMO_KEY` in `script.js` for your own free key from [api.nasa.gov](https://api.nasa.gov) — the shared demo key is capped at 30 requests/hour. (EPIC doesn't use this key at all — it's fetched from its own host.)

## Files

- `index.html` — markup for all five screens
- `style.css` — full-bleed backdrop styling, the shared weather/NEO/Mars "stat screen" layout, and the mode-switching + idle/wake transitions
- `script.js` — fetches and renders APOD, space weather, EPIC, NEO, and Mars weather data, and runs the idle/wake cycle (including the five-way screen rotation)
