# Single Daily Puzzle + Levels — Design

**Date:** 2026-07-25
**Status:** Approved (brainstorming session)

## Summary

Two changes to the core loop:

1. **Daily** — the 3-slot daily set (5×5/7×7/9×9, sequential unlock, set bonus) becomes **one puzzle per day**, with difficulty ramping Monday→Sunday.
2. **Free play** — the endless flat-payout free-play mode becomes **Levels**: an endless numbered ladder every player climbs, with fixed payout per win and milestone chests.

## 1. Daily puzzle

One puzzle per day. Board size and payout derive from the date's weekday:

| Weekday | Board | Payout |
|---------|-------|--------|
| Mon     | 5×5   | 20 🪙  |
| Tue     | 6×6   | 25 🪙  |
| Wed     | 7×7   | 30 🪙  |
| Thu     | 7×7   | 30 🪙  |
| Fri     | 7×7   | 30 🪙  |
| Sat     | 8×8   | 40 🪙  |
| Sun     | 9×9   | 55 🪙  |

- **Seed:** `daily:YYYY-MM-DD` (slot removed). Same puzzle for everyone on a given date. Changing the seed scheme means previously generated daily boards change, but completion state is keyed by date and is unaffected.
- **Weekday derivation:** parse `YYYY-MM-DD` as local time (`new Date(dateStr + 'T00:00:00')`) so the board size never shifts across timezones relative to the player's own calendar.
- **Streak rule:** solving the day's puzzle preserves the streak and makes the pet's day. One puzzle, one rule. There is no fail state and no timer, so hard days cost patience, not risk.
- **Calendar back-fill:** unchanged in spirit. A missed date is playable later, uses that date's weekday size, and pays that date's payout. Back-fill still restores the streak.
- **Removed:** slots, sequential unlock, set bonus (`DAILY_SET_BONUS`), `DAILY_SIZES`, `DAILY_PAYOUTS`, `DAILY_LABELS`.
- **Added config:** `DAILY_WEEK_SIZES` (length 7, Sun-first to match `Date.getDay()`), `DAILY_WEEK_PAYOUTS` (length 7).

### CLAUDE.md update required

The constraint "**Streak minimum stays cheap**: the easy opener alone always preserves the streak and the pet's day. All three = set bonus." must be rewritten to: "**Streak minimum stays cheap**: solving the day's single puzzle preserves the streak and the pet's day; Mon–Fri boards stay small-to-medium, and calendar back-fill repairs any missed day." Also update the daily-set description under Puzzle rules.

## 2. Levels

- **Structure:** endless numbered ladder. Level N is generated from seed `level:N` — deterministic, identical for every player, zero authoring, never runs out.
- **Size curve** (pure function of N, defined in config so it is tunable and Node-testable):
  - 1–5 → 5×5 (doubles as onboarding)
  - 6–15 → 6×6
  - 16–30 → 7×7
  - 31–50 → 8×8
  - 51+ → deterministic rolling mix skewing hard: size = `[7, 8, 9, 8, 9, 9][N % 6]`
- **Payout:** fixed **6 🪙 per level win** regardless of size. Every **5th** level cleared additionally pays a **milestone chest of +20 🪙**.
- **Config knobs:** `LEVEL_PAYOUT`, `LEVEL_MILESTONE_EVERY`, `LEVEL_MILESTONE_BONUS`, plus the size-curve definition.
- **Strictly forward:** the player is always on their current level; clearing it advances to the next. No replay UI in v1 — this keeps "fixed pay per win" unfarmable because every win is a fresh level.
- **UI:** the home screen's free-play button becomes a **"Levels — Level N ▸"** card with a progress hint line (e.g. "2 more to a chest 🎁"). Tapping it starts the current level immediately. No new screen.
- **Energy & ads:** energy cost/gating and interstitial cadence (`INTERSTITIAL_EVERY`) apply to level plays exactly as they did to free play. Interstitials remain between puzzles only, never mid-puzzle.
- **Removed:** `FREEPLAY_SIZE`, `FREEPLAY_PAYOUT`, `PPDaily.freeplay(counter)`.

## 3. State & migration

- `state.days[date]` changes from `{ slots: [bool, bool, bool], bonus: bool }` to `{ done: bool }`.
  - One-time migration on load: `done = slots[0]`. Sequential unlock guaranteed slot 0 was always completed first, and slot 0 was the old streak condition, so no streak changes under migration.
  - Coins already earned (including old set bonuses) are never clawed back.
- New `state.level`: the player's current (next uncleared) level number, starting at 1.
- **Event log** (non-negotiable, preserved): level clears append `{ kind: 'level', n, date, ... }` events. Milestone eligibility derives from the level number (`n % LEVEL_MILESTONE_EVERY === 0`), so chests are retroactively grantable from history. Old `freeplay` events and `state.solves` remain in the log untouched; `state.solves` continues to drive interstitial cadence.

## 4. Economy notes

Old maximum daily income was 100 🪙 (full set + bonus). New: ~33 🪙/day average from the daily, plus 10 🪙/level effective (6 + amortized chest) from ladder climbing. The grind shifts from replaying the daily set to climbing levels — intended. Item prices (80–260 🪙) still land in the "a few days of play" range. All values are `config.js` knobs; retune after playtesting if needed.

Design constraints preserved: no forced ads, no fail state, no pressure timers, pause-don't-decay, pet never suffers.

## 5. Files touched

- `www/js/config.js` — new daily-week and level knobs; remove old daily/freeplay knobs.
- `www/js/daily.js` — `PPDaily.get(dateStr)` (single puzzle), `PPDaily.level(n)`; size-curve + weekday-size helpers (Node-loadable for tests).
- `www/js/app.js` — home screen daily card (single) + Levels card; solve handling (daily payout by weekday, level payout + chest, advance level); streak on `done`; calendar back-fill to single puzzle; migration.
- `www/index.html` — replace daily-slots markup and free-play button with single daily card + Levels card.
- `tests/generator_test.js` — add pure-function tests: level-size curve boundaries (5, 6, 15, 16, 30, 31, 50, 51+) and weekday→size mapping.
- `tests/app_test.spec.js` — rewrite daily-slot flows to single-puzzle flow; add level flow (clear level 1 → card shows Level 2; chest fires at level 5); add migration test (seed old-format `puzzlepet.v1`, assert streak and coins survive).
- `CLAUDE.md` — update streak constraint and daily-set description (see §1).

## 6. Testing

- **Node (`npm run test:gen`):** generator untouched; new tests for the size curve and weekday mapping as pure functions.
- **Playwright (`npm run test:app`):** daily single-puzzle solve pays weekday payout and keeps streak; level clear advances level and pays fixed amount; milestone chest at level 5; old-format storage migrates without losing streak/coins; back-fill of a missed day works and pays that day's payout. Keep green.

## Out of scope

Level replay UI, level path/map screen, daily difficulty personalization, second puzzle type, any change to energy/ad/IAP systems beyond wiring levels into the existing hooks.
