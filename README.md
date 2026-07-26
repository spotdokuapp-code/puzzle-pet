# Puzzle Pet (working title)

Cozy daily logic puzzles that care for a small creature. Solve the daily Star Battle set → earn coins → feed and decorate for your pal. The pet misses you; it never suffers.

## Run it

No build step — it's plain HTML/CSS/JS.

```bash
npm install
npm run serve        # http://localhost:8080
```

## Tests

```bash
npm run test:gen     # Node: generator determinism, uniqueness, perf
npm run test:bond    # Node: bond xp, levels, daily gates, event-log backfill
npm run test:speech  # Node: speech pool shape + the no-sad-lines rule
npm run test:app     # Playwright e2e (full core loop)
# If Playwright's pinned browser isn't downloaded:
PP_CHROMIUM=/path/to/chromium npm run test:app
```

## iOS (Capacitor)

On a Mac with Xcode:

```bash
npm run ios:init     # once
npm run ios:sync     # after web changes
npx cap open ios
```

## Where things live

All gameplay/economy tuning numbers are in `www/js/config.js`. Design rules and constraints are in `CLAUDE.md`. Ads and IAP are dev stubs behind `PPAds` in `app.js` — real SDKs drop in behind the same interface.
