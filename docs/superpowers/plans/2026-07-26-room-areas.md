# Room Areas (v2 slice 3 of 4) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the growing world: the room becomes a horizontally-scrolling strip of areas (main → nook → garden → pond → deck) that unlock at levels 1/5/10/20/30, the 28 hidden catalog items graduate into an area-grouped shop, and area unlocks headline the level-up overlay with a "Visit the room" CTA.

**Architecture:** The scene becomes a scroll-snap viewport over a flex strip; `renderPet` builds one panel per *unlocked* area (locked areas simply don't exist in the DOM — pause-don't-tease). `DECO_SPOTS` moves to `config.js` as per-area maps on a collision-free lattice, which makes placement geometry Node-testable. The shop gates by `area.level` + `item.level` and groups by area once ≥2 areas are unlocked. `unlocksFor` gains area lines; the overlay CTA gains a 'room' destination that scrolls the new panel into view with a brief sparkle.

**Tech Stack:** Plain HTML/CSS/JS, no build step. Node unit tests, Playwright e2e.

**Source spec:** `docs/superpowers/specs/2026-07-25-pet-leveling-v2-level-30.md` §8 (areas), §9 (CTA variants), §11 (shop grouping, pet-room title).

**Implementation decisions (spec §14 delegated these):**
- One horizontally-scrolling composition with CSS scroll-snap paging; each panel is one viewport wide. No vertical growth.
- **The pet stays in the main panel.** The deck "any species stargazing" postcard is a later polish item, recorded in the handoff.
- `DECO_SPOTS` moves from `app.js` to `config.js` (layout data is data; Node tests can then lint the geometry).
- `AREAS[0]` (main) gains `name: 'Home'` for shop group headers; it is still never listed as an "unlock" (nothing crosses *to* level 1).
- Deferred items absorbed from plan 2: `pet-back` returns to the screen the room was entered from; the tight crug margin dissolves with the per-area rebuild (main keeps its empirically-verified legacy spots).

## Global Constraints

- **Locked areas do not render, tease, or silhouette.** No locked doors. The shop's collapse line stays the only acknowledgment of hidden content.
- **An owned item is never hidden** — in the shop or the room. If an owned item's area panel is somehow absent (corrupt save), the decor falls back to the main panel rather than vanishing.
- **Area gating is level gating:** an item is purchasable when `item.level <= displayLevel` — the catalog invariant `item.level >= area.level` (test-enforced) guarantees its area is unlocked by then. Nothing else gates; coins are never a gate, only a price.
- **The overlay never stacks on an ad** (unchanged queue/drain mechanics — this plan only extends its content and CTA).
- **New-area decor lattice must be provably collision-free** — Node-tested geometry, not eyeballed. Main's nine legacy spots are grandfathered (verified empirically via rendered rects in plan 2) and excluded from the lattice test.
- **XP/level rules unchanged**; all tunables in `config.js`; every meaningful action logs; pets are "they"; species-neutral; no guilt or sadness.
- Environment: Playwright needs `PP_CHROMIUM="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"`.
- **No red window.** Every task leaves all five suites green. Task 4 updates the one e2e test whose expectations legitimately change (the L4→L5 crossing stops being empty — that's the feature).

## File Structure

| File | Status | Responsibility |
|---|---|---|
| `www/js/config.js` | Modify | `DECO_SPOTS` per-area maps (all 37 items), `name: 'Home'` on main |
| `tests/catalog_test.js` | Modify | Spot coverage + lattice geometry lint |
| `www/index.html` | Modify | `#scene` → strip viewport with a static main panel |
| `www/css/style.css` | Modify | Strip/panel/scroll-snap, per-area backdrops, sparkle |
| `www/js/app.js` | Modify | Panel building, per-area decor, shop grouping, overlay areas + CTA, pet-back return, title |
| `tests/app_test.spec.js` | Modify | Area render/unlock e2e, nook purchase, grouping, CTA; update the repurposed fallback test |
| `CLAUDE.md` | Modify | One line: areas live in config |

Out of scope (plan 4): species unlocks/`SPECIES_UNLOCKS`, friends switcher, retroactive `species_unlocked`, onboarding rework, "Meet them" CTA variant.

---

### Task 1: Spots to config, geometry proven

**Files:**
- Modify: `www/js/config.js`
- Modify: `tests/catalog_test.js`

**Interfaces:**
- Consumes: `PPConfig.PERMANENTS` (37 items with `area`), `PPConfig.AREAS`.
- Produces: `PPConfig.DECO_SPOTS` — `{ main: {id: cssText}, nook: {...}, garden: {...}, pond: {...}, deck: {...} }`, every catalog item covered, keyed under its own area. `AREAS[0]` gains `name: 'Home'`.

**Transitional state, deliberate:** `app.js` keeps its local flat `DECO_SPOTS` until Task 2 — the config copy is unused for one commit. All suites stay green.

- [ ] **Step 1: Extend the catalog test**

Append to `tests/catalog_test.js` before the final `if (failures)` block:

```js
// --- Decor spots: every item has a spot, in its own area's map ---
C.PERMANENTS.forEach(p => {
  const spot = C.DECO_SPOTS[p.area] && C.DECO_SPOTS[p.area][p.id];
  check(typeof spot === 'string' && spot.length > 0, `${p.id} has a spot in ${p.area}`);
});
Object.keys(C.DECO_SPOTS).forEach(areaId => {
  check(AREA_IDS.includes(areaId), `spot map ${areaId} is a real area`);
  Object.keys(C.DECO_SPOTS[areaId]).forEach(id => {
    const item = C.PERMANENTS.find(p => p.id === id);
    check(item && item.area === areaId, `spot ${areaId}/${id} matches the item's area`);
  });
});

// --- Lattice geometry: non-main spots must be provably collision-free.
// Panels are modeled at 320x240 with a 28px glyph box. Main's nine legacy
// spots are grandfathered (verified via real rendered rects in plan 2)
// and excluded here; every NEW area must keep >= 4px clearance.
function box(css) {
  const W = 320, H = 240, G = 28;
  const get = (re) => { const m = css.match(re); return m ? parseFloat(m[1]) : null; };
  const lp = get(/left:\s*([\d.]+)%/), rp = get(/right:\s*([\d.]+)%/);
  const tp = get(/top:\s*([\d.]+)%/), bp = get(/bottom:\s*([\d.]+)px/);
  const x = lp !== null ? W * lp / 100 : W - (W * rp / 100) - G;
  const y = tp !== null ? H * tp / 100 : H - bp - G;
  return { x1: x, y1: y, x2: x + G, y2: y + G };
}
['nook', 'garden', 'pond', 'deck'].forEach(areaId => {
  const entries = Object.entries(C.DECO_SPOTS[areaId]);
  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      const a = box(entries[i][1]), b = box(entries[j][1]);
      const clear = a.x2 + 4 <= b.x1 || b.x2 + 4 <= a.x1 || a.y2 + 4 <= b.y1 || b.y2 + 4 <= a.y1;
      check(clear, `${areaId}: ${entries[i][0]} and ${entries[j][0]} keep 4px clearance`);
    }
  }
});
```

Run: `npm run test:catalog` — expected FAIL (`C.DECO_SPOTS` undefined).

- [ ] **Step 2: Add the config data**

In `www/js/config.js`: change `{ id: 'main',   level: 1 }` to `{ id: 'main',   level: 1,  name: 'Home' }`.

After the `AREAS` block, add the spot maps. Main carries today's nine values verbatim (grandfathered); the four new areas use a lattice — columns at 8/30/52/74% (≥70px apart > 28px glyph), rows at top:16%, top:48%, and the floor:

```js
  DECO_SPOTS: {                      // per-area decor positions; lattice geometry is test-enforced
    main: {
      ball:   'left:12%; bottom:12px;',
      plant:  'right:10%; bottom:14px;',
      lamp:   'left:7%;  top:34%;',
      rug:    'right:26%; bottom:6px;',
      poster: 'right:8%; top:12%;',
      bowl:   'left:24%; top:56%;',
      shelf:  'right:6%; top:30%;',
      tent:   'left:22%; bottom:8px;',
      crug:   'right:18%; bottom:2px;'
    },
    nook: {
      cushion:  'left:8%;  bottom:10px;',
      aquarium: 'left:30%; bottom:10px;',
      toychest: 'left:52%; bottom:10px;',
      lights:   'left:30%; top:16%;',
      chimes:   'left:52%; top:16%;',
      frame:    'left:74%; top:16%;'
    },
    garden: {
      flowerbed: 'left:8%;  bottom:10px;',
      veggie:    'left:30%; bottom:10px;',
      mushroom:  'left:52%; bottom:10px;',
      firepit:   'left:74%; bottom:10px;',
      gnome:     'left:8%;  top:48%;',
      clover:    'left:30%; top:48%;',
      hammock:   'left:52%; top:48%;',
      firefly:   'left:74%; top:48%;',
      swing:     'left:8%;  top:16%;',
      birdhouse: 'left:30%; top:16%;',
      lantern:   'left:52%; top:16%;',
      fountain:  'left:74%; top:16%;'
    },
    pond: {
      lily:     'left:8%;  bottom:10px;',
      stones:   'left:30%; bottom:10px;',
      cattails: 'left:52%; bottom:10px;',
      dock:     'left:74%; bottom:10px;',
      fossil:   'left:8%;  top:48%;',
      koi:      'left:30%; top:48%;',
      duck:     'left:52%; top:48%;',
      rowboat:  'left:74%; top:48%;'
    },
    deck: {
      telescope: 'left:30%; bottom:10px;',
      mobile:    'left:52%; top:16%;'
    }
  },
```

- [ ] **Step 3: Verify and regress**

Run: `npm run test:catalog` → PASS. Then `npm run test:gen && npm run test:level && npm run test:speech && PP_CHROMIUM="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" npm run test:app` → all PASS (config addition is inert).

- [ ] **Step 4: Commit**

```bash
git add www/js/config.js tests/catalog_test.js
git commit -m "feat(areas): per-area decor spot maps in config, geometry test-enforced"
```

---

### Task 2: The scrolling scene

**Files:**
- Modify: `www/index.html` (the `#scene` block)
- Modify: `www/css/style.css`
- Modify: `www/js/app.js` (scene half of `renderPet`; delete the local `DECO_SPOTS`)

**Interfaces:**
- Consumes: `PPConfig.DECO_SPOTS`, `PPConfig.AREAS`, `PPLevel.displayLevel`.
- Produces: `#scene-strip`; per-area panels `#area-<id>` with class `area area-<id>` (built by `renderPet` for unlocked areas; `#area-main` is static and always present); decor renders INTO its area's panel. Task 4 consumes `#area-<id>` for scroll-into-view; Task 5's e2e consumes the ids.

- [ ] **Step 1: Restructure the scene markup**

In `www/index.html`, replace the current `#scene` contents:

```html
    <div class="scene" id="scene">
      <div class="scene-strip" id="scene-strip">
        <div class="area area-main" id="area-main">
          <div class="speech" id="pet-speech"></div>
          <div class="pet-sprite" id="pet-sprite"></div>
        </div>
      </div>
    </div>
```

(`#pet-speech` and `#pet-sprite` keep their ids — no JS or test references change.)

- [ ] **Step 2: Strip and panel styles**

In `www/css/style.css`, update `.scene` and add panels. Replace the existing `.scene { ... }` rule and add after it:

```css
.scene {
  position: relative; height: 240px; border-radius: var(--radius); overflow: hidden;
  border: 1px solid var(--soft-line); margin-bottom: 14px;
}
.scene-strip {
  display: flex; height: 100%; overflow-x: auto; scroll-snap-type: x mandatory;
  scrollbar-width: none;
}
.scene-strip::-webkit-scrollbar { display: none; }
.area {
  position: relative; flex: 0 0 100%; height: 100%; scroll-snap-align: start;
}
.area-main   { background: linear-gradient(#fdeed9 0%, #fbf7ef 55%, #f0e3cf 55%, #ead9bf 100%); }
.area-nook   { background: linear-gradient(#f6e7d3 0%, #fdf6ea 55%, #eadfc9 55%, #e2d3b8 100%); }
.area-garden { background: linear-gradient(#dceefb 0%, #eaf6e6 55%, #cfe5c4 55%, #b9d8ab 100%); }
.area-pond   { background: linear-gradient(#d8ecf7 0%, #e6f3f8 55%, #bcd9e8 55%, #a5cade 100%); }
.area-deck   { background: linear-gradient(#2e3457 0%, #4a4a76 60%, #6b5d8a 60%, #574b73 100%); }
.area .area-label {
  position: absolute; top: 8px; right: 10px; font-size: .7rem; font-weight: 700;
  color: rgba(74,63,53,.55); background: rgba(255,255,255,.55);
  padding: 2px 8px; border-radius: 999px;
}
.area-deck .area-label { color: rgba(255,255,255,.75); background: rgba(0,0,0,.25); }
.area.sparkle::after {
  content: '✨'; position: absolute; inset: 0; display: flex;
  align-items: center; justify-content: center; font-size: 2rem;
  animation: sparkle-fade 1.2s ease forwards; pointer-events: none;
}
@keyframes sparkle-fade { 0% { opacity: 0; transform: scale(.6); } 30% { opacity: 1; } 100% { opacity: 0; transform: scale(1.4); } }
```

Existing `.scene .pet-sprite`, `.scene .deco`, `.scene .speech` rules keep working — panels are inside `.scene`. Fix the background note: `.scene`'s old gradient moved onto `.area-main`.

- [ ] **Step 3: Panel-aware rendering in `renderPet`**

In `www/js/app.js`, delete the module-level `const DECO_SPOTS = {...}` entirely. In `renderPet`, replace the scene block (`const scene = $('scene');` through the owned-items loop) with:

```js
    const lvNowScene = PPLevel.displayLevel(S.pet);
    const strip = $('scene-strip');
    // Build one panel per UNLOCKED area; locked areas do not exist in the
    // DOM at all — no doors, no silhouettes. Main's panel is static.
    strip.querySelectorAll('.area:not(.area-main)').forEach(e => e.remove());
    C.AREAS.filter(a => a.id !== 'main' && a.level <= lvNowScene).forEach(a => {
      const panel = document.createElement('div');
      panel.className = `area area-${a.id}`;
      panel.id = `area-${a.id}`;
      const label = document.createElement('div');
      label.className = 'area-label';
      label.textContent = a.name;
      panel.appendChild(label);
      strip.appendChild(panel);
    });
    strip.querySelectorAll('.deco').forEach(e => e.remove());
    Object.keys(S.owned).forEach(id => {
      const item = C.PERMANENTS.find(p => p.id === id);
      if (!item) return;
      // Owned is never hidden: if the item's panel is missing (corrupt
      // save), it falls back to the main panel rather than vanishing.
      const host = $(`area-${item.area}`) || $('area-main');
      const spots = C.DECO_SPOTS[item.area] || {};
      const el = document.createElement('div');
      el.className = 'deco';
      el.style.cssText = spots[id] || 'left:20%; bottom:10px;';
      el.textContent = item.emoji;
      host.appendChild(el);
    });
```

- [ ] **Step 4: Regress and verify by hand**

All five suites green (the existing `.deco` count-1 assertion is page-wide and unaffected; `#shop-cushion` count-0 at Lv 1 unaffected — the shop is Task 3).
Manual: serve, fresh profile → one panel, no scroll. `PP._grantXp(700)` (Lv 6) → re-enter pet room → nook panel scrollable into view with its label. **Kill the server; check 8080.**

- [ ] **Step 5: Commit**

```bash
git add www/index.html www/css/style.css www/js/app.js
git commit -m "feat(areas): scroll-snap scene strip; unlocked panels only; per-area decor"
```

---

### Task 3: Area-aware shop with grouping

**Files:**
- Modify: `www/js/app.js` (the permanents block in `renderPet`)
- Modify: `www/css/style.css`

**Interfaces:**
- Consumes: `PPConfig.AREAS` (with `name`), catalog `area` fields, `C.SHOP_TEASE_RANGE`.
- Produces: shop rows still `#shop-<id>`; group headers `.shop-area-head` (text = area name) appear once ≥2 areas are unlocked; `#shop-more` semantics unchanged (real hidden count).

- [ ] **Step 1: Replace the shop's item-selection logic**

In `renderPet`'s permanents block, replace from `const lvNow = ...` down to (not including) the `visible.forEach` with:

```js
    const lvNow = PPLevel.displayLevel(S.pet);
    const unlockedAreas = C.AREAS.filter(a => a.level <= lvNow).map(a => a.id);
    const inUnlocked = C.PERMANENTS.filter(p => unlockedAreas.includes(p.area));
    // Owned is never hidden; otherwise an item shows once its level is
    // reached (its area is unlocked by then — catalog invariant, tested).
    const visible = inUnlocked.filter(p => p.level <= lvNow || S.owned[p.id]);
    const nextLocked = inUnlocked.filter(p => p.level > lvNow && !S.owned[p.id]);
    const nextLevel = nextLocked.length ? nextLocked[0].level : null;
    const teaseInRange = nextLevel !== null && (nextLevel - lvNow) <= C.SHOP_TEASE_RANGE;
    const teased = teaseInRange ? nextLocked.filter(p => p.level === nextLevel) : [];
    const grouping = unlockedAreas.length >= 2;
```

Then replace the two render loops (`visible.forEach` and `teased.forEach`) with an area-grouped render. Rows themselves are unchanged; they are just emitted per area with a header when `grouping`:

```js
    const renderRow = (item, locked) => {
      const owned = !!S.owned[item.id];
      const b = document.createElement('button');
      b.id = `shop-${item.id}`;
      if (locked) {
        b.className = 'item-btn locked';
        b.disabled = true;
        b.innerHTML = `<span class="em">${item.emoji}</span><span class="nm">${item.name}</span>` +
          `<span class="pr">Unlocks at Lv ${item.level} ✨</span>`;
      } else {
        b.className = 'item-btn' + (owned ? ' owned' : '');
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
      }
      pr.appendChild(b);
    };

    C.AREAS.forEach(a => {
      const rows = [
        ...visible.filter(p => p.area === a.id).map(p => [p, false]),
        ...teased.filter(p => p.area === a.id).map(p => [p, true])
      ];
      if (!rows.length) return;
      if (grouping) {
        const head = document.createElement('div');
        head.className = 'shop-area-head';
        head.textContent = a.name;
        pr.appendChild(head);
      }
      rows.forEach(([item, locked]) => renderRow(item, locked));
    });
```

The collapse-line block after it is unchanged (its `renderedIds`/`hiddenCount` math already uses `visible`/`teased`).

- [ ] **Step 2: Header style**

Append to `www/css/style.css`:

```css
.shop-area-head {
  flex: 1 1 100%; font-size: .78rem; font-weight: 800; color: var(--ink-soft);
  text-transform: uppercase; letter-spacing: .04em; margin: 6px 0 -2px;
}
```

- [ ] **Step 3: Regress**

All five suites green. The shop e2e's Lv-1 and Lv-3 assertions hold: one area unlocked → no headers, same rows as before. Manual: `PP._grantXp(700)` → Home and Window nook sections, cushion/lights/toychest purchasable, aquarium teased (`Unlocks at Lv 9 ✨`). Kill the server; check 8080.

- [ ] **Step 4: Commit**

```bash
git add www/js/app.js www/css/style.css
git commit -m "feat(shop): area-aware gating and grouped sections once two areas exist"
```

---

### Task 4: Overlay areas, "Visit the room", return-to, title

**Files:**
- Modify: `www/js/app.js` (`unlocksFor`, `maybeLevelUpOverlay`, CTA handler, `pet-back`, `btn-pet`, `pet-title`)
- Modify: `tests/app_test.spec.js` (the repurposed no-unlocks test + the overlay-content pins that legitimately change)

**Interfaces:**
- Consumes: `#area-<id>` panels (Task 2), `AREAS.name`.
- Produces: `unlocksFor(from, to)` now returns `{ lines: string[], newArea: string|null }` (id of the highest newly-unlocked area, or null); CTA dest `'room'`; `petReturnTo` behavior.

- [ ] **Step 1: Extend `unlocksFor`**

Replace it with:

```js
  // Everything a crossing unlocks: area lines first (the headline), then
  // items the player doesn't already own. Species lines are plan 4.
  function unlocksFor(from, to) {
    const lines = [];
    let newArea = null;
    C.AREAS.filter(a => a.id !== 'main' && a.level > from && a.level <= to).forEach(a => {
      lines.push(`🏡 ${a.name}`);
      newArea = a.id;
    });
    C.PERMANENTS
      .filter(p => p.level > from && p.level <= to && !S.owned[p.id])
      .forEach(p => lines.push(`${p.emoji} ${p.name}`));
    return { lines, newArea };
  }
```

- [ ] **Step 2: Overlay uses lines + the room CTA**

In `maybeLevelUpOverlay`, replace the `items`/CTA section:

```js
    const u = unlocksFor(p.from, p.to);
    $('levelup-list').innerHTML = u.lines.length
      ? u.lines.map(s => `<div class="unlock-row">${s}</div>`).join('')
      : '<div class="unlock-row">💛 Growing stronger together</div>';
    const cta = $('levelup-cta');
    cta.textContent = u.newArea ? 'Visit the room' : (u.lines.length ? 'See the shop' : 'Continue');
    cta.dataset.dest = u.newArea ? 'room' : (u.lines.length ? 'shop' : 'stay');
    cta.dataset.area = u.newArea || '';
```

And the CTA handler:

```js
  $('levelup-cta').addEventListener('click', () => {
    overlay('overlay-levelup', false);
    const cta = $('levelup-cta');
    if (cta.dataset.dest === 'stay') return;
    petReturnTo = document.querySelector('.screen.active').id;
    renderPet();
    show('screen-pet');
    if (cta.dataset.dest === 'room' && cta.dataset.area) {
      const panel = $(`area-${cta.dataset.area}`);
      if (panel) {
        panel.scrollIntoView({ behavior: 'smooth', inline: 'start' });
        panel.classList.add('sparkle');
        setTimeout(() => panel.classList.remove('sparkle'), 1300);
      }
    }
  });
```

- [ ] **Step 3: Return-to and title**

Add `let petReturnTo = 'screen-home';` next to `pendingLevelUp`. The `btn-pet` handler sets `petReturnTo = 'screen-home';` before showing. Replace the `pet-back` handler:

```js
  $('pet-back').addEventListener('click', () => {
    const dest = petReturnTo;
    petReturnTo = 'screen-home';
    if (dest === 'screen-calendar') renderCalendar(); else renderHome();
    show(dest);
  });
```

In `renderPet`, the title becomes: `` $('pet-title').textContent = `${S.pet.name} the ${S.pet.species} · Lv ${PPLevel.displayLevel(S.pet)}`; ``

- [ ] **Step 4: Update the two e2e expectations that legitimately change**

In `tests/app_test.spec.js`:

1. The `level-up overlay with no main unlocks...` test crossed L4→L5 expecting the fallback — but L5 now unlocks the nook. Repurpose it (rename to `crossing an area level headlines the area and visits the room`): same XP staging, but assert `#levelup-list` contains `🏡 Window nook`, `Window cushion`, and `String lights`; CTA text `Visit the room`; click it; assert `#screen-pet` active AND `#area-nook` exists. Then `#pet-back` → home (asserts the return-to default).
2. Add a NEW, separate test block (`a crossing with nothing new falls back warmly`) for the genuine fallback case: fresh onboard, then pre-own the L6 unlock in-page (`await page.evaluate(() => { const s = window.PP.state(); s.owned.toychest = true; })`), stage XP one easy-solve below `LEVEL_XP[4]` (L6's threshold, 630), solve, Continue → assert the fallback row `Growing stronger together` and CTA `Continue`. (L6's only unlock is the toychest; owning it makes the crossing genuinely empty.)

`pet-title` assertions: the core-loop test uses `toContainText('Pip')` — unaffected by the ` · Lv n` suffix.

- [ ] **Step 5: Full regression**

All five suites green. Manual: `_grantXp(429)` (one below L5), solve easy → overlay leads with `🏡 Window nook` → "Visit the room" → scene scrolls to the sparkling nook panel. Kill the server; check 8080.

- [ ] **Step 6: Commit**

```bash
git add www/js/app.js tests/app_test.spec.js
git commit -m "feat(areas): overlay headlines new areas, room CTA scrolls and sparkles, pet-back returns"
```

---

### Task 5: Area e2e and docs

**Files:**
- Modify: `tests/app_test.spec.js`
- Modify: `CLAUDE.md`

**Interfaces:**
- Consumes: everything above.

- [ ] **Step 1: Add the areas e2e test**

```js
test('areas unlock as panels, decor lands in its area, shop groups', async ({ page }) => {
  await page.goto('/');
  await page.click('#onb-welcome-go');
  await page.click('#species-cat');
  await page.click('#onb-choose-go');
  await page.click('#onb-name-go');
  await page.click('#onb-arrive-go');

  // Lv 1: only the main panel exists — locked areas are absent, not teased.
  await page.click('#btn-pet');
  await expect(page.locator('.area')).toHaveCount(1);
  await expect(page.locator('#area-nook')).toHaveCount(0);
  await expect(page.locator('.shop-area-head')).toHaveCount(0);   // one area → no headers

  // Reach Lv 5: the nook panel appears with its label; shop grows headers.
  await page.evaluate(() => window.PP._grantXp(window.PPConfig.LEVEL_XP[3]));  // 430 → Lv 5
  await page.click('#pet-back');
  await page.click('#btn-pet');
  await expect(page.locator('#area-nook')).toHaveCount(1);
  await expect(page.locator('#area-nook .area-label')).toHaveText('Window nook');
  await expect(page.locator('#area-garden')).toHaveCount(0);      // still locked, still absent
  await expect(page.locator('.shop-area-head')).toHaveCount(2);   // Home + Window nook

  // Buy a nook item: the decor lands in the nook panel, not main.
  await page.evaluate(() => window.PP._grant(400));
  await page.click('#pet-back');
  await page.click('#btn-pet');
  await page.click('#shop-cushion');
  await expect(page.locator('#area-nook .deco')).toHaveCount(1);
  await expect(page.locator('#area-main .deco')).toHaveCount(0);

  // The pet-room title carries the level.
  await expect(page.locator('#pet-title')).toContainText('· Lv 5');
});
```

- [ ] **Step 2: Full suite**

Run everything. Expected: 9 e2e tests pass (7 prior, one repurposed still counts as one, plus this one and the fallback split from Task 4 — check the count the runner reports and account for every test by name before adjusting anything).

- [ ] **Step 3: Doc line**

In `CLAUDE.md`'s layout list, extend the config line: append `; room areas + per-area decor spots (AREAS/DECO_SPOTS)`.

- [ ] **Step 4: Commit**

```bash
git add tests/app_test.spec.js CLAUDE.md
git commit -m "test(areas): panels, per-area decor, grouped shop, leveled title"
```

---

## Handoff to plan 4

- Species unlocks: `SPECIES_UNLOCKS` config, the overlay's species variant ("Meet them" CTA — extend `unlocksFor`'s return with a `newSpecies` field), retroactive `species_unlocked` from level history, the friends switcher, and spec §4's onboarding remainder (owner-assigned).
- The deck's "any species stargazing" postcard (pet visiting other panels) — polish, unowned.
- `#shop-more` naturally shrinks as areas unlock; it goes false only when everything is shown or owned — already correct, no plan-4 work.
