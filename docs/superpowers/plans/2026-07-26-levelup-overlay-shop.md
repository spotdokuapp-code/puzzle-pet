# Level-Up Overlay & Shop Catalog (v2 slice 2 of 4) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give leveling its payoff: a level-up overlay that celebrates each crossing with its unlock list, and a shop gated by level with the full 37-item catalog in config (main-area items purchasable now; the rest waits, hidden, for plan 3's room areas).

**Architecture:** All catalog content is config data — `PERMANENTS` entries gain `level` and `area`, and `AREAS` lands now as data plan 3 will render. The shop lists main-area items at or below the player's level (plus anything owned), teases exactly the next locked main tier, and collapses everything else into one line. `awardXp` stops toasting on level-up and instead queues `pendingLevelUp`; the queue is drained into `#overlay-levelup` inside the win-continue interstitial callback, so the overlay can never stack on an ad. Speech `minLevel`s stretch from 1/2/3/5/8 to 1/3/6/12/20 so the pet's voice keeps deepening across the 30-level curve.

**Tech Stack:** Plain HTML/CSS/JS, no build step. Node unit tests, Playwright e2e.

**Source spec:** `docs/superpowers/specs/2026-07-25-pet-leveling-v2-level-30.md` §6 (catalog), §9 (level-up moment), §11 (shop presentation).

**Decisions locked with the owner (2026-07-26):**
- Shop scope pre-areas: **main-area items only**; full catalog ships as config data; non-main content is hidden (collapsed line), not teased item-by-item.
- Species levels (12/18/24/30): the overlay shows **no species content** — plan 4 adds the species variant and retroactively fires reveals from level history.
- Speech: **remap minLevels to 1/3/6/12/20**, same 22 lines, no new copy.
- Spec §4's onboarding remainder (3-beat flow, first-day toast): **assigned to plan 4** — recorded in the handoff, not built here.

## Global Constraints

- **Catalog values verbatim from spec §6** — 37 permanents, exact prices and levels. Tuning is deferred; do not "improve" a number. Consumables are never level-gated.
- **Every level 2–30 unlocks at least one thing across the FULL catalog** — test-enforced, so future catalog edits can't silently create empty levels.
- **The overlay never stacks on an ad** — it shows only inside the `maybeInterstitial` callback, after any interstitial closes. It never interrupts play.
- **No teasing hidden content.** The next locked main tier shows "Lv {n} ✨"; everything deeper or in unbuilt areas collapses to exactly `More to discover as {name} grows…`. No locked doors, no silhouettes, no species hints.
- **An owned item is never hidden** — a migrated save that owns an above-level item still sees it in the shop ("in room ✓") and in the room.
- **Multiple thresholds crossed before the overlay shows → one overlay, highest level, merged unlock list** (spec §9).
- **XP/level rules unchanged:** XP add-only, `levelHigh` never written down, level gates cosmetics only, all tunables in `config.js`.
- **Every meaningful action appends to `state.events`.** `level_up` logging stays exactly where it is; the overlay is display only.
- **Every pet is "they"; species-neutral copy; no guilt or sadness.**
- Environment: Playwright needs `PP_CHROMIUM="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"`.
- **No red window this plan.** Every task leaves all four suites green. (Task 1 leaves the shop temporarily ungated — all 37 items purchasable for one commit — which is a playability wart, not a test failure; Task 2 closes it.)

## File Structure

| File | Status | Responsibility |
|---|---|---|
| `www/js/config.js` | Modify | 37-item `PERMANENTS` with `level`/`area`, new `AREAS` block |
| `tests/catalog_test.js` | Create | Catalog integrity: shape, sort, unique ids, area refs, no empty levels |
| `www/js/app.js` | Modify | Shop gating, `DECO_SPOTS` additions, `pendingLevelUp` queue, `unlocksFor`, overlay wiring |
| `www/index.html` | Modify | `#overlay-levelup` markup |
| `www/css/style.css` | Modify | Overlay, locked-row, collapsed-row styles |
| `www/js/speech.js` | Modify | minLevel remap 1/2/3/5/8 → 1/3/6/12/20 |
| `tests/speech_test.js` | Modify | Sweep to level 30, assert max tier 20 |
| `tests/app_test.spec.js` | Modify | Overlay handling in the leveling test; new shop-gating test |
| `package.json` | Modify | `test:catalog` script |

Out of scope: `AREAS` rendering, per-area decor spots, shop grouping by area (plan 3); species reveals, friends switcher, `SPECIES_UNLOCKS`, onboarding rework (plan 4).

---

### Task 1: The catalog

**Files:**
- Modify: `www/js/config.js`
- Create: `tests/catalog_test.js`
- Modify: `package.json`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `PPConfig.PERMANENTS` — 37 entries `{ id, name, emoji, price, level, area }`, sorted by `level` ascending (Task 2's next-tier logic relies on the sort)
  - `PPConfig.AREAS` — `[{ id, level, name? }]` (data for plan 3; Task 2 uses it only to identify `'main'`)

**Transitional state, deliberate:** after this task the shop renders all 37 items ungated for one commit — `renderPet` still lists every `PERMANENTS` entry. Task 2 gates it. All suites stay green (no test asserts shop row count).

- [ ] **Step 1: Write the failing test**

Create `tests/catalog_test.js`:

```js
// Puzzle Pet — catalog integrity. Guards spec §6's promises against future
// edits: exact shape, no empty levels 2–30, every area reference real.
require('../www/js/config.js');
const C = globalThis.PPConfig;

let failures = 0;
function check(cond, msg) {
  if (!cond) { failures++; console.error('FAIL:', msg); }
}

const AREA_IDS = C.AREAS.map(a => a.id);
check(AREA_IDS.join(',') === 'main,nook,garden,pond,deck', 'areas in order');
C.AREAS.forEach(a => check(Number.isInteger(a.level) && a.level >= 1, `area ${a.id} has a level`));

check(C.PERMANENTS.length === 37, `37 permanents (got ${C.PERMANENTS.length})`);

const ids = new Set();
let prevLevel = 0;
C.PERMANENTS.forEach(p => {
  check(p.id && !ids.has(p.id), `unique id ${p.id}`);
  ids.add(p.id);
  check(typeof p.name === 'string' && p.name.length > 0, `${p.id} has a name`);
  check(typeof p.emoji === 'string' && p.emoji.length > 0, `${p.id} has an emoji`);
  check(Number.isInteger(p.price) && p.price > 0, `${p.id} price positive`);
  check(Number.isInteger(p.level) && p.level >= 1 && p.level <= 30, `${p.id} level 1..30`);
  check(AREA_IDS.includes(p.area), `${p.id} area "${p.area}" exists`);
  const area = C.AREAS.find(a => a.id === p.area);
  check(p.level >= area.level, `${p.id} not below its area's unlock level`);
  check(p.level >= prevLevel, `catalog sorted by level at ${p.id}`);
  prevLevel = p.level;
});

// Spec §2: every level 2..30 unlocks at least one thing (item, area, or —
// in plan 4 — a species). Items and areas are what exist in config today;
// species milestone levels are covered by their area/item entries per §6.
for (let lv = 2; lv <= 30; lv++) {
  const hasItem = C.PERMANENTS.some(p => p.level === lv);
  const hasArea = C.AREAS.some(a => a.level === lv);
  check(hasItem || hasArea, `level ${lv} unlocks something`);
}

// The original five keep their ids and prices — migrated saves own them.
[['ball', 80], ['plant', 120], ['lamp', 160], ['rug', 220], ['poster', 260]].forEach(([id, price]) => {
  const p = C.PERMANENTS.find(x => x.id === id);
  check(p && p.price === price, `legacy item ${id} intact at ${price}`);
});

if (failures) { console.error(`${failures} failure(s)`); process.exit(1); }
console.log(`catalog tests: all passed (${C.PERMANENTS.length} items)`);
```

- [ ] **Step 2: Add the npm script**

In `package.json`, after `"test:level"` add:

```json
    "test:catalog": "node tests/catalog_test.js",
```

- [ ] **Step 3: Run to verify it fails**

Run: `npm run test:catalog`
Expected: FAIL — `C.AREAS` is undefined.

- [ ] **Step 4: Replace the catalog in config**

In `www/js/config.js`, add after the `LEVEL_XP` block (comma after its `]`):

```js
  AREAS: [                           // room regions; plan 3 renders them, plan 2 only reads ids
    { id: 'main',   level: 1 },
    { id: 'nook',   level: 5,  name: 'Window nook' },
    { id: 'garden', level: 10, name: 'Garden' },
    { id: 'pond',   level: 20, name: 'Pond' },
    { id: 'deck',   level: 30, name: 'Stargazing deck' }
  ],
```

Then replace the whole `PERMANENTS: [...]` block with the 37-item catalog, **sorted by level** (spec §6 prices/levels verbatim; legacy ids and prices unchanged):

```js
  PERMANENTS: [
    { id: 'ball',      name: 'Bouncy ball',        emoji: '⚽', price: 80,   level: 1,  area: 'main' },
    { id: 'plant',     name: 'Little plant',       emoji: '🪴', price: 120,  level: 1,  area: 'main' },
    { id: 'lamp',      name: 'Cozy lamp',          emoji: '🛋️', price: 160,  level: 2,  area: 'main' },
    { id: 'rug',       name: 'Warm rug',           emoji: '🧶', price: 220,  level: 2,  area: 'main' },
    { id: 'bowl',      name: 'Food bowl',          emoji: '🥣', price: 180,  level: 3,  area: 'main' },
    { id: 'poster',    name: 'Star poster',        emoji: '🌟', price: 260,  level: 3,  area: 'main' },
    { id: 'shelf',     name: 'Bookshelf',          emoji: '📚', price: 320,  level: 4,  area: 'main' },
    { id: 'cushion',   name: 'Window cushion',     emoji: '💺', price: 300,  level: 5,  area: 'nook' },
    { id: 'lights',    name: 'String lights',      emoji: '✨', price: 260,  level: 5,  area: 'nook' },
    { id: 'toychest',  name: 'Toy chest',          emoji: '🧸', price: 380,  level: 6,  area: 'nook' },
    { id: 'frame',     name: 'Picture frame',      emoji: '🖼️', price: 340,  level: 7,  area: 'nook' },
    { id: 'tent',      name: 'Pet tent',           emoji: '⛺', price: 450,  level: 8,  area: 'main' },
    { id: 'aquarium',  name: 'Aquarium',           emoji: '🐠', price: 520,  level: 9,  area: 'nook' },
    { id: 'flowerbed', name: 'Flower bed',         emoji: '🌷', price: 400,  level: 10, area: 'garden' },
    { id: 'fountain',  name: 'Fountain',           emoji: '⛲', price: 600,  level: 10, area: 'garden' },
    { id: 'gnome',     name: 'Garden gnome',       emoji: '🪆', price: 380,  level: 11, area: 'garden' },
    { id: 'clover',    name: 'Clover patch',       emoji: '🍀', price: 420,  level: 12, area: 'garden' },
    { id: 'swing',     name: 'Tree swing',         emoji: '🛝', price: 480,  level: 13, area: 'garden' },
    { id: 'chimes',    name: 'Wind chimes',        emoji: '🎐', price: 440,  level: 14, area: 'nook' },
    { id: 'birdhouse', name: 'Birdhouse',          emoji: '🐦', price: 500,  level: 15, area: 'garden' },
    { id: 'veggie',    name: 'Veggie patch',       emoji: '🥕', price: 550,  level: 16, area: 'garden' },
    { id: 'hammock',   name: 'Hammock',            emoji: '🪢', price: 600,  level: 17, area: 'garden' },
    { id: 'mushroom',  name: 'Mushroom ring',      emoji: '🍄', price: 520,  level: 18, area: 'garden' },
    { id: 'lantern',   name: 'Lantern string',     emoji: '🏮', price: 580,  level: 19, area: 'garden' },
    { id: 'lily',      name: 'Lily pads',          emoji: '🪷', price: 500,  level: 20, area: 'pond' },
    { id: 'koi',       name: 'Koi friends',        emoji: '🐟', price: 700,  level: 20, area: 'pond' },
    { id: 'stones',    name: 'Stepping stones',    emoji: '🪨', price: 620,  level: 21, area: 'pond' },
    { id: 'cattails',  name: 'Cattails',           emoji: '🌾', price: 560,  level: 22, area: 'pond' },
    { id: 'dock',      name: 'Little dock',        emoji: '🪵', price: 750,  level: 23, area: 'pond' },
    { id: 'fossil',    name: 'Fossil rock',        emoji: '🦴', price: 650,  level: 24, area: 'pond' },
    { id: 'firefly',   name: 'Firefly jar',        emoji: '🫙', price: 700,  level: 25, area: 'garden' },
    { id: 'duck',      name: 'Duck friend',        emoji: '🦆', price: 800,  level: 26, area: 'pond' },
    { id: 'rowboat',   name: 'Rowboat',            emoji: '🛶', price: 900,  level: 27, area: 'pond' },
    { id: 'firepit',   name: 'Fire pit',           emoji: '🔥', price: 850,  level: 28, area: 'garden' },
    { id: 'crug',      name: 'Constellation rug',  emoji: '🌌', price: 900,  level: 29, area: 'main' },
    { id: 'telescope', name: 'Telescope',          emoji: '🔭', price: 1000, level: 30, area: 'deck' },
    { id: 'mobile',    name: 'Shooting-star mobile', emoji: '🌠', price: 1200, level: 30, area: 'deck' }
  ],
```

- [ ] **Step 5: Run to verify it passes**

Run: `npm run test:catalog`
Expected: PASS — `catalog tests: all passed (37 items)`

- [ ] **Step 6: Full regression**

Run: `npm run test:gen && npm run test:level && npm run test:speech && PP_CHROMIUM="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" npm run test:app`
Expected: all PASS (the core-loop test buys `ball`, whose id and price are unchanged).

- [ ] **Step 7: Commit**

```bash
git add www/js/config.js tests/catalog_test.js package.json
git commit -m "feat(shop): 37-item catalog with level and area, plus AREAS data"
```

---

### Task 2: Shop gating

**Files:**
- Modify: `www/js/app.js` (the permanents block in `renderPet`, and `DECO_SPOTS`)
- Modify: `www/css/style.css`

**Interfaces:**
- Consumes: `PPConfig.PERMANENTS` (sorted), `PPLevel.displayLevel(pet)`.
- Produces: shop rows carry ids `#shop-<id>` as today; locked rows have class `item-btn locked`; the collapsed line has id `#shop-more`. Task 6's e2e depends on these.

- [ ] **Step 1: Extend `DECO_SPOTS`**

The four new main-area items need positions in the current scene. In `www/js/app.js`, extend `DECO_SPOTS`:

```js
  const DECO_SPOTS = {
    ball:   'left:12%; bottom:12px;',
    plant:  'right:10%; bottom:14px;',
    lamp:   'left:7%;  top:34%;',
    rug:    'right:26%; bottom:6px;',
    poster: 'right:8%; top:12%;',
    bowl:   'left:30%; bottom:8px;',
    shelf:  'right:6%; top:30%;',
    tent:   'left:4%;  bottom:10px;',
    crug:   'left:38%; bottom:4px;'
  };
```

(Plan 3 replaces this with per-area maps; only main-area items are placeable until then.)

- [ ] **Step 2: Replace the permanents block in `renderPet`**

Replace the whole `C.PERMANENTS.forEach(...)` block (currently `www/js/app.js:451-468`) with:

```js
    const lvNow = PPLevel.displayLevel(S.pet);
    const mains = C.PERMANENTS.filter(p => p.area === 'main');
    // Owned items are never hidden, whatever their level — a migrated save
    // may own above its backfilled level. Unowned items show at or below
    // the current level; the single next locked main tier is teased; all
    // deeper content collapses to one line (no item-by-item teasing).
    const visible = mains.filter(p => p.level <= lvNow || S.owned[p.id]);
    const nextLocked = mains.filter(p => p.level > lvNow && !S.owned[p.id]);
    const nextLevel = nextLocked.length ? nextLocked[0].level : null;

    visible.forEach(item => {
      const owned = !!S.owned[item.id];
      const b = document.createElement('button');
      b.className = 'item-btn' + (owned ? ' owned' : '');
      b.id = `shop-${item.id}`;
      b.innerHTML = `<span class="em">${item.emoji}</span><span class="nm">${item.name}</span>` +
        `<span class="pr">${owned ? 'in room ✓' : item.price + ' 🪙'}</span>`;
      b.disabled = owned || S.coins < item.price;
      if (!owned) b.addEventListener('click', () => {
        S.coins -= item.price;
        S.owned[item.id] = true;
        touch();
        log('buy_permanent', { item: item.id, cost: item.price });
        toast(`${item.name} added to the room! ${item.emoji}`);
        renderPet(true);
      });
      pr.appendChild(b);
    });

    nextLocked.filter(p => p.level === nextLevel).forEach(item => {
      const b = document.createElement('button');
      b.className = 'item-btn locked';
      b.id = `shop-${item.id}`;
      b.disabled = true;
      b.innerHTML = `<span class="em">${item.emoji}</span><span class="nm">${item.name}</span>` +
        `<span class="pr">Lv ${item.level} ✨</span>`;
      pr.appendChild(b);
    });

    // Anything beyond the next tier — deeper main levels and every unbuilt
    // area — is one quiet line, not a tease.
    if (nextLocked.some(p => p.level > nextLevel) || C.PERMANENTS.length > mains.length) {
      const more = document.createElement('div');
      more.className = 'shop-more';
      more.id = 'shop-more';
      more.textContent = `More to discover as ${S.pet.name} grows…`;
      pr.appendChild(more);
    }
```

- [ ] **Step 3: Add the styles**

Append to `www/css/style.css`:

```css
/* Shop gating */
.item-btn.locked { opacity: .55; }
.item-btn.locked .pr { color: var(--ink-soft); font-weight: 700; }
.shop-more {
  flex: 1 1 100%; text-align: center; color: var(--ink-soft);
  font-size: .8rem; font-style: italic; padding: 6px 0 2px;
}
```

- [ ] **Step 4: Full regression + manual check**

Run all four suites (same commands as Task 1 Step 6). Expected: all PASS — the core-loop test buys `ball` (level 1, visible at Lv 1) and its assertions are unchanged.
Then `npm run serve`, clear site data, onboard: shop shows ball + plant buyable, lamp + rug as `Lv 2 ✨`, and the "More to discover…" line. `PP._grantXp(70)` → reload the pet screen: bowl and poster now purchasable. **Kill the server; verify port 8080 is free.**

- [ ] **Step 5: Commit**

```bash
git add www/js/app.js www/css/style.css
git commit -m "feat(shop): gate by level — visible tier, one teased tier, quiet collapse"
```

---

### Task 3: Level-up overlay markup and styles

**Files:**
- Modify: `www/index.html`
- Modify: `www/css/style.css`

**Interfaces:**
- Produces DOM ids Task 4 wires and Task 6 tests: `#overlay-levelup`, `#levelup-sprite`, `#levelup-title`, `#levelup-list`, `#levelup-cta`.

This markup is inert until Task 4 — nothing shows it, so the app keeps working and all suites stay green.

- [ ] **Step 1: Add the overlay**

In `www/index.html`, after the rename overlay block and before `<div id="toast">`:

```html
<!-- Level-up overlay: shown after the win overlay's Continue and after any
     interstitial — never stacked on an ad, never mid-puzzle. -->
<div class="overlay" id="overlay-levelup">
  <div class="modal">
    <div class="levelup-sprite pet-sprite" id="levelup-sprite"></div>
    <h3 id="levelup-title">Level up!</h3>
    <div class="levelup-list" id="levelup-list"></div>
    <button class="primary-btn" id="levelup-cta">Continue</button>
  </div>
</div>
```

- [ ] **Step 2: Add the styles**

Append to `www/css/style.css`:

```css
/* Level-up overlay */
.levelup-sprite { display: inline-block; margin-bottom: 4px; }
.levelup-list { margin: 8px 0 12px; }
.levelup-list .unlock-row {
  background: #fffdf8; border: 1px solid var(--soft-line); border-radius: 10px;
  padding: 7px 10px; margin: 5px 0; font-weight: 700; font-size: .88rem;
}
```

- [ ] **Step 3: Verify and commit**

Run: `npm run test:gen && npm run test:catalog` (fast sanity — markup can't break Node suites; a serve check is optional).

```bash
git add www/index.html www/css/style.css
git commit -m "feat(levelup): overlay markup and styles (inert until wired)"
```

---

### Task 4: Queue and wire the overlay

**Files:**
- Modify: `www/js/app.js` (`awardXp`, win-continue handler, new helpers)
- Modify: `tests/app_test.spec.js` (the leveling test must handle the overlay it now triggers)

**Interfaces:**
- Consumes: `#overlay-levelup` ids (Task 3), sorted `PERMANENTS` (Task 1), `overlay(id, on)`, `PPSprites.svg`.
- Produces: `unlocksFor(from, to) -> string[]`, `maybeLevelUpOverlay()`. The `level_up` event and `awardXp`'s return contract are unchanged.

- [ ] **Step 1: Queue instead of toast**

In `awardXp` (`www/js/app.js`), replace the toast line inside `if (after > before)`:

```js
    if (after > before) {
      S.pet.levelHigh = after;
      log('level_up', { level: after });
      // Queued, not shown: the overlay appears after the win overlay's
      // Continue and after any interstitial. Crossing two thresholds before
      // it shows merges into one overlay (lowest from, highest to).
      pendingLevelUp = { from: pendingLevelUp ? pendingLevelUp.from : before, to: after };
    }
```

Declare `let pendingLevelUp = null;` next to the other module-level state (near `let selSpecies`). The queue is in-memory only — a reload between win and Continue drops the *moment*, never the level itself (`level_up` is already logged and `levelHigh` saved).

- [ ] **Step 2: Add the helpers**

After `awardXp`, add:

```js
  // Main-area unlocks between two levels, as display strings. Plan 3 adds
  // area lines here; plan 4 adds species lines.
  function unlocksFor(from, to) {
    return C.PERMANENTS
      .filter(p => p.area === 'main' && p.level > from && p.level <= to)
      .map(p => `${p.emoji} ${p.name}`);
  }

  function maybeLevelUpOverlay() {
    if (!pendingLevelUp) return;
    const p = pendingLevelUp;
    pendingLevelUp = null;
    $('levelup-title').textContent = `${S.pet.name} grew to Level ${p.to}!`;
    $('levelup-sprite').innerHTML = PPSprites.svg(S.pet.species, 'happy', 96);
    const items = unlocksFor(p.from, p.to);
    $('levelup-list').innerHTML = items.map(s => `<div class="unlock-row">${s}</div>`).join('');
    const cta = $('levelup-cta');
    cta.textContent = items.length ? 'See the shop' : 'Continue';
    cta.dataset.dest = items.length ? 'shop' : 'stay';
    overlay('overlay-levelup', true);
    const sp = $('levelup-sprite');
    sp.classList.remove('bounce'); void sp.offsetWidth; sp.classList.add('bounce');
  }

  $('levelup-cta').addEventListener('click', () => {
    overlay('overlay-levelup', false);
    if ($('levelup-cta').dataset.dest === 'shop') { renderPet(); show('screen-pet'); }
  });
```

- [ ] **Step 3: Show it after the interstitial**

In the win-continue handler, add one line at the end of the `maybeInterstitial` callback, after `show(dest);`:

```js
      maybeLevelUpOverlay();
```

- [ ] **Step 4: Teach the leveling e2e about the overlay**

The `xp comes from solving only, and levels ratchet up` test crosses L2 with a real solve, so the overlay now appears after `continueWin`. In `tests/app_test.spec.js`, immediately after that crossing's `await continueWin(page);`, add:

```js
  // Crossing L2 queues the level-up overlay; it appears after Continue
  // (and any interstitial), never stacked. L2's unlocks are main items.
  await expect(page.locator('#overlay-levelup')).toHaveClass(/show/);
  await expect(page.locator('#levelup-title')).toContainText('Level 2');
  await expect(page.locator('#levelup-list')).toContainText('Cozy lamp');
  await expect(page.locator('#levelup-list')).toContainText('Warm rug');
  await expect(page.locator('#levelup-cta')).toHaveText('See the shop');
  await page.click('#levelup-cta');
  await expect(page.locator('#screen-pet')).toHaveClass(/active/);
  await page.click('#pet-back');
```

Then check the rest of the test still flows (it reads state and the chip afterward — the added `#pet-back` returns home first).

- [ ] **Step 5: Full regression**

All four suites. Expected: PASS, including the updated leveling test.
Manual: `npm run serve`, fresh profile, `PP._grantXp(59)`, solve the easy daily → win overlay → Continue → the level-up overlay bounces in with lamp + rug listed → "See the shop" lands on the pet room with both now purchasable. **Kill the server; check port 8080.**

- [ ] **Step 6: Commit**

```bash
git add www/js/app.js tests/app_test.spec.js
git commit -m "feat(levelup): queued overlay after win continue, never stacked on ads"
```

---

### Task 5: Stretch the speech tiers

**Files:**
- Modify: `www/js/speech.js`
- Modify: `tests/speech_test.js`

**Interfaces:**
- Consumes/produces: none beyond `PPSpeech.LINES` data — `pick(ctx)`'s contract is unchanged.

- [ ] **Step 1: Update the test first**

In `tests/speech_test.js`:
- Change the pick-sweep loop bound from `level <= 12` to `level <= 30`.
- After the well-formedness block, add:

```js
// Tiers stretch across the 30-level curve: highest gate is 20, so the
// pet's voice keeps deepening deep into the long tail.
check(Math.max(...PPSpeech.LINES.map(l => l.minLevel)) === 20, 'deepest tier is minLevel 20');
check(PPSpeech.LINES.filter(l => l.minLevel === 20).length >= 3, 'the deep tier has lines');
```

Run: `npm run test:speech` — expected FAIL (`deepest tier is minLevel 20`).

- [ ] **Step 2: Remap the minLevels**

In `www/js/speech.js`, remap every line's `minLevel` (same 22 lines, no copy changes): `1 → 1`, `2 → 3`, `3 → 6`, `5 → 12`, `8 → 20`. Update the header comment listing the tiers to `1, 3, 6, 12, 20`, and the per-tier section comments (`Tier 2 (level 3)`, `Tier 3 (level 6)`, `Tier 4 (level 12)`, `Tier 5 (level 20)`).

- [ ] **Step 3: Run to verify**

Run: `npm run test:speech`
Expected: PASS — `speech tests: all passed (22 lines)`

- [ ] **Step 4: Commit**

```bash
git add www/js/speech.js tests/speech_test.js
git commit -m "feat(speech): stretch tiers to 1/3/6/12/20 for the 30-level curve"
```

---

### Task 6: Shop-gating e2e and docs

**Files:**
- Modify: `tests/app_test.spec.js`
- Modify: `CLAUDE.md` (one line)

**Interfaces:**
- Consumes: `#shop-<id>`, `.item-btn.locked`, `#shop-more` (Task 2); `window.PP._grantXp`.

- [ ] **Step 1: Add the shop-gating test**

Append to `tests/app_test.spec.js`:

```js
test('the shop gates by level: visible tier, one teased tier, quiet collapse', async ({ page }) => {
  await page.goto('/');
  await page.click('#onb-welcome-go');
  await page.click('#species-dog');
  await page.click('#onb-choose-go');
  await page.click('#onb-name-go');
  await page.click('#onb-arrive-go');

  await page.click('#btn-pet');
  // Lv 1: ball + plant purchasable; lamp + rug teased as the next tier;
  // nothing deeper visible; the collapse line present; no non-main item.
  await expect(page.locator('#shop-ball')).toBeVisible();
  await expect(page.locator('#shop-plant')).toBeVisible();
  await expect(page.locator('#shop-lamp')).toHaveClass(/locked/);
  await expect(page.locator('#shop-lamp')).toBeDisabled();
  await expect(page.locator('#shop-lamp .pr')).toHaveText('Lv 2 ✨');
  await expect(page.locator('#shop-bowl')).toHaveCount(0);      // deeper main tier: hidden
  await expect(page.locator('#shop-cushion')).toHaveCount(0);   // unbuilt area: hidden
  await expect(page.locator('#shop-more')).toContainText('More to discover');

  // Level up to 3: bowl + poster join the shop; the tease moves to Lv 4.
  await page.evaluate(() => window.PP._grantXp(window.PPConfig.LEVEL_XP[1]));  // 150 → Lv 3
  await page.click('#pet-back');
  await page.click('#btn-pet');
  await expect(page.locator('#shop-bowl')).toBeVisible();
  await expect(page.locator('#shop-bowl')).not.toHaveClass(/locked/);
  await expect(page.locator('#shop-shelf .pr')).toHaveText('Lv 4 ✨');

  // Buy something newly unlocked and see it land in the room.
  await page.evaluate(() => window.PP._grant(200));
  await page.click('#shop-bowl');
  await expect(page.locator('.deco')).toHaveCount(1);
  await expect(page.locator('#shop-bowl .pr')).toHaveText('in room ✓');
});
```

- [ ] **Step 2: Run the suite**

Run: `PP_CHROMIUM="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" npm run test:app`
Expected: 6/6 PASS — core loop, determinism, leveling (now including the overlay steps from Task 4), v1 migration, v2 migration, and this shop-gating test. If the runner reports a different count, look before adjusting anything.

- [ ] **Step 3: One doc line**

In `CLAUDE.md`, in the layout list, extend the `config.js` line to mention the catalog, e.g. append: `— includes the 37-item level/area catalog (AREAS + PERMANENTS)`.

- [ ] **Step 4: Full regression, then commit**

All four suites green.

```bash
git add tests/app_test.spec.js CLAUDE.md
git commit -m "test(shop): gating e2e — visible, teased, collapsed, purchasable"
```

---

## Handoff

- **Plan 3 (room areas)** consumes: `AREAS` config (already shaped), the catalog's `area` fields, and replaces `DECO_SPOTS` with per-area maps. It extends `unlocksFor` with area lines ("🏡 Garden") and regroups the shop by area once ≥2 areas are unlocked. The collapsed `#shop-more` line is where hidden-area items graduate from.
- **Plan 4 (species + onboarding)** owns: `SPECIES_UNLOCKS` config, the overlay's species variant ("Meet them" CTA), retroactive `species_unlocked` grants from level history, the friends switcher, **and spec §4's onboarding remainder (3-beat flow + first-day toast) — assigned there by owner decision 2026-07-26.**
- The level-up *moment* is in-memory: a reload between win and Continue skips the overlay but never the level or the `level_up` event. If plans 3/4 want replayable moments, derive them from the event log.
