# Species Friends & Welcome Cycle (v2 slice 4 of 4) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The arc's finale: bunny/fox/dino/alien return as late-game friends (levels 12/18/24/30), invitable through a "Your friends" switcher that keeps level, XP, room, coins, and streak; the level-up overlay leads with the friend; and onboarding becomes the spec's 3-beat welcome cycle with the first-day toast.

**Architecture:** Availability is pure derivation — `PPLevel.unlockedSpecies(pet)` computes the roster from `displayLevel`, `ENABLED_SPECIES`, and the current species; no new stored state. A boot-time `grantSpeciesUnlocks()` retroactively appends idempotent `species_unlocked` events for players already past the milestones. Switching mutates only `pet.species`/`pet.name` (everything else untouched by construction) and logs `pet_changed`. `unlocksFor` gains `newSpecies`; CTA precedence becomes species > area > shop > stay per spec §7 ("the level-up overlay leads with the friend"). The 4-beat onboarding collapses to the spec's 3 beats (hello → choose → name), landing on Home with a one-time toast.

**Tech Stack:** Plain HTML/CSS/JS, no build step. Node unit tests, Playwright e2e.

**Source spec:** `docs/superpowers/specs/2026-07-25-pet-leveling-v2-level-30.md` §4 (welcome cycle + acceptance criteria), §7 (species unlocks).

**Decisions this plan encodes:**
- **Species wins the L30 CTA** — spec §7's "leads with the friend" settles the deck-vs-alien collision recorded in plan 3's deferred items. The deck's area line still appears in the list, below the friend's.
- **Slice 1's "species is permanent" rule is formally superseded** by §7's switchable-friends design. The switcher is the only path (Settings → Your friends); onboarding still offers only cat/dog and never hints at the rest.
- Retroactive reveals for already-past players are quiet: the roster simply appears in "Your friends" and the events are logged. No catch-up ceremony (recorded as accepted polish debt in the handoff).
- The choose beat keeps tap-to-select + a separate confirm CTA (mis-tap safety), rendered as two large cards with the blurbs inline.
- **§4 vs §7 conflict resolved in §7's favor:** §4's acceptance criteria say rename/switch "reuses the [onboarding] screen"; §7 says switching lives in Settings → "Your friends" with rename offered inline. §7 is the more specific and later-written section; the shipped name-only rename modal stays, and the switcher is its own overlay. Onboarding is never re-entered after first run.

## Global Constraints

- **`SPECIES_UNLOCKS: { bunny: 12, fox: 18, dino: 24, alien: 30 }`** — spec §6/§7 verbatim; all in `config.js`.
- **Switching keeps level, XP, room, coins, streak** — only `pet.species` and `pet.name` may change; a test must prove `xp`, `levelHigh`, `coins`, `owned`, `days`, `solves` are untouched.
- **The departing friend is never sad.** Switch copy exactly: `{oldName} waves happily — {newName} is moving in! 🎉`. No goodbye guilt anywhere.
- **Locked species never shown or teased** — not in onboarding, not in the switcher, not in any overlay line before their crossing.
- **Rename offered on switch** (prefilled with the species default); declining keeps the current name.
- **Events:** `species_unlocked {species, level}` (once per species, idempotent), `pet_changed {from, to, name}`. Every meaningful action logs.
- **Onboarding §4 acceptance criteria verbatim:** only cat and dog selectable, no hint of other species; new pet starts `xp: 0` with `pet_chosen` logged; Home shows the Lv chip immediately; onboarding-to-first-puzzle under 60 seconds (3 beats, nothing blocking).
- **First-day toast** exactly: `Solve today's Easy puzzle to make {name}'s day 💛` — once, on landing Home after onboarding.
- **Overlay never stacks on an ad** (mechanics unchanged); XP/level rules unchanged; species-neutral, "they", no guilt; all tunables in config.
- Environment: `PP_CHROMIUM="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"` for e2e; check `lsof -ti:8080` after serving.
- **No red window** — every task leaves all five suites green. Task 4 rewrites onboarding markup + controller + every e2e onboarding block in ONE task for exactly this reason.

## File Structure

| File | Status | Responsibility |
|---|---|---|
| `www/js/config.js` | Modify | `SPECIES_UNLOCKS` |
| `www/js/level.js` | Modify | `unlockedSpecies(pet)` |
| `tests/level_test.js` | Modify | Roster derivation tests |
| `www/index.html` | Modify | Friends overlay; onboarding 3-beat rework |
| `www/css/style.css` | Modify | Friend cards, large choose-cards |
| `www/js/app.js` | Modify | Switcher wiring, overlay species variant, retro grants, onboarding controller, first-day toast |
| `tests/app_test.spec.js` | Modify | `onboard()` helper, species e2e, switch e2e, retro e2e |
| `CLAUDE.md` | Modify | One line: species switchable via friends |

---

### Task 1: Roster derivation

**Files:**
- Modify: `www/js/config.js`, `www/js/level.js`, `tests/level_test.js`

**Interfaces:**
- Produces: `PPConfig.SPECIES_UNLOCKS`; `PPLevel.unlockedSpecies(pet) -> string[]` — starters (`ENABLED_SPECIES`) ∪ species whose milestone ≤ `displayLevel(pet)` ∪ the current `pet.species` (a migrated fox owner keeps their fox listed), ordered as in `C.SPECIES`.

- [ ] **Step 1: Failing test** — append to `tests/level_test.js` before the final `if (failures)`:

```js
// --- unlockedSpecies: starters + milestones + current, C.SPECIES order ---
const su = C.SPECIES_UNLOCKS;
check(su.bunny === 12 && su.fox === 18 && su.dino === 24 && su.alien === 30, 'milestones per spec');
function petAt(level, species) {
  return { xp: PPLevel.thresholdFor(level), levelHigh: 1, species: species || 'cat' };
}
check(PPLevel.unlockedSpecies(petAt(1)).join(',') === 'dog,cat', 'starters only at L1');
check(PPLevel.unlockedSpecies(petAt(11)).join(',') === 'dog,cat', 'nothing early');
check(PPLevel.unlockedSpecies(petAt(12)).join(',') === 'dog,cat,bunny', 'bunny at 12');
check(PPLevel.unlockedSpecies(petAt(24)).join(',') === 'dog,cat,bunny,fox,dino', 'dino at 24, no alien');
check(PPLevel.unlockedSpecies(petAt(30)).join(',') === 'dog,cat,bunny,fox,dino,alien', 'all at 30');
check(PPLevel.unlockedSpecies(petAt(2, 'fox')).includes('fox'), 'current species always listed');
check(PPLevel.unlockedSpecies({ xp: 100, levelHigh: 12 }).includes('bunny'), 'ratcheted level counts');
```

- [ ] **Step 2:** `npm run test:level` → FAIL (`SPECIES_UNLOCKS` undefined).
- [ ] **Step 3: Implement** — in `config.js` after `ENABLED_SPECIES`: `SPECIES_UNLOCKS: { bunny: 12, fox: 18, dino: 24, alien: 30 },`. In `level.js` after `xpFor`:

```js
  // The invitable roster: starters, milestone species the (ratcheted) level
  // has reached, and whoever is currently the companion — a migrated save
  // keeps its fox even though onboarding no longer offers one. Ordered as
  // C.SPECIES so the switcher renders stably.
  function unlockedSpecies(pet) {
    const lv = displayLevel(pet);
    const su = C().SPECIES_UNLOCKS;
    return C().SPECIES.filter(sp =>
      C().ENABLED_SPECIES.includes(sp) ||
      (su[sp] !== undefined && lv >= su[sp]) ||
      sp === pet.species);
  }
```

Add `unlockedSpecies` to the exported object. Note the expected order: `C.SPECIES` is `['dog','cat','bunny','fox','dino','alien']`, hence `'dog,cat'` in the tests.

- [ ] **Step 4:** `npm run test:level` → PASS. Run the other four suites → green.
- [ ] **Step 5: Commit** — `feat(species): milestone roster derivation from level`

---

### Task 2: The friends switcher

**Files:**
- Modify: `www/index.html`, `www/css/style.css`, `www/js/app.js`

**Interfaces:**
- Consumes: `PPLevel.unlockedSpecies`, `C.DEFAULT_NAMES`, `C.SPECIES_BLURBS`, `PPSprites.svg`, `overlay()`, `log()`, `toast()`.
- Produces: `#overlay-friends`, `#friends-list`, `#friend-confirm`, `#friend-confirm-sprite`, `#friend-name-input`, `#friend-invite`, `#friend-cancel`, `#friends-close`; `openFriends()`; settings button `#settings-friends`. Task 3's "Meet them" CTA calls `openFriends()`.

- [ ] **Step 1: Markup** — in `www/index.html`, add to the settings overlay's `.opt-col`, above the rename button: `<button class="ghost-btn" id="settings-friends">Your friends</button>`. After the rename overlay, add:

```html
<!-- Friends switcher: unlocked species only; switching keeps level, xp,
     room, coins, streak. The departing friend is never sad. -->
<div class="overlay" id="overlay-friends">
  <div class="modal">
    <h3>Your friends</h3>
    <div class="friends-list" id="friends-list"></div>
    <div class="friend-confirm" id="friend-confirm" style="display:none">
      <div class="onboard-preview" id="friend-confirm-sprite"></div>
      <p class="subtle">What will you call them? (Keeping a name is lovely too.)</p>
      <input class="name-input" id="friend-name-input" maxlength="14">
      <button class="primary-btn" id="friend-invite">Invite them in</button>
      <button class="ghost-btn" id="friend-cancel">Not now</button>
    </div>
    <button class="ghost-btn" id="friends-close">Close</button>
  </div>
</div>
```

- [ ] **Step 2: Styles** — append to `www/css/style.css`:

```css
/* Friends switcher */
.friends-list { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin: 10px 0; }
.friend-card {
  background: var(--card); border: 2px solid var(--soft-line); border-radius: 14px;
  padding: 8px 4px 6px; font: inherit; color: var(--ink); cursor: pointer; text-align: center;
}
.friend-card.current { border-color: var(--good); background: #f2f8ee; cursor: default; }
.friend-card .nm { font-size: .72rem; font-weight: 700; text-transform: capitalize; display: block; }
.friend-card .st { font-size: .62rem; color: var(--good); font-weight: 700; }
```

- [ ] **Step 3: Wiring** — in `www/js/app.js`, after the rename handlers:

```js
  // ---------- friends switcher: the roster grows with the level ----------
  let inviteSpecies = null;
  function openFriends() {
    inviteSpecies = null;
    $('friend-confirm').style.display = 'none';
    const list = $('friends-list');
    list.innerHTML = '';
    PPLevel.unlockedSpecies(S.pet).forEach(sp => {
      const isCurrent = sp === S.pet.species;
      const card = document.createElement('button');
      card.className = 'friend-card' + (isCurrent ? ' current' : '');
      card.id = `friend-${sp}`;
      card.innerHTML = PPSprites.svg(sp, 'happy', 56) +
        `<span class="nm">${sp}</span>` +
        (isCurrent ? '<span class="st">with you now</span>' : '');
      if (!isCurrent) card.addEventListener('click', () => {
        inviteSpecies = sp;
        $('friend-confirm-sprite').innerHTML = PPSprites.svg(sp, 'happy', 84);
        $('friend-name-input').value = C.DEFAULT_NAMES[sp];
        $('friend-confirm').style.display = '';
      });
      list.appendChild(card);
    });
    overlay('overlay-friends', true);
  }
  $('settings-friends').addEventListener('click', () => {
    overlay('overlay-settings', false);
    openFriends();
  });
  $('friends-close').addEventListener('click', () => overlay('overlay-friends', false));
  $('friend-cancel').addEventListener('click', () => {
    inviteSpecies = null;
    $('friend-confirm').style.display = 'none';
  });
  $('friend-invite').addEventListener('click', () => {
    if (!inviteSpecies) return;
    const from = S.pet.species;
    const oldName = S.pet.name;
    // Only the companion changes. Level, xp, room, coins, streak — untouched.
    S.pet.species = inviteSpecies;
    S.pet.name = ($('friend-name-input').value.trim() || oldName).slice(0, 14);
    touch();
    log('pet_changed', { from, to: S.pet.species, name: S.pet.name });
    overlay('overlay-friends', false);
    toast(`${oldName} waves happily — ${S.pet.name} is moving in! 🎉`, 3500);
    renderHome();
    if ($('screen-pet').classList.contains('active')) renderPet(true);
  });
```

- [ ] **Step 4: Verify** — five suites green (nothing existing exercises the switcher yet). Manual: `PP._grantXp(3000)` (past L12) → Settings → Your friends → dog/cat/bunny cards, current marked; invite Clover → toast, home shows the bunny, chip/XP unchanged. **Kill the server; check 8080.**
- [ ] **Step 5: Commit** — `feat(species): friends switcher — invite unlocked companions`

---

### Task 3: Overlay leads with the friend + retro grants

**Files:**
- Modify: `www/js/app.js` (`unlocksFor`, `maybeLevelUpOverlay`, CTA handler, boot)

**Interfaces:**
- Consumes: `openFriends()` (Task 2), `PPLevel.unlockedSpecies`, `C.SPECIES_UNLOCKS`, `C.DEFAULT_NAMES`.
- Produces: `unlocksFor -> { lines, newArea, newSpecies }`; CTA dest `'friends'`; boot-time `grantSpeciesUnlocks()` appending idempotent `species_unlocked` events.

- [ ] **Step 1: `unlocksFor`** — species lines FIRST (the overlay leads with the friend, spec §7); replace the function:

```js
  // Everything a crossing unlocks. The friend leads (spec §7), then areas,
  // then items the player doesn't own. Locked content never appears early.
  function unlocksFor(from, to) {
    const lines = [];
    let newArea = null;
    let newSpecies = null;
    Object.keys(C.SPECIES_UNLOCKS).forEach(sp => {
      const lv = C.SPECIES_UNLOCKS[sp];
      if (lv > from && lv <= to) {
        lines.push(`🐾 ${C.DEFAULT_NAMES[sp]} the ${sp} would love to move in!`);
        newSpecies = sp;
      }
    });
    C.AREAS.filter(a => a.id !== 'main' && a.level > from && a.level <= to).forEach(a => {
      lines.push(`🏡 ${a.name}`);
      newArea = a.id;
    });
    C.PERMANENTS
      .filter(p => p.level > from && p.level <= to && !S.owned[p.id])
      .forEach(p => lines.push(`${p.emoji} ${p.name}`));
    return { lines, newArea, newSpecies };
  }
```

- [ ] **Step 2: CTA precedence** — in `maybeLevelUpOverlay`, replace the two CTA lines:

```js
    cta.textContent = u.newSpecies ? 'Meet them'
      : (u.newArea ? 'Visit the room' : (u.lines.length ? 'See the shop' : 'Continue'));
    cta.dataset.dest = u.newSpecies ? 'friends'
      : (u.newArea ? 'room' : (u.lines.length ? 'shop' : 'stay'));
```

In the CTA click handler, add the friends branch first, before the `'stay'` check's fall-through to the pet screen:

```js
    if (cta.dataset.dest === 'friends') { openFriends(); return; }
```

(Placed immediately after the `overlay('overlay-levelup', false);` line and the `dest === 'stay'` return.)

- [ ] **Step 3: Retro grants** — add after `claim`/boot helpers and call from the boot block right after the backfill-toast check:

```js
  // Species reveals are earned by level, and a migrated or ratcheted save
  // may already be past a milestone. Log each species_unlocked exactly once;
  // availability itself is derived, so this is the event-log record, not a
  // gate. Quiet by design — the roster appears in Your friends.
  function grantSpeciesUnlocks() {
    if (!S.pet.species) return;
    const have = new Set(S.events.filter(e => e.type === 'species_unlocked').map(e => e.species));
    const lv = PPLevel.displayLevel(S.pet);
    Object.keys(C.SPECIES_UNLOCKS).forEach(sp => {
      if (lv >= C.SPECIES_UNLOCKS[sp] && !have.has(sp)) {
        log('species_unlocked', { species: sp, level: C.SPECIES_UNLOCKS[sp] });
      }
    });
  }
```

Boot call: `grantSpeciesUnlocks();` after the `backfillToast` block. Also call it at the END of `awardXp`'s level-up branch (after `levelHigh` is set) so live crossings log at the moment they happen rather than next boot.

- [ ] **Step 4: Verify** — five suites green (existing overlay tests cross L2/L5/L6 — no species milestones — unaffected). Manual: `_grantXp(2720)` (one easy-solve below L12's 2730), solve easy → overlay leads with `🐾 Clover the bunny would love to move in!`, CTA "Meet them" → switcher opens with the bunny card. Kill server; check 8080.
- [ ] **Step 5: Commit** — `feat(species): overlay leads with the friend; retroactive unlock events`

---

### Task 4: The 3-beat welcome cycle

**Files:**
- Modify: `www/index.html` (onboarding section), `www/css/style.css`, `www/js/app.js` (onboarding controller, boot), `tests/app_test.spec.js` (every onboarding block → one helper)

**Interfaces:**
- Consumes: `C.ENABLED_SPECIES`, `C.DEFAULT_NAMES`, `C.SPECIES_BLURBS`, `PPSprites`.
- Produces DOM ids: `#onb-hello` + `#onb-hello-go`, `#onb-choose` + `#species-grid` + `#species-<sp>` + `#onb-choose-go`, `#onb-name` + `#onb-name-sprite` + `#pet-name-input` + `#onb-name-go`. The arrive beat and all `#onb-arrive*`/`#onb-welcome*`/`#onb-preview`/`#onb-blurb` ids are GONE. e2e exports `onboard(page, species?, name?)`.

- [ ] **Step 1: Markup** — replace the whole `#screen-onboard` section:

```html
  <!-- Welcome cycle: hello → choose → name. Lands on Home with the
       first-day toast. Under 60 seconds to the first puzzle. -->
  <section class="screen" id="screen-onboard">
    <div class="onboard-step active" id="onb-hello">
      <div class="card onboard-card">
        <div class="onboard-big">🏡</div>
        <h2>A little friend wants to move in.</h2>
        <p class="subtle">Solve puzzles, and they'll thrive.</p>
        <button class="primary-btn" id="onb-hello-go">Say hello</button>
      </div>
    </div>
    <div class="onboard-step" id="onb-choose">
      <div class="card onboard-card">
        <h2>Who's moving in?</h2>
        <div class="species-grid choose-two" id="species-grid"></div>
        <button class="primary-btn" id="onb-choose-go" disabled>Choose them</button>
      </div>
    </div>
    <div class="onboard-step" id="onb-name">
      <div class="card onboard-card">
        <div class="onboard-preview" id="onb-name-sprite"></div>
        <h2>What will you call them?</h2>
        <p class="subtle">You can change this any time.</p>
        <input class="name-input" id="pet-name-input" maxlength="14" placeholder="Name your pal">
        <button class="primary-btn" id="onb-name-go">That's the one</button>
      </div>
    </div>
  </section>
```

- [ ] **Step 2: Large cards CSS** — append:

```css
.species-grid.choose-two { grid-template-columns: repeat(2, 1fr); }
.species-grid.choose-two .species-btn { padding: 14px 8px 10px; }
.species-grid.choose-two .blurb {
  display: block; font-size: .7rem; color: var(--ink-soft); font-weight: 600;
  margin-top: 4px; min-height: 2.4em;
}
```

- [ ] **Step 3: Controller** — replace the onboarding block in `app.js` (from the `let selSpecies` comment through the `onb-arrive-go` handler):

```js
  // ---------- welcome cycle: hello → choose → name ----------
  // Two large cards with blurbs inline; tap selects, the CTA commits —
  // a mis-tap never decides. Lands on Home with the first-day toast.
  let selSpecies = null;

  function onbStep(id) {
    document.querySelectorAll('.onboard-step').forEach(s => s.classList.remove('active'));
    $(id).classList.add('active');
  }

  function renderOnboard() {
    selSpecies = null;
    const grid = $('species-grid');
    grid.innerHTML = '';
    (C.ENABLED_SPECIES || C.SPECIES).forEach(sp => {
      const b = document.createElement('button');
      b.className = 'species-btn';
      b.id = `species-${sp}`;
      b.innerHTML = PPSprites.svg(sp, 'happy', 72) +
        `<span class="nm">${sp}</span>` +
        `<span class="blurb">${C.SPECIES_BLURBS[sp]}</span>`;
      b.addEventListener('click', () => {
        selSpecies = sp;
        grid.querySelectorAll('.species-btn').forEach(x => x.classList.remove('sel'));
        b.classList.add('sel');
        $('onb-choose-go').disabled = false;
      });
      grid.appendChild(b);
    });
    $('onb-choose-go').disabled = true;
    $('pet-name-input').value = '';
    onbStep('onb-hello');
  }

  $('onb-hello-go').addEventListener('click', () => onbStep('onb-choose'));

  $('onb-choose-go').addEventListener('click', () => {
    if (!selSpecies) return;
    $('onb-name-sprite').innerHTML = PPSprites.svg(selSpecies, 'happy', 84);
    $('pet-name-input').value = C.DEFAULT_NAMES[selSpecies];
    onbStep('onb-name');
  });

  $('onb-name-go').addEventListener('click', () => {
    if (!selSpecies) return;
    S.pet.species = selSpecies;
    S.pet.name = ($('pet-name-input').value.trim() || C.DEFAULT_NAMES[selSpecies]).slice(0, 14);
    touch();
    log('pet_chosen', { species: S.pet.species, name: S.pet.name });
    grantSpeciesUnlocks();
    renderHome();
    show('screen-home');
    toast(`Solve today's Easy puzzle to make ${S.pet.name}'s day 💛`, 4000);
  });
```

- [ ] **Step 4: e2e helper + sweep** — at the top of `tests/app_test.spec.js` (next to `continueWin`):

```js
async function onboard(page, species = 'dog', name) {
  await page.goto('/');
  await page.click('#onb-hello-go');
  await page.click(`#species-${species}`);
  await page.click('#onb-choose-go');
  if (name) await page.fill('#pet-name-input', name);
  await page.click('#onb-name-go');
  await expect(page.locator('#screen-home')).toHaveClass(/active/);
}
```

Replace EVERY inline onboarding block (all currently click `#onb-welcome-go` … `#onb-arrive-go`) with `await onboard(page, '<species>', '<name-if-set>')` — preserve each test's species and name choices. The core-loop test keeps its extra assertions (2 species shown, disabled-until-tap, browse cat→dog, `Biscuit` prefill — express them inline in that one test around the helper's steps, or keep that test's block inline; the other tests use the helper). Add to the core-loop test, right after landing on Home: `await expect(page.locator('#toast')).toHaveClass(/show/);` and `toContainText("make Pip's day")`.

- [ ] **Step 5: Full regression** — all five suites; e2e count unchanged (same tests, new flow). Kill server; check 8080.
- [ ] **Step 6: Commit** — `feat(onboarding): 3-beat welcome cycle with the first-day toast`

---

### Task 5: Species e2e + docs

**Files:**
- Modify: `tests/app_test.spec.js`, `CLAUDE.md`

**Interfaces:** consumes everything above.

- [ ] **Step 1: The species arc test:**

```js
test('a friend unlocks at 12, moves in, and nothing else changes', async ({ page }) => {
  await onboard(page, 'cat', 'Mochi');

  // One easy-solve below L12: the crossing leads with the friend.
  const l12 = await page.evaluate(() => window.PPConfig.LEVEL_XP[10]);
  const perEasy = await page.evaluate(() => window.PPConfig.XP_PAYOUTS[0]);
  await page.evaluate(xp => window.PP._grantXp(xp), l12 - perEasy);
  await page.click('#slot-0');
  await autosolve(page);
  await continueWin(page);
  await expect(page.locator('#overlay-levelup')).toHaveClass(/show/);
  await expect(page.locator('#levelup-list .unlock-row').first())
    .toContainText('Clover the bunny would love to move in!');
  await expect(page.locator('#levelup-cta')).toHaveText('Meet them');
  await page.click('#levelup-cta');
  await expect(page.locator('#overlay-friends')).toHaveClass(/show/);
  await expect(page.locator('#friend-bunny')).toBeVisible();
  await expect(page.locator('#friend-alien')).toHaveCount(0);   // locked: absent, not teased

  // Invite Clover; everything but the companion is untouched.
  const before = await page.evaluate(() => {
    const s = window.PP.state();
    return { xp: s.pet.xp, coins: s.coins, owned: Object.keys(s.owned).length, solves: s.solves };
  });
  await page.click('#friend-bunny');
  await expect(page.locator('#friend-name-input')).toHaveValue('Clover');
  await page.click('#friend-invite');
  await expect(page.locator('#toast')).toContainText('Mochi waves happily — Clover is moving in!');
  const after = await page.evaluate(() => {
    const s = window.PP.state();
    return { xp: s.pet.xp, coins: s.coins, owned: Object.keys(s.owned).length,
             solves: s.solves, species: s.pet.species, name: s.pet.name,
             events: s.events.map(e => e.type) };
  });
  expect(after.xp).toBe(before.xp);
  expect(after.coins).toBe(before.coins);
  expect(after.owned).toBe(before.owned);
  expect(after.solves).toBe(before.solves);
  expect(after.species).toBe('bunny');
  expect(after.name).toBe('Clover');
  expect(after.events).toContain('species_unlocked');
  expect(after.events).toContain('pet_changed');
  await expect(page.locator('#home-pet-name')).toHaveText('Clover');
});
```

- [ ] **Step 2: The retro test:**

```js
test('a save already past milestones gets quiet retroactive unlocks', async ({ page }) => {
  await onboard(page, 'dog');
  await page.evaluate(() => window.PP._grantXp(window.PPConfig.LEVEL_XP[22]));  // L24
  await page.reload();
  const s = await page.evaluate(() => window.PP.state());
  const granted = s.events.filter(e => e.type === 'species_unlocked').map(e => e.species).sort();
  expect(granted).toEqual(['bunny', 'dino', 'fox']);   // not alien (L30)
  // Idempotent: a second reload adds nothing.
  await page.reload();
  const again = await page.evaluate(() =>
    window.PP.state().events.filter(e => e.type === 'species_unlocked').length);
  expect(again).toBe(3);
  // The roster shows them; the alien stays absent.
  await page.evaluate(() => window.PP._renderHome());
  await page.click('#btn-settings');
  await page.click('#settings-friends');
  await expect(page.locator('.friend-card')).toHaveCount(5);
  await expect(page.locator('#friend-alien')).toHaveCount(0);
});
```

- [ ] **Step 3: Full suite** — five suites green; e2e should now be 13 (11 prior + these two). Account for every test by name if the count differs.
- [ ] **Step 4: Doc line** — in `CLAUDE.md`, wherever the pet/species behavior is described (or the layout list), add: `Species become switchable friends at levels 12/18/24/30 (SPECIES_UNLOCKS); switching keeps everything but the companion.`
- [ ] **Step 5: Commit** — `test(species): friend unlock, invitation, and retroactive grants`

---

## Known deferred items (as shipped)

Triaged in the final whole-branch review; recorded here because the SDD scratch workspace is deleted after merge.

- **L30 skips the deck's arrival moment** (plan-mandated: species wins the CTA at the only species/area collision). The deck panel exists on the next room visit but its sparkle never fires. Endgame-postcard polish for the backlog.
- **Event-cap re-log:** a `species_unlocked` event that ages past the 5000-entry trim gets re-logged at next boot with a fresh timestamp. Log-fidelity noise only; nothing gates on it.
- **`daysKnown` counts household age, not the current friend's tenure** — reviewed and ruled correct: the home is the identity (spec framing); streak/owned speech lines already attribute household history the same way. Revisit only if playtesters flinch at a day-1 friend saying "we've been at this a while."
- **A previously-met species crossing its milestone while not current** still gets a "would love to move in!" line — behaves as a warm re-invite; noted in case the copy ever reads oddly.
- `ENABLED_SPECIES` (really "starter roster") vs `unlockedSpecies` naming reads oddly; rename candidate for the tuning pass.
- One historical "plan 2" comment remains in `catalog_test.js`'s geometry section (accurate as history; left).

## Handoff (post-v2 backlog)

- The deck "any species stargazing" postcard; a gentle catch-up reveal for retro unlocks (currently quiet by decision); the L6–L9 "See the shop" scroll polish; Takuzu and everything in CLAUDE.md's out-of-scope list.
- Tuning pass (go-live bucket 1) now has the full arc to tune against: XP curve, catalog prices, speech tiers, SHOP_TEASE_RANGE, and the species milestones themselves.
