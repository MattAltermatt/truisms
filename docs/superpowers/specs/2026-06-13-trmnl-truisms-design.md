# Truisms — TRMNL Plugin · Design

**Date:** 2026-06-13
**Status:** Approved
**Sibling:** Mirrors the architecture of the `affirmations` TRMNL plugin (Arch 1 — static data + Liquid template).

## Summary

A personal TRMNL e-ink display plugin that shows one of **132 Jenny Holzer
truisms** (a curated selection from *Truisms*, 1984) in a **quadrant
(400×240)** layout slot, attributed with a small credit line. The displayed
truism **shuffles every refresh**, with cadence governed entirely by the
TRMNL dashboard's refresh-interval setting. No backend of our own runs at
request time — the only hosted asset is a static JSON file on GitHub Pages.

## Goals

- Display a Jenny Holzer truism on a TRMNL device, full credit to the work.
- A fresh, shuffled-feeling truism on every device refresh.
- Cadence tunable from the TRMNL dashboard (refresh interval) without code
  changes or redeploys.
- Zero-maintenance hosting: a static file, no server to babysit.
- Every one of the 132 truisms renders legibly inside the 400×240 quadrant
  without overflowing or colliding with the credit line.

## Non-Goals

- True (cryptographic) randomness. A clock-derived pseudo-random shuffle is
  visually indistinguishable on a frame that repaints every 15+ minutes.
- Any server-side compute of ours (no Cloudflare Worker, no serverless
  function). Explicitly chose Arch 1 over Arch 2.
- No-immediate-repeat memory, weighting, or analytics (would require state /
  a backend — out of scope; noted as a future possibility only).
- Curation: the plugin uses the full provided selection of 132 as-is.

## Architecture (Arch 1 — static data + smart template)

```text
  ┌─────────────┐   polls every N min    ┌──────────────────┐
  │ GitHub Pages │ ◄───────────────────── │  TRMNL's servers │
  │  (static)    │ ──── returns JSON ───► │                  │
  │ truisms.json │                        │  Liquid template │
  └─────────────┘                         │  picks 1 + lays  │
                                          │  out → 1-bit BMP │
   quadrant.html pasted into ───────────► │       │          │
   TRMNL dashboard once                   └───────┼──────────┘
                                                  │ push image
                                                  ▼
                                          ┌──────────────┐
                                          │  e-ink device │
                                          └──────────────┘
```

- **GitHub Pages is static.** It returns the same `truisms.json` bytes every
  call; it runs no code at request time.
- **The picking logic lives in the Liquid template**, which runs on TRMNL's
  servers at render time and has access to `now`. This is where the shuffle
  happens — no compute of ours required.
- TRMNL hits the JSON only once per refresh interval per device, so load is
  negligible.

### Why not a backend (Arch 2)?

A serverless endpoint returning one random truism per call (true random) was
considered and rejected: it adds a function to deploy and keep alive for a
benefit (true RNG, future server smarts) that is imperceptible on this
display. Arch 1 needs nothing beyond a static file and matches the proven
affirmations pattern. (GitHub Pages running JS per request is *impossible* —
it has no request-time compute; client-side JS never runs because TRMNL is
not a browser and reads only the raw response bytes.)

## Repository & Files

New repo `MattAltermatt/truisms`, deployed via GitHub Pages.
Git identity (per-repo): `MattAltermatt <1435066+MattAltermatt@users.noreply.github.com>`.

```text
truisms.json                 { "items": [ …132 strings… ] }  — static data
template/quadrant.html       Liquid: pick + auto-fit + credit line
index.html                   local browser preview (cycles all 132)
README.md                    setup + editing instructions
.nojekyll                    disable Jekyll on GitHub Pages
.gitignore                   .DS_Store, .remember/, .claude/, node_modules/
docs/superpowers/specs/2026-06-13-trmnl-truisms-design.md  — this doc
truisms.txt                  source list (kept for reference / regeneration)
```

## Data

- Source: `truisms.txt` — 132 lines, no blanks, all-caps, alphabetical
  (CHANGE… → RESOLUTIONS…). Contains apostrophes (`AREN'T`, `DON'T`).
- Shortest: `HUMOR IS A RELEASE` (18 chars). Longest:
  `IF YOU AREN'T POLITICAL YOUR PERSONAL LIFE SHOULD BE EXEMPLARY` (62 chars).
- Transformed to `truisms.json` with shape `{ "items": [ … ] }` — identical
  to affirmations, so the Liquid access idiom carries over. Apostrophes are
  JSON-escaped in the file and rendered with Liquid `| escape`.

## Cadence — clock-shuffle, dashboard-tunable

The Liquid template derives the index from `now`:

- Read minutes-since-epoch from `now` (granularity: minutes — changes on
  essentially every refresh, since refreshes are minutes apart).
- Multiply by a constant **coprime to the list size** and take `modulo
  items.size`, so consecutive picks scatter across the list rather than
  marching `+1`.
- Choose the multiplier / effective cycle length to **avoid the freeze
  edge-case** (an index that stays constant when the refresh interval is an
  exact multiple of the cycle). Verified in tests by sampling a range of
  interval/offset combinations and asserting the index varies.

**Net behavior:** every refresh → a fresh, shuffled-feeling truism. *How
often* it changes is set by the dashboard refresh interval (15 min, 1 h, 6 h,
…) with no code change. Pseudo-random, deterministic from the clock.

Exact constants are an implementation detail resolved in the plan (with a
distribution/no-freeze test); the design fixes only the intent.

## Layout & Typography — quadrant 400×240

The substantive divergence from affirmations: long wrapping **sentences** in a
**small** box, not short phrases in a tall column. Sizing therefore buckets by
**total character count** (not longest unbreakable token):

```text
≤25 chars → largest    (e.g. "HUMOR IS A RELEASE")
≤40 chars → large
≤55 chars → medium
>55 chars → smallest   (e.g. the 62-char "IF YOU AREN'T… EXEMPLARY")
```

- All-caps (source already is), bold, centered, word-wrapped — honoring
  Holzer's flat declarative voice.
- A **small-font credit line pinned at the bottom**: `JENNY HOLZER · TRUISMS,
  1984`.
- Built on TRMNL's `plugins.css` classes (`view view--quadrant`, `layout`,
  `value …`, a small label/description class for the credit line), matching
  affirmations' construction.
- **Exact px per bucket are tuned against the live preview** so all 132 fit
  above the credit line — a verification gate, not guesswork. Thresholds above
  are the starting point and may be nudged during tuning.

## Preview (`index.html`)

A local browser preview that renders a **400×240 quadrant** device frame with:

- **prev / next / shuffle** controls.
- Cycles all 132 truisms using the **same bucket logic mirrored in JS**.
- Shows the credit line.

Purpose: eyeball-verify every truism fits before shipping. Mirrors
affirmations' `index.html` approach (fetch `truisms.json`, render, cycle).

## Testing & Verification

- Serve locally (`python3 -m http.server`), drive Chrome (chrome-devtools-mcp)
  through all 132 truisms.
- Confirm none overflow the 400×240 box or collide with the credit line; pay
  special attention to the longest (62 chars) and awkward wrappers.
- Assert (test or manual) the clock-shuffle index varies across refreshes and
  never freezes for common intervals.
- Validate `truisms.json` parses and has exactly 132 items.

## Deployment

1. Create repo `MattAltermatt/truisms`, set local git identity.
2. Commit files, push to `main`, enable GitHub Pages (root).
3. Polling URL: `https://mattaltermatt.github.io/truisms/truisms.json`.
4. In TRMNL dashboard: new Screen-Templating plugin, Polling strategy, paste
   `template/quadrant.html` into the **quadrant** tab, add to a playlist.
5. Validate live on device.

## Open Questions / Future (out of scope)

- No-immediate-repeat memory, weighting, or analytics → would require Arch 2
  (a worker). Noted only as a future path if ever wanted.
