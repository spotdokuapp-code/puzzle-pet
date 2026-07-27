# Production Readiness — App Development Design

**Date:** 2026-07-27
**Status:** Approved by Matt (brainstorming session)
**Scope:** Everything that makes the app itself feel like a finished product. Store/launch work (naming, legal, monetization wiring, listing) stays in `docs/go-live-checklist.md` and is out of scope here.

## Context

The game systems are solid — uniqueness-verified generator, economy, leveling, streak/calendar, species friends, tests — but the presentation layer is thin: ~316 lines of CSS, emoji for every UI icon and decor prop, six simple SVG creatures with three static moods, a board that renders text `★` glyphs into flat colored cells and rebuilds itself from scratch on every tap. The goal of this work is to close the gap between "systems demo" and "polished indie puzzle app."

## Decisions made

- **Quality bar:** polished indie puzzle app — cohesive custom visual identity, smooth transitions, satisfying feedback on every tap, delightful pet moments. Not chasing top-tier casual-game production for v1.
- **Art pipeline:** hybrid — upgraded hand-crafted in-code SVG for characters, icons, and props, animated with CSS. The `PPSprites.render(species, mood)` interface stays stable so commissioned art (Lottie/raster) can replace it later without a rewrite. SVG is the right native format for a Capacitor WebView: resolution-independent, kilobytes not megabytes, no asset build step.
- **Sequencing:** design language first (Approach A) — a tight foundation phase, then each surface consumes it. Avoids restyling the same screen twice. Tuning/dogfooding runs as a continuous thread from the moment the new board is playable, not as a final gate.
- **Out of scope for this effort:** dark mode (add later; token layer from Phase 1 makes it cheap), second puzzle type, social features, Android, cloud sync, and everything in go-live-checklist buckets 2–6.

## Phase structure

Each phase is a mergeable branch with green tests. Order: 1 → 2 → 3 → 4 → 5 → 6, with the dogfood/tune thread running from Phase 2 onward.

| # | Phase | One-liner |
|---|-------|-----------|
| 1 | Design language | Visual identity foundation: tokens, type, icons, motion, components |
| 2 | Board overhaul | The puzzle becomes a crafted game component with great feel |
| 3 | Characters & animation | The 6 creatures get real personality |
| 4 | Screens & chrome | Home, pet room, calendar, modals catch up to the identity |
| 5 | Sound & haptics | Cozy audio + tactile layer behind a stub-safe module |
| 6 | Tutorial | Interactive guided first puzzle |
| — | Dogfood & tune | Continuous `config.js` tuning from real play |

---

## Phase 1 — Design language

Foundation only; no screen redesigns, no board work, no character art.

- **Token system** in `www/css/style.css`: keep the warm cream/terracotta direction; deepen contrast slightly; add a semantic layer (`--surface`, `--surface-raised`, text tiers, state colors); define the board region-color palette Phase 2 will consume (richer than the current 9 hardcoded pastels in `game.js`, tuned so conflict highlights read on top of any of them).
- **Typography:** self-host Nunito in `www/fonts/` (currently only a fallback name, so most devices silently get system fonts). Define a type scale: display / heading / body / caption.
- **Custom SVG icon set** (~14 icons) replacing every UI emoji: calendar, room, free-play, settings, coin, streak flame, energy bolt, star, hint, lock, back chevron, sparkle, snack, checkmark. One consistent style (rounded, 2px stroke, warm fills), delivered as `www/js/icons.js` — same module pattern as `sprites.js`. Emoji survive only inside pet speech text, where they read as expression rather than UI.
- **Motion standards:** duration/easing tokens (fast ~150ms, standard ~250ms, celebratory ~450ms; one springy ease for game moments). `prefers-reduced-motion` respected globally. Screen transition upgraded from the current 180ms fade.
- **Component pass:** buttons get press states (scale + shadow compress — taps currently give zero feedback); cards get a subtle elevation system; chips, modals, and toasts restyled on the new tokens.
- **Dev styleguide page** `www/dev/styleguide.html` (dev-only, like the screenshots utility): every token, icon, and component on one page for visual iteration and drift-spotting.

## Phase 2 — Board overhaul

**Rendering rework (enabler):** `game.js` switches from wipe-and-rebuild (`innerHTML = ''` per tap) to persistent cell elements updated in place — prerequisite for placement animations, press states, and drag input. The public `PPGame` API (`start/clear/hint/active` + test hooks) stays stable so `app.js` and Playwright tests don't churn.

**Visual:**
- Region colors come from the Phase 1 token palette.
- The star becomes a drawn SVG piece (matching the icon set) with a placement pop (scale-spring + tiny sparkle). Marks become soft dots that fade in.
- Cells get a subtle inner surface treatment; board container gets depth (soft outer shadow, slightly inset cells, refined region-boundary strokes).

**Interaction feel:**
- Pointer-event-based input with press state on touch-down, spring on release.
- **Drag-to-mark:** dragging across empty cells paints dot-marks (essential for 9×9). Drag never places stars — stars stay a deliberate tap.
- **Undo:** per-puzzle move stack, button alongside Clear and Hint.
- **Auto-X toggle** in settings, off by default: placing a star auto-dots the cells it excludes. A comfort feature, not a solver.

**Solver support:**
- Conflict highlighting shows the conflicting pair plus a soft wash over the shared row/col/region (currently just a red wiggle on the star).
- Satisfaction cues: when a row/col/region has its star and is consistent, its remaining empty cells dim slightly.
- **Hint redesigned:** instead of placing a solution star (which spoils, and can currently even trigger the win itself), the hint highlights a logically forced cell and names the rule that forces it — teaching, not solving. Energy/coin mechanics for hints unchanged.

**Win moment:** stars twinkle in sequence, a soft particle burst, then the win overlay slides up (currently the modal appears instantly).

## Phase 3 — Characters & animation

- **Redesign all 6 species** (dog, cat, bunny, fox, dino, alien) as richer SVGs with shared construction — same body grammar, distinct silhouettes — so they read as one family. Bigger, more expressive faces. `sprites.js` grows from 87 lines into a real character system.
- **Moods stay exactly three** (happy / content / missing-you) per the design constraints. Missing-you reads wistful-hopeful, never sad.
- **Animation layer** (CSS-driven, reduced-motion aware): idle breathing/sway loop, randomized blinks, happy hop, greeting wave on entering the pet room, a "listening" tilt while speech shows.
- **Reaction moments:** the pet appears and reacts on the win overlay (it currently doesn't), on feeding, and on level-up.
- **Decor upgrade:** emoji props in the pet room become small SVG props in the same style; scene backgrounds get a light layered-depth pass.
- **Stable seam:** `PPSprites.render(species, mood)` signature unchanged; animations attach via classes. This is where a commissioned artist could later plug in.

## Phase 4 — Screens & chrome

- **Home:** pet card becomes a hero moment (bigger animated sprite, occasional speech bubble); daily slots get icons and clearer done/locked states; nav buttons use the icon set; the text title gets a small logotype treatment (styled text only — trivially renamed when the final name lands).
- **Pet room:** shop cards get SVG item art; scene-strip paging dots make the areas discoverable; smoother area-unlock sparkle.
- **Calendar:** back-fill affordance made inviting (it is a signature ethical feature — it should look like a gift); completed days get a small stamp instead of dots.
- **Overlays/modals:** unified slide-up-sheet motion; win/level-up/energy overlays restyled; the energy modal keeps its gentle tone and gains the pet sprite.
- **Screen transitions:** directional slide/fade using the Phase 1 motion tokens.

## Phase 5 — Sound & haptics

- **`PPSound` module** mirroring the `PPAds` stub pattern: tap, mark, star place, gentle conflict, win chime, coin, level-up, per-species pet chirps. Small bundled audio files (a few KB each, no network); Web Audio API playback.
- **Haptics** via the Capacitor Haptics plugin behind the same module (light impact on star place, success notification on win); silently no-ops in the browser so dev and Playwright are unaffected.
- **Settings:** sound and haptics independently toggleable, on by default, persisted in state.
- Respects the iOS silent switch; audio session configured not to interrupt the user's music.

## Phase 6 — Tutorial

- **Guided first puzzle:** a scripted 5×5 with step-by-step coach marks driven by the real board — learning is doing. Runs after pet naming in onboarding, skippable via "I know this puzzle" so experienced players keep the under-60-seconds-to-first-puzzle path.
- **Always available:** a "?" in the game header reopens the rules; compact illustrated rules sheet for reference.
- **Tone:** the pet teaches you — speech-bubble voice, not system instructions.

## Continuous thread — dogfood & tune

From Phase 2 onward: play the daily loop on a real device; every phase's PR includes a tuning check against `config.js` (coin economy target of a meaningful purchase every 2–3 days early on; energy that nudges, never punishes; 9×9 daily length sanity). Findings become config changes, never scattered magic numbers. This thread checks off go-live-checklist bucket 1.

## Testing & verification (all phases)

- Existing Node suites (`test:gen`, `test:level`, `test:speech`) and Playwright (`test:app`) stay green at every phase boundary; each phase is a mergeable branch.
- New e2e coverage where behavior changes: undo, drag-to-mark, auto-X, hint highlighting, tutorial flow, settings toggles.
- The screenshots dev utility is refreshed per phase; the styleguide page catches visual drift.
- Constraint review in every phase: no guilt loops, streak minimum stays cheap, species-neutral copy, and every new meaningful action (feeding, tutorial completion, toggle changes) appends to `state.events`.

## Design constraints that bind every phase

Carried from CLAUDE.md; restated because visual/audio work can violate them accidentally:

- The pet misses you; it never suffers. No sad-decay visuals, no guilt animation, no plaintive sounds for lapses.
- Conflict/error feedback is gentle — informative, never punishing (no harsh buzzers, no red flashes).
- No pressure timers anywhere in the new UI.
- Visuals must stay original and distinct from Meowdoku and Sproutle (bucket-2 visual-identity check applies to all new art).
