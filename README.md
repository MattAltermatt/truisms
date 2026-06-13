# Truisms — TRMNL Plugin

A personal TRMNL e-ink display plugin: one of **132 Jenny Holzer truisms**
(*Selections from Truisms, 1984*), shuffled on every refresh, shown in a
400×240 quadrant with attribution.

🌐 **Preview / landing:** https://mattaltermatt.github.io/truisms/
📡 **Polling URL:** https://mattaltermatt.github.io/truisms/truisms.json

## How it works

- `truisms.json` is a static list of 132 truisms hosted on GitHub Pages.
- The TRMNL backend polls the JSON URL on the configured refresh interval.
- A Liquid template (`template/quadrant.html`, pasted into the TRMNL dashboard)
  picks one truism from the clock — `idx = (epoch_seconds × 97) % 132` — auto-
  sizes it to fit, and adds the credit line. `97` is prime and coprime to 132,
  so the shuffle is bijective and never freezes.
- The device receives a BMP from the TRMNL backend and displays it.

**Cadence is set entirely by the dashboard refresh interval** — no code change
needed. Shorter interval = changes more often; longer = slower drip.

## Editing the truisms

1. Edit `truisms.txt` (one truism per line).
2. Run `npm run gen` to regenerate `truisms.json`.
3. Commit and push to `main`; GitHub Pages redeploys within ~1 minute.
4. TRMNL pulls the new JSON on its next refresh.

## TRMNL dashboard setup (one-time)

1. **+ New Plugin** → **Screen Templating**.
2. **Name:** `Truisms`. **Strategy:** Polling.
3. **Polling URL:** `https://mattaltermatt.github.io/truisms/truisms.json`
4. **Refresh interval:** your choice (this *is* the cadence knob).
5. Save → **Edit Markup** → **quadrant** tab → paste `template/quadrant.html`.
6. Save; confirm the preview renders today's truism.
   - If the preview is blank, the polling variable may be exposed under a
     different name than `items`. Check the variable sandbox and adjust the
     `items` reference at the top of the template (e.g. `data.items`).
7. Add the plugin to a Playlist (in a quadrant slot) assigned to your device.

## Local development

```bash
npm install
npm test          # vitest — picker + sizing unit tests
npm run serve     # http://localhost:8080/
```

Use prev / next / shuffle / live to cycle all 132 and verify rendering.
