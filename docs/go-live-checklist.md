# Puzzle Pet — Go-Live Checklist

High-level buckets to get from v1-in-a-folder to public App Store launch. Sequenced roughly: buckets 1–3 can run in parallel now; 4–5 depend on them; 6 is the last mile. **The naming/legal bucket is the critical path — start it first, finish it last.**

---

## 1. Product feel & tuning *(start now — everything else builds on a loop that feels right)*

- [ ] Dogfood the daily loop for 5–7 days on a real device
- [ ] Tune coin economy in `config.js` (target: meaningful purchase every 2–3 days early on)
- [ ] Tune energy numbers (drain per mistake, regen rate, restore price) so it nudges, never punishes
- [ ] Sanity-check daily difficulty curve (is the 9×9 too long for a daily? adjust sizes/bands if so)
- [ ] Pet personality pass: more speech lines, idle animation, welcome-back moment for missing-you mood
- [ ] Add a simple how-to-play / rules intro for first-time solvers
- [ ] Review against design constraints: no guilt loops, streak minimum stays cheap, species-neutral copy

## 2. Naming & legal *(critical path — longest lead time)*

- [ ] Pick the brand word (shortlist: Gridling ★ recommended, Gridkin, Snugget; fallback: Spotdoku)
- [ ] Counsel-run trademark clearance on the final name
- [ ] File intent-to-use trademark application
- [ ] Rename app: display name, `appId` (currently `app.puzzlepet.game`), store listing
- [ ] Verify store metadata/keywords contain no "Meowdoku", "Queens", "Tango", "Two Not Touch"
- [ ] Visual-identity check: confirm art/UI reads as original vs. Meowdoku and Sproutle
- [ ] Draft privacy policy + terms (required for ads; host at a public URL)

## 3. iOS build & device readiness

- [ ] Enroll in Apple Developer Program ($99/yr — approval can take days, start early)
- [ ] `npm run ios:init` on the Mac; commit the generated `ios/` project
- [ ] App icon (original art, works at all sizes) + launch screen
- [ ] Safe-area / notch / Dynamic Island layout check on real devices
- [ ] Device QA matrix: small (SE) → large (Pro Max) screens, light/dark, offline
- [ ] Edge cases: midnight rollover mid-session, timezone change, energy regen while backgrounded, first-launch with no network
- [ ] Haptics + sound pass (subtle, cozy, off-toggle in settings)

## 4. Monetization wiring *(behind the existing `PPAds` stub — last code bucket)*

- [ ] AdMob account + app registration; mediation decision (start AdMob-only)
- [ ] Rewarded ad → energy restore (opt-in only)
- [ ] Interstitial between puzzles at `INTERSTITIAL_EVERY` cadence (never mid-puzzle, never forced)
- [ ] App Tracking Transparency: prefer non-personalized ads to skip the ATT prompt entirely, or implement the prompt
- [ ] StoreKit: coin packs (flat, fair prices) + remove-ads one-time IAP (interstitials only)
- [ ] Restore-purchases flow
- [ ] Sandbox-test every purchase path + ad failure fallbacks (no ad available ≠ blocked player)

## 5. Store readiness

- [ ] App Store listing: name, subtitle, description, keywords (legal-checked per bucket 2)
- [ ] Screenshots (6.7" + 6.1" required) and optional preview video
- [ ] Privacy nutrition labels (must match what AdMob actually collects)
- [ ] Age rating questionnaire (aim 4+/9+; do NOT enroll in Made for Kids — it restricts ads)
- [ ] Support URL + contact email
- [ ] App Review compliance pass (IAP rules, ad disclosure, no misleading pet-neglect mechanics — we're clean by design)

## 6. Beta & launch

- [ ] TestFlight internal build under working title
- [ ] External TestFlight beta (10–20 friendly testers), collect feedback 1–2 weeks
- [ ] Lightweight analytics decision (privacy-first; the event log already captures behavior locally)
- [ ] Crash monitoring (Xcode Organizer at minimum)
- [ ] Final economy/energy tuning pass from beta feedback
- [ ] Name/legal clearance confirmed → flip branding → submit for review
- [ ] Phased release ON for launch week; monitor reviews, crashes, D1/D7 retention
- [ ] Post-launch backlog parked: Takuzu second puzzle type, more pet animations, cloud sync (Supabase project exists), Android

---

*Working rule of thumb: buckets 1 & 3 make the game good, bucket 2 makes it launchable, buckets 4–5 make it a business, bucket 6 makes it safe to ship.*
