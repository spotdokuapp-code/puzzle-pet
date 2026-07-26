# Leveling Core (v2 slice 1 of 4) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the bond care system with puzzle-XP leveling: a 29-threshold curve to level 30, XP from solves only, storage v3 with retroactive backfill, and level display on home, pet screen, and the win overlay.

**Architecture:** A new pure module `www/js/level.js` (PPLevel) replaces `www/js/bond.js` (PPBond, deleted at Task 5). Same IIFE + `module.exports` + lazy-config pattern as `generator.js`. XP lives at `pet.xp` (lifetime, never decreases); level is derived, with a stored `pet.levelHigh` high-water mark so a threshold retune can never demote a player — the ratchet lesson carried forward from the bond slice. `storage.js` bumps to `puzzlepet.v3` and migrates BOTH v1 and v2 saves by replaying the event log at the new XP values.

**Tech Stack:** Plain HTML/CSS/JS, no build step. Node unit tests, Playwright e2e.

**Source spec:** `docs/superpowers/specs/2026-07-25-pet-leveling-v2-level-30.md` (§0 context, §4 acceptance criteria, §5 curve, §10 migration). Supersedes the bond design.

**Out of scope (plans 2–4):** the level-up overlay, shop gating and the 37-item catalog, `AREAS`/room regions, `SPECIES_UNLOCKS`/friends switcher, and the 3-beat onboarding rework. This plan only *filters* the existing onboarding grid to cat/dog.

## Global Constraints

- **XP values verbatim from the spec:** daily 10/20/35 by slot, set bonus 15, free play 3. `LEVEL_XP` thresholds exactly as §5. Tuning is deferred — do not "improve" any number.
- **No new XP sources.** Feeding, petting, and visiting grant NO XP. Petting stays free and unlimited as an interaction; only its XP is gone.
- **XP never decays; no lost levels.** `pet.xp` is add-only; displayed level is floored at `pet.levelHigh`.
- **Level gates cosmetics only** — never a puzzle, the streak, coins, or energy.
- **XP granted only when a slot first flips to done** — same guard as coins; calendar back-fill pays identically.
- **All tunable numbers live in `config.js`.**
- **Every meaningful action appends to `state.events`.** Petting keeps its log entry even without XP.
- **Every pet referred to as "they"; species-neutral copy; no guilt or sadness.**
- **Existing saves migrate losslessly** — coins, pet identity, days, streak, owned items untouched; XP backfilled from history; migration runs exactly once.
- Environment: Playwright needs `PP_CHROMIUM="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"`.
- Expected red window: `test:app` fails from Task 3 until Task 7 rewrites it (same discipline as the bond slice). Node suites stay green throughout, except `test:bond` which is deleted with `bond.js` at Task 5.

## File Structure

| File | Status | Responsibility |
|---|---|---|
| `www/js/config.js` | Modify | Add `XP_PAYOUTS`, `XP_SET_BONUS`, `XP_FREEPLAY`, `LEVEL_XP`, `ENABLED_SPECIES` (T1); remove `BOND_*` (T5) |
| `www/js/level.js` | Create | Curve math, display ratchet, XP lookup, backfill. Pure, Node-loadable. |
| `www/js/bond.js` | Delete (T5) | Superseded by level.js |
| `www/js/storage.js` | Modify | v3 key, `pet.xp`/`pet.levelHigh`, v1+v2→v3 migration |
| `www/index.html` | Modify | Level chip/meter ids, home XP bar, win-overlay XP line, script tags |
| `www/css/style.css` | Modify | Win XP mini bar, home thin bar |
| `www/js/app.js` | Modify | `awardXp`, `renderLevel`, petting/feed de-wiring, onboarding filter |
| `tests/level_test.js` | Create | Node tests for level.js |
| `tests/bond_test.js` | Delete (T5) | |
| `tests/app_test.spec.js` | Modify (T7) | Leveling e2e, two migration tests, 2-species onboarding |
| `package.json` | Modify | `test:level` added (T1), `test:bond` removed (T5) |

---

### Task 1: Config blocks and level curve math

**Files:**
- Modify: `www/js/config.js`
- Create: `www/js/level.js`
- Create: `tests/level_test.js`
- Modify: `package.json`

**Interfaces:**
- Consumes: nothing.
- Produces (later tasks and plans 2–4 rely on these exact names):
  - `PPConfig.XP_PAYOUTS`, `PPConfig.XP_SET_BONUS`, `PPConfig.XP_FREEPLAY`, `PPConfig.LEVEL_XP` (29 numbers), `PPConfig.ENABLED_SPECIES`
  - `PPLevel.CAP` → `30`
  - `PPLevel.thresholdFor(level) -> number` (cumulative XP to reach `level`; 0 for level 1; `Infinity` above CAP)
  - `PPLevel.levelForXp(xp) -> { level, base, next, into, needed, atCap }` (`next`/`needed` are `null` at cap)
  - `PPLevel.displayLevel(pet) -> number` (max of derived level and `pet.levelHigh` — the ratchet)
  - `PPLevel.xpFor(source, opts?) -> number` (sources `'daily'` {slot}, `'setBonus'`, `'freeplay'`; 0 for anything unrecognized, never NaN)

- [ ] **Step 1: Add the new config blocks**

In `www/js/config.js`, after the `SPECIES_BLURBS: {...}` block (add a comma after its closing `}`), insert:

```js
  // --- Leveling (v2). Puzzle XP only; values are spec-locked, tuning deferred. ---
  ENABLED_SPECIES: ['cat', 'dog'],   // onboarding roster; others return as unlocks (plan 4)
  XP_PAYOUTS: [10, 20, 35],          // daily easy / medium / hard
  XP_SET_BONUS: 15,                  // granted with the coin set bonus
  XP_FREEPLAY: 3,                    // intentionally weak; daily set stays best rate
  LEVEL_XP: [                        // cumulative XP to REACH L2..L30 (29 entries)
      60,   150,   270,   430,   630,   880,  1180,  1540,  1960,
    2340,  2730,  3130,  3540,  3960,  4390,  4830,  5280,  5740,  6210,
    6730,  7275,  7845,  8440,  9060,  9705, 10375, 11070, 11790, 12535
  ]
```

Leave every `BOND_*` block in place for now — `bond.js` still reads them until Task 5.

- [ ] **Step 2: Write the failing test**

Create `tests/level_test.js`:

```js
// Puzzle Pet — Node tests for the leveling system: the 30-level curve,
// boundary lookups, the display ratchet, XP sources, and event-log backfill.
require('../www/js/config.js');
const PPLevel = require('../www/js/level.js');
const C = globalThis.PPConfig;

let failures = 0;
function check(cond, msg) {
  if (!cond) { failures++; console.error('FAIL:', msg); }
}

// --- Shape: 29 thresholds, strictly increasing ---
check(C.LEVEL_XP.length === 29, 'LEVEL_XP has 29 entries');
for (let i = 1; i < C.LEVEL_XP.length; i++) {
  check(C.LEVEL_XP[i] > C.LEVEL_XP[i - 1], `LEVEL_XP increases at index ${i}`);
}
check(PPLevel.CAP === 30, 'CAP is 30');

// --- thresholdFor ---
check(PPLevel.thresholdFor(1) === 0, 'L1 costs 0');
check(PPLevel.thresholdFor(2) === C.LEVEL_XP[0], 'L2 threshold from config');
check(PPLevel.thresholdFor(30) === C.LEVEL_XP[28], 'L30 threshold from config');
check(PPLevel.thresholdFor(31) === Infinity, 'above cap is unreachable');

// --- levelForXp at every boundary: one below, exactly at, one above ---
C.LEVEL_XP.forEach((xp, i) => {
  const lv = i + 2;
  check(PPLevel.levelForXp(xp - 1).level === lv - 1, `xp ${xp - 1} is L${lv - 1}`);
  check(PPLevel.levelForXp(xp).level === lv, `xp ${xp} is L${lv}`);
  check(PPLevel.levelForXp(xp + 1).level === lv, `xp ${xp + 1} still L${lv}`);
});

// --- progress numbers mid-level ---
const mid = PPLevel.levelForXp(100);   // between L2 (60) and L3 (150)
check(mid.level === 2, 'xp 100 is L2');
check(mid.into === 40 && mid.needed === 90, 'xp 100 is 40/90 into L2');
check(mid.atCap === false, 'xp 100 not at cap');

// --- the cap ---
const capped = PPLevel.levelForXp(999999);
check(capped.level === 30 && capped.atCap === true, 'huge xp caps at L30');
check(capped.next === null && capped.needed === null, 'no next level at cap');

// --- displayLevel ratchet: a threshold retune can never demote ---
check(PPLevel.displayLevel({ xp: 100, levelHigh: 5 }) === 5, 'levelHigh floors display');
check(PPLevel.displayLevel({ xp: 100, levelHigh: 1 }) === 2, 'derived wins when higher');
check(PPLevel.displayLevel({ xp: 100 }) === 2, 'missing levelHigh defaults safely');

// --- xpFor ---
check(PPLevel.xpFor('daily', { slot: 0 }) === C.XP_PAYOUTS[0], 'daily slot 0');
check(PPLevel.xpFor('daily', { slot: 2 }) === C.XP_PAYOUTS[2], 'daily slot 2');
check(PPLevel.xpFor('setBonus') === C.XP_SET_BONUS, 'set bonus');
check(PPLevel.xpFor('freeplay') === C.XP_FREEPLAY, 'freeplay');
check(PPLevel.xpFor('feed', { item: 'cake' }) === 0, 'feeding grants no XP');
check(PPLevel.xpFor('visit') === 0, 'visiting grants no XP');
check(PPLevel.xpFor('pet') === 0, 'petting grants no XP');
check(PPLevel.xpFor('daily', { slot: 99 }) === 0, 'bad slot is 0, not undefined');
check(PPLevel.xpFor('nonsense') === 0, 'unknown source is 0, not NaN');

if (failures) { console.error(`${failures} failure(s)`); process.exit(1); }
console.log('level tests: all passed');
```

- [ ] **Step 3: Add the npm script**

In `package.json`, after the `"test:bond"` line add:

```json
    "test:level": "node tests/level_test.js",
```

- [ ] **Step 4: Run to verify it fails**

Run: `npm run test:level`
Expected: FAIL — `Cannot find module '../www/js/level.js'`

- [ ] **Step 5: Write the implementation**

Create `www/js/level.js`:

```js
/* Puzzle Pet — the leveling spine: XP curve to level 30, display ratchet,
 * XP sources, event-log backfill. Pure functions; no DOM; loads in Node.
 * Non-negotiables: XP never decreases; the DISPLAYED level never decreases
 * either (pet.levelHigh is the high-water mark, so a threshold retune during
 * tuning can never demote an existing player); levels gate cosmetics only. */
(function (global) {
  'use strict';

  // Looked up lazily so script/require order never matters.
  const C = () => global.PPConfig;

  const CAP_OF = () => C().LEVEL_XP.length + 1;

  // Cumulative XP required to reach `level`. L1 is free; above the cap is
  // unreachable by design — there is no endless tail in v2.
  function thresholdFor(level) {
    if (level <= 1) return 0;
    if (level > CAP_OF()) return Infinity;
    return C().LEVEL_XP[level - 2];
  }

  // Level and progress for a lifetime XP total.
  function levelForXp(xp) {
    const L = C().LEVEL_XP;
    let level = 1;
    while (level < CAP_OF() && xp >= L[level - 1]) level++;
    const atCap = level >= CAP_OF();
    const base = thresholdFor(level);
    return {
      level,
      base,
      next: atCap ? null : thresholdFor(level + 1),
      into: xp - base,
      needed: atCap ? null : thresholdFor(level + 1) - base,
      atCap
    };
  }

  // What the player is shown. levelHigh ratchets: once a level is reached it
  // is never displayed lower, even if LEVEL_XP is later tuned upward.
  function displayLevel(pet) {
    return Math.max(levelForXp(pet.xp || 0).level, pet.levelHigh || 1);
  }

  // XP for one award. Puzzle solves ONLY — feeding, petting and visiting are
  // interactions, not XP sources, in v2. Returns 0 for anything unrecognized,
  // never NaN, because a bad value would corrupt a player's lifetime total.
  function xpFor(source, opts) {
    const o = opts || {};
    switch (source) {
      case 'daily':    return C().XP_PAYOUTS[o.slot] || 0;
      case 'setBonus': return C().XP_SET_BONUS;
      case 'freeplay': return C().XP_FREEPLAY;
      default:         return 0;
    }
  }

  const PPLevel = { get CAP() { return CAP_OF(); }, thresholdFor, levelForXp, displayLevel, xpFor };
  if (typeof module !== 'undefined' && module.exports) module.exports = PPLevel;
  global.PPLevel = PPLevel;
})(typeof window !== 'undefined' ? window : globalThis);
```

- [ ] **Step 6: Run to verify it passes**

Run: `npm run test:level`
Expected: PASS — `level tests: all passed`

- [ ] **Step 7: Verify nothing broke**

Run: `npm run test:gen && npm run test:bond && npm run test:speech`
Expected: all PASS (BOND_* untouched, bond.js untouched).

- [ ] **Step 8: Commit**

```bash
git add www/js/config.js www/js/level.js tests/level_test.js package.json
git commit -m "feat(level): add 30-level curve, display ratchet, and xp sources"
```

---

### Task 2: Backfill from history

**Files:**
- Modify: `www/js/level.js`
- Modify: `tests/level_test.js`

**Interfaces:**
- Consumes: `xpFor` from Task 1.
- Produces: `PPLevel.backfill(events, days) -> number` — total lifetime XP recomputed from history. `events` is the append-only log; `days` is the `'YYYY-MM-DD' → { slots, bonus }` map (the set bonus was never logged as an event, but `days[*].bonus` persists it, so the bonus is recovered from there).

- [ ] **Step 1: Write the failing test**

Append to `tests/level_test.js` before the final `if (failures)` block:

```js
// --- backfill: replay events at the NEW values; +setBonus per bonus day ---
const history = [
  { type: 'pet_chosen', species: 'cat', name: 'Mochi' },
  { type: 'puzzle_solved', kind: 'daily', slot: 0 },
  { type: 'puzzle_solved', kind: 'daily', slot: 1 },
  { type: 'puzzle_solved', kind: 'daily', slot: 2 },
  { type: 'puzzle_solved', kind: 'free' },
  { type: 'feed', item: 'cake' },          // no XP in v2
  { type: 'bond_visit', xp: 3 },           // legacy v2-save event: ignored
  { type: 'bond_pet', xp: 1 },             // legacy v2-save event: ignored
  { type: 'buy_permanent', item: 'ball' }
];
const daysMap = {
  '2026-06-20': { slots: [true, true, true], bonus: true },
  '2026-06-21': { slots: [true, false, false], bonus: false }
};
const expected = C.XP_PAYOUTS[0] + C.XP_PAYOUTS[1] + C.XP_PAYOUTS[2]
               + C.XP_FREEPLAY + C.XP_SET_BONUS;
check(PPLevel.backfill(history, daysMap) === expected, `backfill totals ${expected}`);

// Defensive: malformed inputs must not throw or produce NaN.
check(PPLevel.backfill([], {}) === 0, 'empty history is 0');
check(PPLevel.backfill(undefined, undefined) === 0, 'missing history is 0');
check(PPLevel.backfill([{ type: 'puzzle_solved', kind: 'daily' }], {}) === 0,
  'daily solve with no slot is 0, not NaN');
check(PPLevel.backfill([null, { type: 'feed' }], { x: null }) === 0,
  'null entries are skipped');
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test:level`
Expected: FAIL — `PPLevel.backfill is not a function`

- [ ] **Step 3: Implement**

In `www/js/level.js`, add after `xpFor`:

```js
  // Recomputes lifetime XP from history so an existing save arrives at the
  // level it already earned. Two sources: puzzle_solved events (per solve),
  // and days[*].bonus (the set bonus was never logged as an event, but the
  // days map persists it). Deliberately under-credits — the event log is
  // capped at 5000 entries. Never hand a player a level they didn't earn.
  function backfill(events, days) {
    let xp = 0;
    (events || []).forEach(e => {
      if (!e || e.type !== 'puzzle_solved') return;
      xp += e.kind === 'daily' ? xpFor('daily', { slot: e.slot }) : xpFor('freeplay');
    });
    Object.keys(days || {}).forEach(d => {
      if (days[d] && days[d].bonus) xp += xpFor('setBonus');
    });
    return xp;
  }
```

Add `backfill` to the exported object.

- [ ] **Step 4: Run to verify it passes**

Run: `npm run test:level`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add www/js/level.js tests/level_test.js
git commit -m "feat(level): backfill lifetime xp from events and bonus days"
```

---

### Task 3: Markup and styles — level meter, home bar, win-overlay XP

**Files:**
- Modify: `www/index.html`
- Modify: `www/css/style.css`

**Interfaces:**
- Consumes: nothing.
- Produces DOM ids Tasks 5 and 7 depend on: `#chip-level`, `#home-level-fill`, `#pet-level`, `#level-num`, `#level-total`, `#level-fill`, `#level-label`, `#win-xp`, `#win-xp-gain`, `#win-xp-fill`.

**This task starts the expected red window.** The bond ids disappear while `app.js` still renders to them; the app misbehaves until Task 5 and `test:app` fails until Task 7. That is the plan, not a defect. Node suites are unaffected.

- [ ] **Step 1: Replace the home bond chip**

In `www/index.html`, replace:

```html
        <span class="chip" id="chip-bond">💛 1</span>
```

with:

```html
        <span class="chip" id="chip-level">Lv 1</span>
```

- [ ] **Step 2: Add the thin XP bar to the home pet card**

Immediately after the `<div class="mood" id="home-pet-mood"></div>` line, add:

```html
        <div class="level-thin"><div class="level-thin-fill" id="home-level-fill"></div></div>
```

- [ ] **Step 3: Replace the pet-screen bond meter**

Replace the whole `<div class="bond" id="pet-bond">...</div>` block with:

```html
      <div class="bond" id="pet-level">
        <div class="bond-head">
          <span id="level-num">Lv 1</span>
          <span id="level-total">0 ✦</span>
        </div>
        <div class="bond-track"><div class="bond-fill" id="level-fill"></div></div>
        <div class="bond-label" id="level-label"></div>
      </div>
```

(The `bond-*` CSS classes are kept — the meter's look is unchanged; only ids and content change.)

- [ ] **Step 4: Add the XP line to the win overlay**

In the win overlay, immediately after `<div class="coin-burst" id="win-coins">+10 🪙</div>`, add:

```html
    <div class="win-xp" id="win-xp">
      <span class="win-xp-gain" id="win-xp-gain">+10 ✦</span>
      <div class="win-xp-track"><div class="win-xp-fill" id="win-xp-fill"></div></div>
    </div>
```

- [ ] **Step 5: Add the styles**

Append to `www/css/style.css`:

```css
/* Leveling */
.level-thin { height: 4px; background: var(--soft-line); border-radius: 999px; overflow: hidden; margin-top: 6px; }
.level-thin-fill { height: 100%; width: 0%; border-radius: 999px; background: linear-gradient(90deg, #f7c873, var(--accent)); transition: width .4s ease; }
.win-xp { margin: 6px auto 2px; max-width: 220px; }
.win-xp-gain { font-weight: 800; color: var(--accent-deep); font-size: .9rem; }
.win-xp-track { height: 6px; background: var(--soft-line); border-radius: 999px; overflow: hidden; margin-top: 4px; }
.win-xp-fill { height: 100%; width: 0%; border-radius: 999px; background: linear-gradient(90deg, #f7c873, var(--accent)); transition: width .6s ease; }
```

- [ ] **Step 6: Commit**

```bash
git add www/index.html www/css/style.css
git commit -m "feat(level): level meter, home xp bar, and win-overlay xp markup"
```

---

### Task 4: Storage v3 — migrate v1 AND v2 saves

**Files:**
- Modify: `www/js/storage.js`
- Modify: `www/index.html` (script tag)

**Interfaces:**
- Consumes: `PPLevel.backfill`, `PPLevel.levelForXp` (Tasks 1–2).
- Produces: storage key `puzzlepet.v3`; `pet` gains `xp: 0, levelHigh: 1`; top-level `bond` is gone; `state.backfillToast` (level number) set once when a migration lands above level 1, consumed by Task 5's boot; `PPStore.migrate(state)`.

- [ ] **Step 1: Load `level.js` before `storage.js`**

In `www/index.html`'s script block, add `level.js` after `bond.js` (bond.js stays until Task 5):

```html
<script src="js/bond.js"></script>
<script src="js/level.js"></script>
```

- [ ] **Step 2: Rewrite keys, defaults, load, migrate, reset**

In `www/js/storage.js`, replace the two key constants with:

```js
  const KEY = 'puzzlepet.v3';
  const KEY_V2 = 'puzzlepet.v2';
  const KEY_V1 = 'puzzlepet.v1';
```

In `defaults()`: change `version: 2,` to `version: 3,`; change the `pet` line to:

```js
      pet: { species: null, name: '', energy: PPConfig.ENERGY_MAX, energyTs: Date.now(), xp: 0, levelHigh: 1 },
```

Delete the `bond: PPBond.blankBond(),` line. Keep `room` (harmless; slice-2 seed).

Replace `load()` and `migrate()` with:

```js
    load() {
      try {
        const raw = localStorage.getItem(KEY);
        if (raw) {
          const s = Object.assign(defaults(), JSON.parse(raw));
          // Saved objects replace the nested pet wholesale, so a v3 save
          // written before a field existed needs an explicit patch.
          if (s.pet.xp == null) { s.pet.xp = 0; s.pet.levelHigh = 1; }
          return s;
        }
        const old = localStorage.getItem(KEY_V2) || localStorage.getItem(KEY_V1);
        if (old) {
          const parsed = Object.assign(defaults(), JSON.parse(old));
          let migrated;
          try {
            migrated = PPStore.migrate(parsed);
          } catch (e) {
            // The save parsed but migration blew up (e.g. malformed events).
            // Keep everything the player has; start XP from zero rather than
            // throwing the save away.
            parsed.version = 3;
            parsed.pet.xp = 0;
            parsed.pet.levelHigh = 1;
            delete parsed.bond;
            migrated = parsed;
          }
          PPStore.save(migrated);
          return migrated;
        }
      } catch (e) { /* fall through */ }
      if (!memory) memory = defaults();
      return memory;
    },
    // v1/v2 → v3: recompute lifetime XP from history at the NEW values.
    // Coins, owned items, days, streak, and pet identity are untouched.
    // The old bond field is dropped; old bond_visit/bond_pet events are
    // simply ignored by backfill. Old keys are left in place deliberately —
    // save() swallows quota failures, so we cannot prove the v3 write
    // landed, and the old key is what makes re-migration safe.
    migrate(state) {
      state.version = 3;
      const xp = PPLevel.backfill(state.events, state.days);
      state.pet.xp = xp;
      state.pet.levelHigh = PPLevel.levelForXp(xp).level;
      delete state.bond;
      state.events.push({ t: Date.now(), type: 'xp_backfill', xp, level: state.pet.levelHigh });
      if (state.pet.levelHigh > 1) state.backfillToast = state.pet.levelHigh;
      return state;
    },
```

In `reset()`, add `localStorage.removeItem(KEY_V2);` alongside the other two removals (keep KEY and KEY_V1).

- [ ] **Step 3: Verify Node suites**

Run: `npm run test:gen && npm run test:level && npm run test:speech && npm run test:bond`
Expected: all PASS (storage.js isn't loaded by any Node suite; bond.js still intact).

- [ ] **Step 4: Commit**

```bash
git add www/js/storage.js www/index.html
git commit -m "feat(level): storage v3 with v1+v2 migration and xp backfill"
```

---

### Task 5: Rewire app.js — awards, display, and bond removal

**Files:**
- Modify: `www/js/app.js`
- Modify: `www/index.html` (remove bond.js script tag)
- Delete: `www/js/bond.js`, `tests/bond_test.js`
- Modify: `www/js/config.js` (remove `BOND_XP`, `BOND_LEVELS`, `BOND_ENDLESS` — keep `SPECIES_BLURBS`)
- Modify: `package.json` (remove `test:bond`)

**Interfaces:**
- Consumes: `PPLevel.*` (Tasks 1–2), DOM ids (Task 3), `state.backfillToast` (Task 4).
- Produces: `awardXp(source, opts) -> number`, `renderLevel()`, `window.PP._grantXp(n)` now operating on `pet.xp`. New event types: `level_up {level}`, `petted {}`.

- [ ] **Step 1: Replace `applyBond` and `claimDailyVisit` with `awardXp`**

In `www/js/app.js`, delete the `applyBond` function and the `claimDailyVisit` function entirely (lines ~99–125) and put in their place:

```js
  // The only place XP enters the game. Puzzle solves only — feeding, petting
  // and visiting are interactions, not XP sources. Returns the XP gained so
  // the win overlay can show it. Ratchet: levelHigh only ever rises.
  function awardXp(source, opts) {
    const gained = PPLevel.xpFor(source, opts);
    if (!gained) return 0;
    const before = PPLevel.displayLevel(S.pet);
    S.pet.xp += gained;
    const after = PPLevel.displayLevel(S.pet);
    if (after > before) {
      S.pet.levelHigh = after;
      log('level_up', { level: after });
      toast(`${S.pet.name} grew to Level ${after}! 💛`);
    }
    save();
    return gained;
  }
```

- [ ] **Step 2: Fix `speechCtx`**

Change `level: S.bond.level,` to `level: PPLevel.displayLevel(S.pet),`.

- [ ] **Step 3: Wire the solve handler**

In `onPuzzleWin`, track gained XP and pass it to the overlay. Replace the three `applyBond(PPBond.award(...))` lines:

- After `earned += C.DAILY_PAYOUTS[gameCtx.slot];` the line becomes `gainedXp += awardXp('daily', { slot: gameCtx.slot });`
- After `earned += C.DAILY_SET_BONUS;` the line becomes `gainedXp += awardXp('setBonus');`
- In the free-play branch the line becomes `gainedXp = awardXp('freeplay');`

Declare `let gainedXp = 0;` next to `let earned = 0;`. Add `xp: gainedXp` to both `log('puzzle_solved', {...})` payloads.

Then, before `overlay('overlay-win', true);`, render the XP line with a pre→post animated fill:

```js
    const info = PPLevel.levelForXp(S.pet.xp);
    const gx = $('win-xp');
    if (gainedXp > 0) {
      gx.style.display = '';
      $('win-xp-gain').textContent = `+${gainedXp} ✦`;
      const fill = $('win-xp-fill');
      const prev = PPLevel.levelForXp(S.pet.xp - gainedXp);
      // Start the bar where it was before this solve, then animate to now.
      // A crossed threshold or the cap just reads as a full bar.
      fill.style.transition = 'none';
      fill.style.width = prev.atCap ? '100%'
        : `${Math.round(100 * Math.max(0, prev.into) / prev.needed)}%`;
      void fill.offsetWidth;
      fill.style.transition = '';
      fill.style.width = info.atCap || info.level > prev.level ? '100%'
        : `${Math.round(100 * info.into / info.needed)}%`;
    } else {
      gx.style.display = 'none';   // replayed slot: no XP, no bar
    }
```

- [ ] **Step 4: Replace `renderBond` with `renderLevel`**

```js
  function renderLevel() {
    const lv = PPLevel.displayLevel(S.pet);
    const info = PPLevel.levelForXp(S.pet.xp);
    $('chip-level').textContent = `Lv ${lv}`;
    $('level-num').textContent = `Lv ${lv}`;
    $('level-total').textContent = `${S.pet.xp} ✦`;
    // Ratcheted above the derived level (post-retune) or at the cap: full bar.
    const pct = (info.atCap || lv > info.level) ? 100
      : Math.round(100 * info.into / info.needed);
    $('level-fill').style.width = `${pct}%`;
    $('home-level-fill').style.width = `${pct}%`;
    $('level-label').textContent = info.atCap
      ? `Level ${PPLevel.CAP} — what a journey ✦`
      : (lv > info.level ? `${S.pet.xp} ✦ and counting`
                         : `${info.into} / ${info.needed} ✦ to Lv ${info.level + 1}`);
  }
```

Update the two call sites: `renderBond()` in `renderHome` and in `renderPet` both become `renderLevel()`.

- [ ] **Step 5: De-wire feeding and petting**

In the consumable click handler, delete the `applyBond(PPBond.award(S, 'feed', ...));` line — feeding restores energy and logs, nothing else. Replace the sprite click handler with:

```js
    spriteEl.onclick = () => {
      log('petted', {});
      renderPet(true);   // still responds, still speaks — only the XP is gone
    };
```

- [ ] **Step 6: Boot — remove the visit claim, add the backfill toast**

In the boot block, delete the `claimDailyVisit();` line (and its other call inside the `#onb-arrive-go` handler). After `applyRegen();` add:

```js
  if (S.backfillToast) {
    toast(`${S.pet.name} grew to Level ${S.backfillToast} while thinking about all the puzzles you've solved together! 💛`, 4000);
    delete S.backfillToast;
    save();
  }
```

- [ ] **Step 7: Update the test hook**

Replace `_grantXp` in `window.PP`:

```js
    _grantXp(n) {
      S.pet.xp += n;
      S.pet.levelHigh = Math.max(S.pet.levelHigh || 1, PPLevel.levelForXp(S.pet.xp).level);
      save(); renderHome();
    }
```

- [ ] **Step 8: Delete the bond system**

```bash
git rm www/js/bond.js tests/bond_test.js
```

Remove `<script src="js/bond.js"></script>` from `www/index.html`, the `"test:bond"` line from `package.json`, and the `BOND_XP`, `BOND_LEVELS`, `BOND_ENDLESS` blocks from `www/js/config.js` (keep `SPECIES_BLURBS` — onboarding uses it). Search `www/js/app.js` for any remaining `PPBond` reference — there must be none.

- [ ] **Step 9: Verify by hand and by suite**

Run: `npm run test:gen && npm run test:level && npm run test:speech`
Expected: all PASS.
Then `npm run serve`, clear site data, play: onboard → solve the easy daily → win overlay shows `+10 ✦` with the bar animating → home chip reads `Lv 1` with the thin bar partly filled. Pet the sprite: it bounces and speaks, chip unchanged. **Kill the server when done.**

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat(level): wire xp awards and level display; remove the bond system"
```

---

### Task 6: Onboarding roster — cat and dog only

**Files:**
- Modify: `www/js/app.js` (renderOnboard)

**Interfaces:**
- Consumes: `PPConfig.ENABLED_SPECIES` (Task 1).
- Produces: the species grid renders only enabled species. Locked species are absent entirely — not greyed, not teased (spec §4: discovering them later is the surprise).

- [ ] **Step 1: Filter the grid**

In `renderOnboard()`, change the loop source from `C.SPECIES.forEach(sp => {` to:

```js
    (C.ENABLED_SPECIES || C.SPECIES).forEach(sp => {
```

The fallback keeps the function correct if the config key is ever removed.

- [ ] **Step 2: Verify by hand**

`npm run serve`, clear site data: the grid shows exactly two cards (cat, dog), preview/blurb/confirm flow unchanged. Kill the server.

- [ ] **Step 3: Commit**

```bash
git add www/js/app.js
git commit -m "feat(level): onboarding offers cat and dog; the rest return as unlocks"
```

---

### Task 7: End-to-end tests and README

**Files:**
- Modify: `tests/app_test.spec.js`
- Modify: `README.md`

**Interfaces:**
- Consumes: everything above; `window.PP._grantXp`; `window.PPConfig.XP_PAYOUTS`/`LEVEL_XP`.
- Produces: a green suite. **This closes the red window.**

- [ ] **Step 1: Update the core-loop onboarding for the 2-species roster**

The existing test picks fox, which is no longer offered. In the onboarding section replace `#species-fox` interactions with `#species-dog` (browse via `#species-cat` then back to `#species-dog`), and the prefill assertion `toHaveValue('Maple')` with `toHaveValue('Biscuit')`. Add:

```js
  const speciesShown = await page.locator('.species-btn').count();
  expect(speciesShown).toBe(2);
```

Keep the name fill as `'Pip'` so the rest of the test is untouched.

- [ ] **Step 2: Replace the bond e2e test with a leveling test**

Delete the `bond rises from solving, petting, and visiting` test and the old threshold-crossing test if present; add:

```js
test('xp comes from solving only, and levels ratchet up', async ({ page }) => {
  await page.goto('/');
  await page.click('#onb-welcome-go');
  await page.click('#species-cat');
  await page.click('#onb-choose-go');
  await page.click('#onb-name-go');
  await page.click('#onb-arrive-go');

  // No visit XP in v2: a fresh pet starts at exactly zero.
  expect(await page.evaluate(() => window.PP.state().pet.xp)).toBe(0);

  // Petting responds but grants nothing.
  await page.click('#btn-pet');
  await page.click('#pet-sprite');
  await page.click('#pet-sprite');
  expect(await page.evaluate(() => window.PP.state().pet.xp)).toBe(0);
  const events = await page.evaluate(() => window.PP.state().events.map(e => e.type));
  expect(events).toContain('petted');
  await page.click('#pet-back');

  // Solving the easy opener grants exactly XP_PAYOUTS[0], shown on the win overlay.
  await page.click('#slot-0');
  await autosolve(page);
  const perEasy = await page.evaluate(() => window.PPConfig.XP_PAYOUTS[0]);
  await expect(page.locator('#win-xp-gain')).toHaveText(`+${perEasy} ✦`);
  await continueWin(page);
  expect(await page.evaluate(() => window.PP.state().pet.xp)).toBe(perEasy);

  // One XP short of L2, then one real solve crosses it: level_up logged, chip updates.
  const l2 = await page.evaluate(() => window.PPConfig.LEVEL_XP[0]);
  await page.evaluate(xp => window.PP._grantXp(xp), l2 - perEasy - 1);
  await page.click('#slot-1');   // medium, worth more than 1 XP
  await autosolve(page);
  await continueWin(page);
  const s = await page.evaluate(() => window.PP.state());
  expect(s.pet.levelHigh).toBeGreaterThanOrEqual(2);
  expect(s.events.map(e => e.type)).toContain('level_up');
  await expect(page.locator('#chip-level')).toHaveText(`Lv ${s.pet.levelHigh}`);
});
```

- [ ] **Step 3: Rewrite the migration test for v3, and add the v2 case**

Replace the existing v1 migration test with these two. Expected values are exact and derived from config — the lesson from the bond slice's loose-bound finding.

```js
test('a v1 save migrates to v3 with xp backfilled at the new values', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem('puzzlepet.v1', JSON.stringify({
      version: 1, createdDay: '2026-06-01', coins: 137,
      pet: { species: 'fox', name: 'Pip', energy: 80, energyTs: Date.now() },
      lastActiveDay: '2026-06-20',
      days: { '2026-06-20': { slots: [true, true, false], bonus: false } },
      owned: { ball: true, plant: true }, solves: 4, removeAds: false,
      events: [
        { type: 'pet_chosen', species: 'fox', name: 'Pip' },
        { type: 'puzzle_solved', kind: 'daily', slot: 0 },
        { type: 'puzzle_solved', kind: 'daily', slot: 1 },
        { type: 'puzzle_solved', kind: 'daily', slot: 2 },
        { type: 'feed', item: 'cake' }
      ]
    }));
  });
  await page.reload();

  // Straight to home — a migrated player is never re-onboarded, and a fox
  // chosen before the roster shrank keeps their fox.
  await expect(page.locator('#screen-home')).toHaveClass(/active/);
  await expect(page.locator('#home-pet-name')).toHaveText('Pip');

  const s = await page.evaluate(() => window.PP.state());
  const cfg = await page.evaluate(() => window.PPConfig);
  const exact = cfg.XP_PAYOUTS[0] + cfg.XP_PAYOUTS[1] + cfg.XP_PAYOUTS[2]; // feed = 0, no bonus day
  expect(s.version).toBe(3);
  expect(s.pet.xp).toBe(exact);
  expect(s.pet.levelHigh).toBe(2);            // 65 >= LEVEL_XP[0] (60)
  expect(s.coins).toBe(137);
  expect(s.owned.ball).toBe(true);
  expect(s.days['2026-06-20'].slots).toEqual([true, true, false]);
  expect(s.events.map(e => e.type)).toContain('xp_backfill');

  // Exactly once: a reload must not re-award.
  await page.reload();
  expect(await page.evaluate(() => window.PP.state().pet.xp)).toBe(exact);
});

test('a v2 (bond) save migrates to v3, drops bond, and counts bonus days', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem('puzzlepet.v2', JSON.stringify({
      version: 2, createdDay: '2026-07-01', coins: 55,
      pet: { species: 'dino', name: 'Pebble', energy: 60, energyTs: Date.now() },
      bond: { xp: 31, level: 2, visitDay: '2026-07-20', pets: 5, petsDay: '2026-07-20' },
      room: { wallpaper: 'plain', flooring: 'plain' },
      lastActiveDay: '2026-07-20',
      days: { '2026-07-20': { slots: [true, true, true], bonus: true } },
      owned: {}, solves: 3, removeAds: false,
      events: [
        { type: 'pet_chosen', species: 'dino', name: 'Pebble' },
        { type: 'puzzle_solved', kind: 'daily', slot: 0 },
        { type: 'puzzle_solved', kind: 'daily', slot: 1 },
        { type: 'puzzle_solved', kind: 'daily', slot: 2 },
        { type: 'bond_visit', xp: 3 },
        { type: 'bond_pet', xp: 1 }
      ]
    }));
  });
  await page.reload();

  const s = await page.evaluate(() => window.PP.state());
  const cfg = await page.evaluate(() => window.PPConfig);
  const exact = cfg.XP_PAYOUTS[0] + cfg.XP_PAYOUTS[1] + cfg.XP_PAYOUTS[2] + cfg.XP_SET_BONUS;
  expect(s.version).toBe(3);
  expect(s.pet.xp).toBe(exact);               // old bond xp is NOT converted; history is replayed
  expect(s.bond).toBeUndefined();
  expect(s.coins).toBe(55);
  expect(s.pet.name).toBe('Pebble');
});
```

- [ ] **Step 4: Full suite**

Run: `npm run test:gen && npm run test:level && npm run test:speech && PP_CHROMIUM="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" npm run test:app`
Expected: everything PASS. If a migration number disagrees, the code is wrong, not the expected value — stop and investigate; do not retune the constant.

- [ ] **Step 5: Update the README test block**

Replace the `test:bond` line with:

```markdown
npm run test:level   # Node: xp curve, level boundaries, ratchet, backfill
```

- [ ] **Step 6: Commit**

```bash
git add tests/app_test.spec.js README.md
git commit -m "test(level): leveling e2e, v1 and v2 migration coverage"
```

---

## Known deferred items (as shipped)

Triaged during execution and the final whole-branch review; recorded here because the SDD scratch workspace is deleted after merge.

- **Old storage keys (`puzzlepet.v1`, `puzzlepet.v2`) are left in localStorage deliberately** — `save()` swallows quota failures, so migration cannot prove the v3 write landed; the old key is what makes re-migration safe. Roughly 1 MB of dead bytes per migrated player; schedule a one-time cleanup pass once v3 is proven in the field. Do not "clean up" earlier.
- An already-v3 save tampered to `"pet": null` degrades to in-memory defaults for the session (outer catch); the migrate-path equivalent is guarded. Tamper-only.
- Persistent quota failure re-runs migration per load; duplicate `xp_backfill` events exist in memory only (the old key is never rewritten) and XP stays exact.
- `awardXp` saves and `onPuzzleWin` saves again — one redundant localStorage write per solve.
- `backfill` accepts `NaN` xp in principle; unreachable because NaN cannot survive a JSON round-trip. Swap to `Number.isFinite` if hardening.
- Win-bar animation widths are unasserted (only the `+N ✦` text is); the underlying math is unit-tested.
- **`speech.js` minLevels (1/2/3/5/8) were calibrated for the bond curve.** Under the new curve all 22 lines unlock by L8 (~day 20 full-set), so levels 9–30 add nothing to the pet's voice. Do a `minLevel` pass alongside plans 2–4.
- **Spec §4's onboarding remainder is currently unowned:** the 3-beat restructure and the post-onboarding "Solve today's Easy puzzle" toast were deliberately not in this plan. Assign to plan 4 (which reworks onboarding for the switcher) or it will fall through.

## Handoff to plans 2–4

What this plan leaves behind for the next plans to consume:

- `PPLevel.displayLevel(pet)` and `pet.levelHigh` — plan 2's level-up overlay triggers on `level_up` events / `levelHigh` changes; plan 2 must add its own "last acknowledged level" for the overlay queue rather than overloading `levelHigh`.
- `LEVEL_XP` in config — plans 2–4 gate shop items, areas, and species on `displayLevel`.
- `xp` on every `puzzle_solved` event, plus `level_up` and `xp_backfill` events — retroactive grants in later plans replay these.
- `ENABLED_SPECIES` — plan 4 keeps it as the onboarding roster and adds `SPECIES_UNLOCKS` for the rest.
- The `speech.js` pool still gates on `ctx.level` (now the displayed level); its `minLevel` values (2/3/5/8) land in week one under the new curve, which is faster than under the bond curve — acceptable, revisit in the tuning pass.
