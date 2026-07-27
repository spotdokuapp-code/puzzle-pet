# Puzzle Pet — project instructions

Cozy iOS game: daily Star Battle-style logic puzzles earn coins to care for a small creature. **Built from scratch in this repo** (decision 2026-07-25: the old spotdoku-app codebase is reference-only and is not used). Plain HTML/CSS/JS in `www/`, no build step, Capacitor 8 for iOS (appId `app.puzzlepet.game`). Working title only — final name needs counsel clearance before public launch.

## Layout

- `www/index.html` — single page, all screens as `<section class="screen">`
- `www/js/config.js` — ALL tunable numbers (economy, energy, ad cadence). Tune here, nowhere else — includes the 37-item level/area catalog (AREAS + PERMANENTS); room areas + per-area decor spots (AREAS/DECO_SPOTS)
- `www/js/generator.js` — Star Battle generator/solver (seeded RNG, uniqueness-verified, difficulty by solver node count). Also loads in Node for tests.
- `www/js/storage.js` — localStorage `puzzlepet.v3`, in-memory fallback, append-only event log
- `www/js/level.js` — XP curve/level math (pure, Node-loadable)
- `www/js/speech.js` — speech pool
- `www/js/sprites.js` — 6 original SVG creatures (dog, cat, bunny, fox, dino, alien) × 3 moods
- `www/js/daily.js` — deterministic daily set (seed `daily:YYYY-MM-DD:slot`) + free play
- `www/js/game.js` — board play: tap cycles empty→mark→piece, live conflict highlight, no fail state
- `www/js/app.js` — screens, daily loop, streak/calendar, pet room, energy, ad stubs
- `tests/generator_test.js` — Node (`npm run test:gen`)
- `tests/level_test.js` — Node (`npm run test:level`)
- `tests/speech_test.js` — Node (`npm run test:speech`)
- `tests/app_test.spec.js` — Playwright e2e (`npm run test:app`; set `PP_CHROMIUM=<path>` to use a system chromium). Keep green.

## Non-negotiable design constraints

- **The pet misses you; it never suffers.** No starving, wilting, sad-decay visuals, or guilt loops. Lapsed players are welcomed back, never punished. Moods are happy / content / missing-you only.
- **Pause, don't decay** while the player is away. Calendar back-fill restores anything missed and still pays.
- **Streak minimum stays cheap**: the easy opener alone always preserves the streak and the pet's day. All three = set bonus.
- **Species-neutral tone** — the roster includes a dino and an alien.
- Species become switchable friends at levels 12/18/24/30 (SPECIES_UNLOCKS); switching keeps everything but the companion.
- **Monetization ethics**: never a forced ad wall, never a hard fail screen, no pressure timers. Interstitials between puzzles only (`INTERSTITIAL_EVERY`), never mid-puzzle. Rewarded ads opt-in only. Ad/IAP code stays behind the `PPAds` stub interface until store build.
- **Event log**: every meaningful action appends to `state.events` so later features can be retroactively granted from history. Never remove this.

## Legal cautions

- Genre mechanics are public domain (Star Battle, 2003 WPC); expression is not. Keep visuals original, distinct from Meowdoku and Sproutle.
- Never use "Meowdoku", "Queens", "Tango", or "Two Not Touch" in store metadata, keywords, or marketing copy.
- Naming shortlist: Gridling (recommended), Gridkin, Snugget; fallback "Spotdoku". Counsel clearance + ITU filing before launch; TestFlight under working title OK.

## Puzzle rules

One ★ per row, column, and colored region; no two ★ touch, even diagonally. Boards 5×5–9×9. Daily set: 5×5 easy / 7×7 medium / 9×9 hard, same puzzles for everyone on a given date.

## Out of scope for v1

Second puzzle type (Takuzu — designed, not built), extra pet animations, social/leaderboards, Android, cloud sync on by default. Supabase project `spotdoku` (ref `nsjjoiypkcjnnzacvfkf`) exists from the old app and can be repurposed when cloud sync lands.
