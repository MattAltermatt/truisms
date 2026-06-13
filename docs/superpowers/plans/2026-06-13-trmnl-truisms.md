# Truisms TRMNL Plugin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a static TRMNL plugin that displays one of 132 Jenny Holzer truisms in a 400×240 quadrant, shuffled each refresh, attributed with a small credit line.

**Architecture:** Arch 1 (static data + smart template). GitHub Pages serves a static `truisms.json`. TRMNL polls it and renders a Liquid template (server-side) that picks one truism from the clock, auto-sizes it, and adds the credit line. A pure-JS module (`lib/picker.js`) is the single source of truth for the pick + sizing logic, unit-tested with vitest and reused by the local preview (`index.html`); the Liquid template mirrors the same constants.

**Tech Stack:** Static HTML/CSS, TRMNL Liquid templating, vanilla ES modules, vitest (dev-only), GitHub Pages.

---

## File Structure

```text
truisms.json                 Generated static data: { "items": [ …132… ] }
scripts/generate-json.mjs    txt → json generator + validator (reproducible)
lib/picker.js                pickIndex() + fontSizePx() + constants (source of truth)
lib/picker.test.js           vitest unit tests for picker
package.json                 type:module, vitest devDep, test/serve scripts
index.html                   local browser preview (400×240 quadrant, cycles all 132)
template/quadrant.html       TRMNL Liquid template (mirrors picker constants)
README.md                    setup + editing + TRMNL dashboard instructions
.nojekyll                    disable Jekyll on GitHub Pages
.gitignore                   (exists) .DS_Store .remember/ .claude/ node_modules/
truisms.txt                  (exists) source list — kept for regeneration
docs/superpowers/specs/2026-06-13-trmnl-truisms-design.md   (exists) design
docs/superpowers/plans/2026-06-13-trmnl-truisms.md          this plan
```

**Picker contract (used by every task that touches selection/sizing):**
- `SHUFFLE_K = 97` — a prime coprime to 132. Makes `(s * K) % size` a bijection over a full 132-second cycle, so every truism is reachable and the index never freezes on a constant.
- `pickIndex(epochSeconds, size)` → `(epochSeconds * SHUFFLE_K) % size`.
- `fontSizePx(text)` → px by total length: `≤25→46`, `≤40→36`, `≤55→29`, else `24`. (Starting points; tuned against Chrome in Task 7.)

---

### Task 1: Scaffold + generate `truisms.json`

**Files:**
- Create: `package.json`
- Create: `scripts/generate-json.mjs`
- Create: `truisms.json` (output of the script)
- Test: validation is built into the script (asserts + exit code)

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "truisms",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "vitest run",
    "gen": "node scripts/generate-json.mjs",
    "serve": "python3 -m http.server 8080"
  },
  "devDependencies": {
    "vitest": "^2.1.0"
  }
}
```

- [ ] **Step 2: Install vitest**

Run: `npm install`
Expected: creates `node_modules/` (gitignored) and `package-lock.json`.

- [ ] **Step 3: Write `scripts/generate-json.mjs`**

```js
// Reads truisms.txt → writes truisms.json as { "items": [...] }.
// Validates: non-empty lines, no blanks, expected count. Exits non-zero on failure.
import { readFileSync, writeFileSync } from 'node:fs';

const EXPECTED_COUNT = 132;

const raw = readFileSync(new URL('../truisms.txt', import.meta.url), 'utf8');
const items = raw.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);

if (items.length !== EXPECTED_COUNT) {
  console.error(`Expected ${EXPECTED_COUNT} truisms, got ${items.length}`);
  process.exit(1);
}
if (items.some((l) => l !== l.trim() || l.length === 0)) {
  console.error('Found blank or untrimmed line');
  process.exit(1);
}

const json = JSON.stringify({ items }, null, 2) + '\n';
writeFileSync(new URL('../truisms.json', import.meta.url), json);
console.log(`Wrote truisms.json with ${items.length} items`);
```

- [ ] **Step 4: Run the generator**

Run: `npm run gen`
Expected: `Wrote truisms.json with 132 items`

- [ ] **Step 5: Sanity-check the JSON parses and counts**

Run: `node -e "const d=require('fs').readFileSync('truisms.json','utf8');const j=JSON.parse(d);if(j.items.length!==132)process.exit(1);console.log('OK',j.items.length, JSON.stringify(j.items[0]))"`
Expected: `OK 132 "CHANGE IS VALUABLE BECAUSE IT LETS THE OPPRESSED BE TYRANTS"`

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json scripts/generate-json.mjs truisms.json
git commit -m "Generate truisms.json from source list"
```

---

### Task 2: `pickIndex` (clock-shuffle) with tests

**Files:**
- Create: `lib/picker.js`
- Create: `lib/picker.test.js`

- [ ] **Step 1: Write the failing test**

```js
// lib/picker.test.js
import { describe, it, expect } from 'vitest';
import { pickIndex, SHUFFLE_K } from './picker.js';

describe('pickIndex', () => {
  it('returns an integer within [0, size)', () => {
    for (const s of [0, 1, 42, 1718000000, 1718000123]) {
      const idx = pickIndex(s, 132);
      expect(Number.isInteger(idx)).toBe(true);
      expect(idx).toBeGreaterThanOrEqual(0);
      expect(idx).toBeLessThan(132);
    }
  });

  it('is a bijection over one full cycle (no freeze, all reachable)', () => {
    const seen = new Set();
    for (let s = 0; s < 132; s++) seen.add(pickIndex(s, 132));
    expect(seen.size).toBe(132);
  });

  it('changes between consecutive seconds', () => {
    for (const s of [0, 100, 1718000000]) {
      expect(pickIndex(s, 132)).not.toBe(pickIndex(s + 1, 132));
    }
  });

  it('uses a multiplier coprime to 132', () => {
    const gcd = (a, b) => (b === 0 ? a : gcd(b, a % b));
    expect(gcd(SHUFFLE_K, 132)).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/picker.test.js`
Expected: FAIL — cannot resolve `./picker.js` / exports undefined.

- [ ] **Step 3: Write minimal implementation**

```js
// lib/picker.js
export const SHUFFLE_K = 97; // prime, coprime to 132 — bijective shuffle, no freeze

export function pickIndex(epochSeconds, size) {
  return (epochSeconds * SHUFFLE_K) % size;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/picker.test.js`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/picker.js lib/picker.test.js
git commit -m "Add clock-shuffle pickIndex with tests"
```

---

### Task 3: `fontSizePx` (auto-fit buckets) with tests

**Files:**
- Modify: `lib/picker.js`
- Modify: `lib/picker.test.js`

- [ ] **Step 1: Write the failing test (append to picker.test.js)**

```js
import { fontSizePx } from './picker.js';

describe('fontSizePx', () => {
  it('buckets by total length at the documented boundaries', () => {
    expect(fontSizePx('x'.repeat(18))).toBe(46); // HUMOR IS A RELEASE
    expect(fontSizePx('x'.repeat(25))).toBe(46);
    expect(fontSizePx('x'.repeat(26))).toBe(36);
    expect(fontSizePx('x'.repeat(40))).toBe(36);
    expect(fontSizePx('x'.repeat(41))).toBe(29);
    expect(fontSizePx('x'.repeat(55))).toBe(29);
    expect(fontSizePx('x'.repeat(56))).toBe(24);
    expect(fontSizePx('x'.repeat(62))).toBe(24); // longest truism
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/picker.test.js`
Expected: FAIL — `fontSizePx` is not exported.

- [ ] **Step 3: Add the implementation to `lib/picker.js`**

```js
// Auto-fit by total character count. Starting points; tuned in Chrome (Task 7).
export function fontSizePx(text) {
  const n = text.length;
  if (n <= 25) return 46;
  if (n <= 40) return 36;
  if (n <= 55) return 29;
  return 24;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run`
Expected: PASS (all picker tests).

- [ ] **Step 5: Commit**

```bash
git add lib/picker.js lib/picker.test.js
git commit -m "Add fontSizePx auto-fit buckets with tests"
```

---

### Task 4: Local preview `index.html`

**Files:**
- Create: `index.html`

- [ ] **Step 1: Write `index.html`**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Truisms — TRMNL plugin preview</title>
  <link rel="stylesheet" href="https://trmnl.com/css/latest/plugins.css">
  <style>
    body {
      margin: 0; min-height: 100vh;
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      gap: 24px; padding: 40px 20px; background: #f3f4f6;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      color: #1f2937;
    }
    .device {
      width: 400px; height: 240px; background: white;
      border-radius: 12px; overflow: hidden;
      box-shadow: 0 8px 32px rgba(0,0,0,0.12), 0 2px 6px rgba(0,0,0,0.08);
    }
    .quad {
      width: 100%; height: 100%; box-sizing: border-box;
      padding: 18px 20px 10px;
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
    }
    #hero {
      flex: 1 1 auto; display: flex; align-items: center; justify-content: center;
      text-align: center; font-weight: 800; line-height: 1.08;
      text-transform: uppercase; letter-spacing: 0.5px;
      overflow: hidden;
    }
    #credit {
      flex: 0 0 auto; font-size: 10px; letter-spacing: 1.5px;
      text-transform: uppercase; color: #111; opacity: 0.7;
      padding-top: 8px; border-top: 1px solid rgba(0,0,0,0.25);
      width: 100%; text-align: center;
    }
    .controls { display: flex; align-items: center; gap: 12px; font-size: 14px; }
    button {
      padding: 8px 16px; border: 1px solid #d1d5db; background: white;
      border-radius: 6px; cursor: pointer; font-size: 14px; font-family: inherit;
    }
    button:hover { background: #f9fafb; }
    #counter { min-width: 70px; text-align: center; font-variant-numeric: tabular-nums; }
    .footer { font-size: 12px; color: #6b7280; }
    .footer a { color: #6b7280; }
  </style>
</head>
<body>
  <div class="device trmnl">
    <div class="view view--quadrant">
      <div class="quad">
        <div id="hero">…</div>
        <div id="credit">Jenny Holzer · Truisms, 1984</div>
      </div>
    </div>
  </div>

  <div class="controls">
    <button onclick="prev()">← prev</button>
    <span id="counter">0 / 0</span>
    <button onclick="next()">next →</button>
    <button onclick="shuffle()">shuffle</button>
    <button onclick="live()">live</button>
  </div>

  <div class="footer">
    Live preview of the current truism.
    <a href="https://github.com/MattAltermatt/truisms" target="_blank">View source ↗</a>
  </div>

  <script type="module">
    import { pickIndex, fontSizePx } from './lib/picker.js';

    let items = [];
    let cursor = 0;

    function nowSeconds() { return Math.floor(Date.now() / 1000); }
    function liveIndex() { return pickIndex(nowSeconds(), items.length); }

    function render() {
      const text = items[cursor];
      const hero = document.getElementById('hero');
      hero.style.fontSize = fontSizePx(text) + 'px';
      hero.textContent = text;
      document.getElementById('counter').textContent = `${cursor + 1} / ${items.length}`;
    }

    window.prev = () => { if (items.length) { cursor = (cursor - 1 + items.length) % items.length; render(); } };
    window.next = () => { if (items.length) { cursor = (cursor + 1) % items.length; render(); } };
    window.shuffle = () => { if (items.length) { cursor = Math.floor(Math.random() * items.length); render(); } };
    window.live = () => { if (items.length) { cursor = liveIndex(); render(); } };

    fetch('./truisms.json')
      .then((r) => r.json())
      .then((data) => { items = data.items; cursor = liveIndex(); render(); })
      .catch((err) => { document.getElementById('hero').textContent = 'Failed to load.'; console.error(err); });
  </script>
</body>
</html>
```

- [ ] **Step 2: Serve and smoke-test in a browser**

Run: `npm run serve` (then open `http://localhost:8080/`)
Expected: the quadrant shows a truism and the credit line; prev/next/shuffle/live work; counter shows `N / 132`.

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "Add local preview (quadrant, cycles all 132)"
```

---

### Task 5: TRMNL Liquid template `template/quadrant.html`

**Files:**
- Create: `template/quadrant.html`

This mirrors the picker contract in Liquid (TRMNL has no module sharing). Keep
constants identical to `lib/picker.js`: `SHUFFLE_K = 97`, same length buckets.

- [ ] **Step 1: Write `template/quadrant.html`**

```liquid
{%- comment -%}
  Truisms — TRMNL quadrant (400×240).
  Picker mirrors lib/picker.js: idx = (epoch_seconds * 97) % items.size.
  97 is prime and coprime to 132 → bijective shuffle, never freezes.
  Font size buckets by total length (same thresholds as fontSizePx).
{%- endcomment -%}
{%- assign s = 'now' | date: '%s' | plus: 0 -%}
{%- assign idx = s | times: 97 | modulo: items.size -%}
{%- assign current = items[idx] -%}

{%- assign n = current | size -%}
{%- if n <= 25    -%}{%- assign fs = 46 -%}
{%- elsif n <= 40 -%}{%- assign fs = 36 -%}
{%- elsif n <= 55 -%}{%- assign fs = 29 -%}
{%- else          -%}{%- assign fs = 24 -%}{%- endif -%}

<div class="view view--quadrant">
  <div class="layout layout--col" style="height:100%;box-sizing:border-box;padding:18px 20px 10px;">
    <div class="layout layout--col layout--center" style="flex:1 1 auto;overflow:hidden;">
      <span class="value text--center"
            style="font-size:{{ fs }}px;font-weight:800;line-height:1.08;text-transform:uppercase;letter-spacing:0.5px;">{{ current | escape }}</span>
    </div>
    <div class="text--center"
         style="flex:0 0 auto;font-size:10px;letter-spacing:1.5px;text-transform:uppercase;opacity:0.7;padding-top:8px;border-top:1px solid rgba(0,0,0,0.25);">JENNY HOLZER &middot; TRUISMS, 1984</div>
  </div>
</div>
```

- [ ] **Step 2: Verify it references the same constants as `lib/picker.js`**

Check by eye: multiplier `97`, buckets `25 / 40 / 55`, px `46 / 36 / 29 / 24`. These MUST match `lib/picker.js` so preview and device render identically.

- [ ] **Step 3: Commit**

```bash
git add template/quadrant.html
git commit -m "Add TRMNL quadrant Liquid template"
```

---

### Task 6: README + `.nojekyll`

**Files:**
- Create: `README.md`
- Create: `.nojekyll`

- [ ] **Step 1: Create `.nojekyll`** (empty file)

```bash
touch .nojekyll
```

- [ ] **Step 2: Write `README.md`**

````markdown
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
````

- [ ] **Step 3: Commit**

```bash
git add README.md .nojekyll
git commit -m "Add README and .nojekyll"
```

---

### Task 7: Chrome verification + sizing tune

**Files:**
- Possibly modify: `lib/picker.js` (px values), `template/quadrant.html` (matching px)

This is a verification + tuning task — no new tests, but `npm test` must stay green.

- [ ] **Step 1: Start the server**

Run: `npm run serve` (background)
Open Chrome (chrome-devtools-mcp) to `http://localhost:8080/`.

- [ ] **Step 2: Walk all 132 truisms**

Click `next` through the full set (or script `cursor` via evaluate). Watch for:
- text overflowing the 400×240 box,
- collision with / overlap of the credit line,
- the longest (`IF YOU AREN'T POLITICAL YOUR PERSONAL LIFE SHOULD BE EXEMPLARY`, 62 chars) fitting,
- awkward single-word orphan wraps.

- [ ] **Step 3: Tune if needed**

If any bucket overflows, adjust the px in `fontSizePx` (`lib/picker.js`) AND the
matching `fs` values in `template/quadrant.html` — they must stay identical.
Re-run `npm test` (boundary tests may need px updates to match) and re-walk.

- [ ] **Step 4: Confirm tests still pass**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit any tuning**

```bash
git add lib/picker.js lib/picker.test.js template/quadrant.html
git commit -m "Tune quadrant font sizes to fit all 132"
```

---

### Task 8: Deploy (GitHub Pages + TRMNL) — gated

**Files:** none (infra). Push and GitHub write actions require explicit user approval per project rules.

- [ ] **Step 1: Create the GitHub repo** (ask before running)

```bash
gh repo create MattAltermatt/truisms --public --source=. --remote=origin --push
```

- [ ] **Step 2: FF-merge `feature/trmnl-truisms` → `main`** (after user verify)

Squash the feature branch into one commit, FF-merge to `main`, push `main`.

- [ ] **Step 3: Enable GitHub Pages**

In repo Settings → Pages → Source: `main` / root. Confirm
`https://mattaltermatt.github.io/truisms/truisms.json` serves the JSON.

- [ ] **Step 4: TRMNL dashboard** — follow README setup; validate live on device.

- [ ] **Step 5: Post-deploy validation**

Load the live preview URL, confirm the JSON endpoint returns 132 items, and
confirm the device shows a truism with the credit line.

---

## Self-Review

- **Spec coverage:** Arch 1 ✓ (Task 1,5), repo/files ✓ (all tasks), data shape ✓ (Task 1), clock-shuffle + no-freeze ✓ (Task 2,5), quadrant layout + buckets + credit line ✓ (Task 4,5), preview ✓ (Task 4), verification ✓ (Task 7), deployment ✓ (Task 8). No gaps.
- **Placeholder scan:** none — every code step has complete code; px/constants are concrete.
- **Type consistency:** `pickIndex(epochSeconds, size)`, `fontSizePx(text)`, `SHUFFLE_K`, `items` used consistently across `lib/picker.js`, `index.html`, and the Liquid template. Multiplier `97` and buckets `25/40/55 → 46/36/29/24` identical in JS and Liquid.
