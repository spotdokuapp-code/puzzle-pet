# Pet Growth & Onboarding — Design

**Date:** 2026-07-25
**Status:** Approved for planning

## Summary

Two connected features. First, a guided first-run **arrival** that replaces today's single-screen species-and-name form. Second, a **bond system**: a care level that rises from playing and caring, and unlocks a room that fills and deepens over months.

The pet itself never changes form. Growth is expressed through the world around it — more decor, a bigger room, wallpaper and flooring, a window onto the seasons, and a speech pool that deepens as the bond does.

## Goals

- Give a returning player a visible, months-long reason to come back beyond the streak.
- Make the first run sell a relationship before it asks for anything.
- Extend the existing furniture shop rather than replacing it.
- Keep every new number in `config.js`.

## Non-goals

- The pet's body does not change. No life stages, no evolution.
- No new areas, rooms, or visiting creatures. One room, the whole game.
- **No drag-and-drop placement.** Decor is auto-placed at defined spots. Letting players arrange the room is a separate feature with its own design.
- No second currency. Coins stay the only currency.

## Non-negotiable constraints

Inherited from `CLAUDE.md`, restated because this feature is where they are easiest to violate:

- **Bond XP never decreases.** No decay, no lost levels, no "your bond weakened" copy, at any tier.
- **Bond gates cosmetics only.** It never gates a puzzle, the streak, coins, or energy. A player at level 1 forever can play everything.
- **The easy opener alone still preserves the day** and still moves the bond.
- **No sad speech lines** at any tier. Moods stay happy / content / missing-you.
- Every meaningful action appends to `state.events`.

---

## Architecture

Three new files, following the one-concern-per-file layout convention:

| File | Owns | Notes |
|---|---|---|
| `www/js/bond.js` | XP, level lookup, unlock table, event-log backfill | Pure functions over `(state, config)`. No DOM. Loads in Node for unit tests, like `generator.js`. |
| `www/js/speech.js` | The speech pool and `pick(state, context)` | Pure data + selection. No DOM. |
| `www/js/room.js` | Scene rendering: backdrop, decor placement, scene tier | Takes over the scene half of `renderPet`. |

`app.js` keeps screens, the daily loop, calendar, and energy, and calls into the three modules. It remains the app shell; if further extraction is wanted, it should be scoped explicitly in a future slice rather than carried forward as an unowned aspiration.

All tunables land in `config.js` as new blocks: `BOND_XP`, `BOND_LEVELS`, `BOND_ENDLESS`, `BACKDROPS`, `SCENE_TIERS`.

### State shape

`storage.js` bumps `puzzlepet.v1` → `puzzlepet.v2`, adding:

```js
bond: { xp: 0, level: 1, visitDay: null, pets: 0, petsDay: null }
room: { wallpaper: 'plain', flooring: 'plain' }
```

`visitDay` and `petsDay` are `YYYY-MM-DD` strings, not timestamps. Storing the day means the once-per-day and per-day-cap rules need no timers and cannot drift.

### Migration and backfill

On first v2 load, replay `state.events`:

- `puzzle_solved` → solve XP by `kind` and `slot`
- `feed` → XP by item id

Visit and petting XP start from today; those events never existed historically. The result is written once and the state stamped `version: 2`, so it never re-runs. `pet.species`, `pet.name`, `coins`, `owned`, `days`, and `solves` are untouched — an existing save keeps its room and streak and gains a bond level matching its history.

Backfill can only ever *under*-credit (the event log is capped at 5000 entries and older entries are dropped). That is the correct direction to fail.

---

## Bond mechanics

### XP sources (`BOND_XP`)

| Source | XP | Notes |
|---|---|---|
| Daily solve — easy / medium / hard | 4 / 6 / 10 | mirrors coin escalation |
| Full daily set bonus | +6 | |
| Free play solve | 1 | worst rate, as with coins |
| Daily visit | 3 | once per day, gated on `bond.visitDay` |
| Petting | 1 | capped at 5/day via `bond.pets` + `bond.petsDay` |
| Feed — berry / apple / cake | 2 / 4 / 8 | roughly tracks price |

Two reference players: a **full-set player** at ~34 XP/day, and a **streak-minimum player** (easy opener, visit, petting) at ~12 XP/day. Solving dominates; the free sources mean nobody ever stalls at zero.

### The curve (`BOND_LEVELS`, `BOND_ENDLESS`)

Eight named tiers, cumulative XP: **0, 20, 70, 160, 320, 560, 900, 1400.**

- Full-set player: level 2 on day one, level 8 around day 41.
- Streak-minimum player: level 2 on day two, level 8 around day 117.

Past tier 8, each further level costs 15% more than the previous step, grants a coin gift, and shows its number on the pet card. No dead end, and no promise of infinite content.

### Unlock table

| Level | Name | Unlocks |
|---|---|---|
| 1 | New friends | Small room, 2 decor spots, plain backdrop, base speech |
| 2 | Getting comfy | +1 decor spot, first new shop item, speech tier 2 |
| 3 | Settling in | First wallpaper pair (choice of 2), speech tier 3 |
| 4 | Room to grow | Scene tier 2 — taller room, +2 spots — and 2 new shop items |
| 5 | Little routines | Flooring options, speech tier 4 |
| 6 | Long afternoons | The window — seasonal and time-of-day view begins |
| 7 | Home ground | Scene tier 3, +2 spots, late-tier shop items |
| 8 | Old friends | Final backdrop set, speech tier 5 (lines referencing how long you've known each other) |

Tier names are display copy in `BOND_LEVELS` and expected to change during the tuning pass. Nothing in the code keys off them; tiers are referenced by number.

"Speech tier N" is shorthand only — there is no tier field on a line. Each speech line carries a `minLevel`, and the tiers above are simply the levels at which new lines become eligible (2, 3, 5, 8).

The five existing permanents become early-tier items. Later tiers need roughly six more, in the same emoji style — config data, not art.

### Tuning status

**These numbers are starting points, not settled design.** They belong to the go-live checklist's bucket-1 tuning pass and should be revised against real dogfooding. The number to watch is the streak-minimum player's ~117 days to tier 8; if that feels too slow, **the lever is raising the free sources, not lowering the solve rewards** — the solve rewards are what keep the puzzles central.

---

## Onboarding arrival

Four beats, each a step within the existing `#screen-onboard` section (a `step` state, not four new sections).

1. **Welcome** — app title, one line ("Someone's been waiting to meet you."), a single Continue button. No form, nothing to decide.
2. **Meet the six** — the species grid, but tapping *previews*: the sprite enlarges above the grid with a one-line temperament blurb, and a separate button confirms. The player can browse all six without a mis-tap locking them in, which matters because the choice is permanent.
3. **Name** — the enlarged sprite stays, name field below, prefilled from `DEFAULT_NAMES` so a player who doesn't care can continue immediately. 14-char cap, as today.
4. **Arrival** — the pet appears in its room (near-empty: 2 decor spots, plain backdrop), bounces, and speaks its first line using its own name. Button reads "Let's solve something," handing off to home.

**The empty room is load-bearing.** Step 4 showing a bare room is what makes tier 4's taller room and tier 8's backdrops land months later. It should read as sparse and calm, not unfinished.

### Copy rules

- Species-neutral as `CLAUDE.md` means it: the dino and alien read as equals; no "pets vs. creatures" framing.
- Every pet referred to as **they**. The player names a creature they invented; we never assume a gender for it.

### Permanence

- **Species is written once** at step 2 and never again.
- **Name is freely changeable.** Settings → Rename becomes a small name-only modal. Today it reopens the onboarding screen and silently permits a species swap; closing that is part of this work.
- Settings → Reset is unchanged. It is the escape hatch, and it is honest because it visibly wipes everything rather than quietly rerolling the pet.

---

## Room deepening

### Backdrops

`BACKDROPS` holds a `wallpaper` and a `flooring` list; each entry has an id, display name, `minLevel`, and CSS values. Applying one sets a class and custom properties on `#scene` — pure CSS, no images, no new art.

Unlocked backdrops are **free to switch between as often as the player likes**. The unlock is the reward; the wearing of it is not rationed. Choice persists in `room.wallpaper` / `room.flooring`.

### Scene tiers and decor spots

Today's `DECO_SPOTS` map (item id → fixed position) does not survive adding items. It is replaced by an ordered position list per tier: `SCENE_TIERS[n].spots`.

Owned items fill positions in a **stable unlock order**, so layout is deterministic: the same owned set always renders identically, and buying something never rearranges what is already placed. Tiers 2 and 3 raise the scene height and **append** positions rather than reshuffling — growth must read as *more*, never as *different*.

**Spot count is a floor, not a cap.** The room always has at least as many positions as the player owns items: `spots = max(SCENE_TIERS[level].spots.length, ownedCount)`, with overflow positions appended from the next tier's list.

This is not a hypothetical. A v1 save can own all five current permanents and backfill to level 3, whose tier grants only three positions — without this rule, two already-purchased items would vanish from the room on upgrade. Which yields the governing rule:

**An owned item is never hidden, removed, or un-placed for any reason, including a bond level lower than its `minLevel`.** `minLevel` gates *purchase*, never *possession*. The same applies to backdrops: a wallpaper already selected stays selected even if its `minLevel` exceeds the player's level.

### Shop presentation

`PERMANENTS` entries gain `minLevel`. Locked items stay **visible**, greyed, labelled with the level that opens them. Seeing what's coming is most of the pull, and since nothing here costs money, showing it cannot function as a paywall.

### The window (level 6)

One scene element whose view is computed from the device clock — season from the month, time of day from the hour. Twelve CSS-only variants (gradient sky plus simple shapes). It requires nothing from the player and changes on its own, which is what makes the room feel like a place. A wrong device clock simply shows the wrong pretty view.

### Speech

`speech.js` holds one array of lines, each with `minLevel` and optional tags. At render, `app.js` assembles a context — mood, streak length, time of day, items owned, days since `createdDay` — and `pick()` filters to lines whose level and tags are satisfied, then chooses one, avoiding an immediate repeat. The last-shown line is held in memory only; it does not need to persist.

Two rules are baked into the data and the selector:

- **Mood wins.** A returning player always gets a missing-you line first, regardless of level.
- **No sad lines exist in the pool** at any tier — the constraint expressed as data rather than as a code review.

Everything in this section is data. Adding a wallpaper, an item, or fifty speech lines is a config edit, not a code change, which is what makes the bucket-1 tuning pass cheap.

---

## Error handling and edge cases

| Case | Behavior |
|---|---|
| `localStorage` unavailable | Existing in-memory fallback covers it. Bond works, just isn't persisted. No special casing. |
| Event log truncated (5000 cap) | Backfill under-credits. Accepted; it can never over-credit. |
| Migration re-entry | Guarded by the `version: 2` stamp. Runs exactly once. |
| Clock moved backward | A player could earn one extra daily-visit award (3 XP). Accepted — no anti-cheat in a single-player cozy game. |
| Timezone change mid-day | Day strings shift; at worst one extra or one skipped visit award. Harmless by the same logic. |
| Corrupt save, missing `pet.species` | Onboarding is shown again. |
| Unknown wallpaper/flooring id in state | Falls back to `plain`. Protects saves across config edits. |
| Owns more items than the level grants spots | Spot count floors at `ownedCount`; overflow positions appended from the next tier. Owned items are never hidden. Covered by a migration test. |
| Level beyond named tiers | Endless formula supplies thresholds; unlock lookup returns tier 8's unlocks. |

---

## Testing

**Node unit tests** — `tests/bond_test.js`, `npm run test:bond`:

- Thresholds are strictly increasing.
- Level lookup is correct at every boundary (exactly-at-threshold, one below, one above).
- Endless formula continues monotonically past tier 8.
- Backfill from a synthetic event log yields the expected level.
- XP is never negative and never decreases across any operation.

**Node unit tests** — speech pool:

- Every line has a valid `minLevel`.
- No line at any level matches a sad-word denylist (encodes the non-negotiable).
- `pick()` returns a line for every level 1–12 × every mood — no combination is starved.

**Playwright** — `tests/app_test.spec.js`:

- **Rewrite the existing full-core-loop test** for the four-beat arrival. It currently drives `#species-<name>` and `#pet-name-input` in one step and will break the moment this ships. Expected work, flagged deliberately.
- Bond XP increases after a daily solve.
- A locked shop item renders visible and disabled, and becomes enabled after a seeded level-up.
- Migration: seed a v1 `localStorage` payload with a known event history, load, assert v2 state with the backfilled level and untouched coins/owned/days.
- Migration with a full room: seed a v1 save owning all five permanents, assert all five still render after upgrade regardless of backfilled level.

Keep the suite green.

---

## Implementation slices

Each slice is independently playable and testable.

**Slice 1 — the relationship.** `bond.js`, `speech.js`, config blocks, storage v2 + backfill, the four-beat arrival, name-only rename, bond display on the pet card. No new visuals in the room. Ships "my pet and I have a history" on its own, and gets the bond math into real play for tuning before content is built on it.

**Slice 2 — the room deepens.** `room.js`, scene tiers, decor position lists, backdrops, expanded `PERMANENTS` with `minLevel`, locked-item shop presentation.

**Slice 3 — ambient.** The window, seasons and time of day, the endless numbered tail.

**Planning granularity:** this spec is deliberately larger than one implementation plan. Each slice should get its own plan, written when that slice starts, so slice 2 and 3 can absorb what tuning slice 1 teaches. Slice 1 is the one to plan now.

## Open questions for the tuning pass

None blocking implementation. The XP values, thresholds, and the eight tier names are all `config.js` data, expected to change during bucket-1 dogfooding.
