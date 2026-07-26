# Puzzle Pet — Pet Leveling, Shop & Welcome Cycle Spec (v2 — Level 30)

**Status:** Draft v2 for review · 2026-07-25 · supersedes v1 (level-10 cap)
**Decisions locked:** Puzzle XP only · level cap **30** · species return as milestone unlocks (12/18/24/30) · room areas at 5/10/20/30 · ~5-month full-set pacing · cat/dog at start · one look per species (no growth stages)

---

## 0. Implementation context (added at planning time)

This spec **supersedes** `2026-07-25-pet-growth-and-onboarding-design.md` (the "bond" design). That earlier slice shipped and merged as PR #2 (`ef66e9f`) and is the foundation this evolves from rather than replaces wholesale. Reusable as-is: `speech.js`, the onboarding scaffolding, the event-log backfill machinery, and the four test suites.

**What changes from the shipped bond system:**

| | Shipped (bond, PR #2) | This spec |
|---|---|---|
| XP sources | 4 — solving, feeding, petting, daily visit | 1 — puzzle solves only |
| XP values | 4/6/10, bonus 6, free 1 | 10/20/35, bonus 15, free 3 |
| Curve | 8 named tiers (0→1400) + endless tail | 30 fixed levels (60→12535), hard cap |
| State | top-level `bond: {xp, level, visitDay, pets, petsDay}` | `pet.xp`, level derived |
| Onboarding | 4 beats, all 6 species | 3 beats, cat + dog only |
| Species | permanent | switchable, unlocked at 12/18/24/30 |
| Room | one room + wallpaper/flooring | 5 areas |
| Catalog | 5 permanents | 37 permanents |

Two of these reverse choices made during the bond brainstorm (one room over unlockable areas; species permanent over switchable). Both reversals are deliberate and stated in this document.

**Decomposition — four plans**, each independently shippable and testable:

1. **Leveling core** — XP sources, the 30-level curve, storage migration, home chip + XP bar, win-screen XP line. *(this is the plan written first)*
2. **Level-up overlay + shop** — the level-up moment, shop gating, the 37-item catalog.
3. **Room areas** — five regions, per-area spots, the scrolling scene.
4. **Species unlock + friends switcher.**

**One carried-forward safeguard.** The bond slice added `Math.max(from, to)` when storing the level, specifically so a downward threshold edit during tuning cannot demote an existing player. §5 here says "store lifetime `pet.xp` only; derive level", which reintroduces that exposure across a 30-entry curve you will be tuning. Plan 1 keeps a stored high-water mark alongside the derived level for exactly this reason — see that plan's Global Constraints.

---

## 1. Problem statement

The game loop currently ends at "coins buy items." Pet leveling gives every solve a second, longer-term payoff (XP → levels → new things to want) and turns the shop into a ~5-month progression. v2 extends the arc to level 30 and brings the four hidden species back as late-game friends — the biggest carrots in the game, at zero new art cost.

## 2. Goals

- Every solve visibly advances the pet (XP bar moves on the win screen, always).
- Full-set daily player: L10 ≈ **day 25**, L20 ≈ **day 78**, L30 ≈ **day 157** (verified against the curve below).
- Every level 2–30 unlocks at least one thing — no empty levels.
- Shop always holds a near-term want (next tier visible) and an affordable win (~2–3 days early game).
- Onboarding to first puzzle in under 60 seconds.
- Existing saves migrate losslessly — XP retroactively granted from the event log.

## 3. Non-goals (v1 of this feature)

- No pet appearance change with level; growth shows via badge, bar, room, and new friends.
- No multi-pet household — one companion at a time; unlocked species are *switchable*, not additive.
- No prestige/post-cap XP system; after L30, coins remain the long-tail (full room ≈ day 190).
- No placement editor; items auto-place at fixed spots per area.
- No new XP sources; the daily set stays the engine (80 XP/day ceiling).

---

## 4. Welcome cycle

Three beats on the onboarding screen (one screen, staged sections):

1. **Hello** — "A little friend wants to move in. Solve puzzles, and they'll thrive."
2. **Choose** — two large cards, **cat** and **dog** (`ENABLED_SPECIES: ['cat','dog']`; full `SPECIES` list stays for sprites/data). Locked species are *not* shown or teased at onboarding — discovering them at L12 is a surprise.
3. **Name** — prefilled default (Mochi / Biscuit), 14-char cap. CTA lands on Home with one-time toast: "Solve today's Easy puzzle to make {name}'s day 💛".

**Acceptance criteria**

- [ ] Only cat and dog selectable at onboarding; no hint of other species.
- [ ] New pet starts `xp: 0` (level 1 derived); `pet_chosen` logged.
- [ ] Rename/switch via Settings reuses the screen, skips the hello beat, never resets XP.
- [ ] Home shows "Lv 1" chip immediately after onboarding.

## 5. Leveling system

### XP sources

| Source | XP | Notes |
|---|---|---|
| Daily easy / medium / hard | 10 / 20 / 35 | calendar back-fill pays identically |
| Full-set bonus | 15 | granted with coin set bonus |
| Free play | 3 | intentionally weak; daily set stays best rate |

Full set = **80 XP/day**. XP granted only when a slot first flips to done (same guard as coins).

### Curve — `LEVEL_XP` (cumulative, to reach L2…L30)

```
  60   150   270   430   630   880  1180  1540  1960     ← L2–L10
2340  2730  3130  3540  3960  4390  4830  5280  5740  6210   ← L11–L20
6730  7275  7845  8440  9060  9705 10375 11070 11790 12535   ← L21–L30
```

Level = highest threshold ≤ lifetime XP, +1. **Store lifetime `pet.xp` only; derive level** — single source of truth.

**Pacing (verified):** days/level ≈ 1–5 through L10, ~5.3 mid (11–20), ~7.9 late (21–30). Full-set: L10 d25 · L20 d78 · L30 d157. Easy+medium-only player reaches L10 ~d66 and keeps progressing — slow is fine; opener-only protects streak and mood, not speed. Tuning softener if beta says mid-game drags: "+5 XP first solve of the day."

## 6. Level unlock table (1–30)

Milestone key: 🏡 room area · 🐾 species · rest are shop tiers.

| Lv | Unlocks | Area |
|---|---|---|
| 1 | Bouncy ball 80 · Little plant 120 (+ all consumables, never gated) | main |
| 2 | Cozy lamp 160 · Warm rug 220 | main |
| 3 | Food bowl 180 · Star poster 260 | main |
| 4 | Bookshelf 320 | main |
| 5 | 🏡 **Window nook** · Window cushion 300 · String lights 260 | nook |
| 6 | Toy chest 380 | nook |
| 7 | Picture frame 340 | nook |
| 8 | Pet tent 450 | main |
| 9 | Aquarium 520 | nook |
| 10 | 🏡 **Garden** · Flower bed 400 · Fountain 600 | garden |
| 11 | Garden gnome 380 | garden |
| 12 | 🐾 **Bunny** · Clover patch 420 | garden |
| 13 | Tree swing 480 | garden |
| 14 | Wind chimes 440 | nook |
| 15 | Birdhouse 500 | garden |
| 16 | Veggie patch 550 | garden |
| 17 | Hammock 600 | garden |
| 18 | 🐾 **Fox** · Mushroom ring 520 | garden |
| 19 | Lantern string 580 | garden |
| 20 | 🏡 **Pond** · Lily pads 500 · Koi friends 700 | pond |
| 21 | Stepping stones 620 | pond |
| 22 | Cattails 560 | pond |
| 23 | Little dock 750 | pond |
| 24 | 🐾 **Dino** · Fossil rock 650 | pond |
| 25 | Firefly jar 700 | garden |
| 26 | Duck friend 800 | pond |
| 27 | Rowboat 900 | pond |
| 28 | Fire pit 850 | garden |
| 29 | Constellation rug 900 | main |
| 30 | 🏡 **Stargazing deck** · Telescope 1000 · Shooting-star mobile 1200 · 🐾 **Alien** | deck |

**Catalog: 37 permanents, 19,190 coins total.** At ~100 coins/day full-set income (~15,000 by day 157), the complete room lands ≈ day 190 — coins stay meaningful past the level cap by design. Every tier keeps something affordable within ~2–6 days of income; energy snacks compete for the same coins, which is the intended tension.

Config shape: every `PERMANENTS` entry gains `level` and `area` (`main | nook | garden | pond | deck`); `AREAS: [{id:'main',level:1},{id:'nook',level:5,name:'Window nook'},{id:'garden',level:10,name:'Garden'},{id:'pond',level:20,name:'Pond'},{id:'deck',level:30,name:'Stargazing deck'}]`; `SPECIES_UNLOCKS: {bunny:12, fox:18, dino:24, alien:30}`.

## 7. Species unlocks (12 / 18 / 24 / 30)

Framing: **a new friend can move in** — never a "skin."

- At the unlock level, the level-up overlay leads with the friend: sprite bounce, "Clover the bunny would love to move in! You can invite them anytime." No pressure to switch.
- Switching lives in Settings → "Your friends": shows unlocked species; switching keeps **level, XP, room, coins, streak** — the home is the identity, the companion is welcome to change. Rename offered on switch (prefilled with species default); declining keeps the current name.
- The departing friend is never sad: "Mochi waves happily — Clover is moving in! 🎉" (species-neutral rule: copy must work for dino and alien too).
- Events: `species_unlocked {species, level}`, `pet_changed {from, to, name}`.
- Onboarding never shows locked species (§4); the L12 reveal is the first hint the roster is bigger.

## 8. Room areas

- `main` (L1) — existing scene + spots for bowl, shelf, tent, constellation rug.
- `nook` (L5) — window ledge strip, distinct wall tint.
- `garden` (L10) — grass strip.
- `pond` (L20) — water patch adjoining the garden, blue tint, koi/duck/boat spots.
- `deck` (L30) — night-sky raised platform, the "endgame postcard" — telescope + mobile + any species stargazing.

Scene is one widened, gently scrolling composition (horizontal scroll if needed past pond). Locked areas simply don't render — no locked doors, no silhouettes (pause-don't-tease). Each unlock: sparkle transition + named in the level-up overlay. Per-area `DECO_SPOTS` maps.

## 9. Level-up moment

- Win overlay gains XP line + animated mini bar (`+20 ✦`).
- Threshold crossed → after win overlay's Continue **and after any interstitial** (never stacked on an ad): `overlay-levelup` — sprite bounce, "{name} grew to Level {n}!", unlock list, one CTA ("See the shop" / "Visit the room" on area levels / "Meet them" on species levels).
- Multiple thresholds in one session (back-fill sprees): one overlay, highest level, merged list.

## 10. Data model & migration

- `storage.js` defaults: `pet: { …, xp: 0 }`. Explicit `if (state.pet.xp == null)` hook in `load()` (nested `pet` is replaced wholesale by saved objects, so `Object.assign(defaults(),…)` alone won't add it).
- **Retroactive backfill:** replay `events` — each `puzzle_solved` by kind/slot → 10/20/35/3 XP; +15 per day with `bonus: true`. Existing testers wake to "{name} grew to Level {n} while thinking about all the puzzles you've solved together! 💛". Log `xp_backfill {xp, level}`.
- Events: `puzzle_solved` gains `xp`; new `level_up`, `xp_backfill`, `species_unlocked`, `pet_changed`.

## 11. UI changes by surface

| Surface | Change |
|---|---|
| Onboarding | Hello beat; 2-species grid; rename/switch mode skips hello |
| Home pet card | `Lv {n}` chip + thin XP bar under mood line |
| Win overlay | XP line + animated mini bar |
| New overlays | Level-up (§9); species reveal is the level-up overlay's species variant |
| Pet room | Area-aware scene w/ per-area spots; title "…the cat · Lv 14" |
| Shop | Current-tier normal; next tier "Unlocks at Lv {n} ✨" (soft, not tappable-to-error); deeper tiers collapsed to "More to discover as {name} grows…"; group rows by area once ≥2 areas unlocked |
| Settings | New "Your friends" switcher (unlocked species only) |
| Calendar | Unchanged; back-fill flows through `onPuzzleWin` |

## 12. File-by-file plan

1. **`config.js`** — `ENABLED_SPECIES`, `SPECIES_UNLOCKS`, `XP_PAYOUTS [10,20,35]`, `XP_SET_BONUS 15`, `XP_FREEPLAY 3`, `LEVEL_XP` (29 thresholds, §5), `AREAS`, 37-item `PERMANENTS` with `level`/`area`.
2. **`storage.js`** — `pet.xp` default + migration hook calling `backfillXp(state)`.
3. **`app.js`** — `levelOf()` helpers; XP grant in `onPuzzleWin` (inside the not-already-done guard); level-cross → queued level-up overlay after interstitial; species unlock detection; shop gating + area grouping; area-aware `renderPet`; friends switcher; onboarding staging; home chip/bar.
4. **`index.html` / CSS** — hello beat, XP bars, level-up overlay, four new scene regions, locked-item + collapsed-row styling, friends switcher.
5. **Tests** — Playwright: onboarding shows exactly 2 species; solve grants XP; forced level-up shows overlay; species switch keeps xp/room; migration seeds old-shape save + events, asserts backfilled level. Node: `LEVEL_XP` strictly increasing, 29 entries; every level 2–30 has ≥1 unlock (guards catalog edits); every `PERMANENTS.area` exists in `AREAS` with `level` ≥ area level.

## 13. Emotional-rule compliance (self-check)

- XP never decays; lapsed players return at the same level. ✅
- Locked items = anticipation ("Unlocks at Lv n ✨"); far tiers and locked areas hidden entirely, no teasing. ✅
- Back-fill grants XP → returners catch up on progression, not just coins. ✅
- Level-up overlay never interrupts play, never stacks on an ad. ✅
- Species switch is joyful both directions; no pet is ever "left behind" sad. ✅
- All copy species-neutral (works for dino and alien). ✅

## 14. Open questions (non-blocking)

- "+5 XP first solve of the day" softener — add now or after beta pacing data? *(product — Matt)*
- Pond/deck art treatment within the emoji-deco style — single scrolling scene assumed; confirm during build. *(implementation)*
- Post-cap: should L30 players get a tiny cosmetic "✦ 30" flourish on the home chip? Cheap, parked. *(product)*
