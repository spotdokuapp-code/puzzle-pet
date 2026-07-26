/* Puzzle Pet — persistence. localStorage with in-memory fallback.
 * Day-one principle: every meaningful action is appended to an event log
 * so later features can be retroactively granted from history. */
(function () {
  'use strict';
  const KEY = 'puzzlepet.v2';
  const KEY_V1 = 'puzzlepet.v1';
  let memory = null; // fallback when localStorage unavailable (private mode, etc.)

  function defaults() {
    return {
      version: 2,
      createdDay: PPStore.today(),
      coins: 0,
      pet: { species: null, name: '', energy: PPConfig.ENERGY_MAX, energyTs: Date.now() },
      bond: PPBond.blankBond(),
      room: { wallpaper: 'plain', flooring: 'plain' },
      lastActiveDay: null,
      days: {},          // 'YYYY-MM-DD' → { slots: [bool,bool,bool], bonus: bool }
      owned: {},         // permanent id → true
      solves: 0,         // lifetime solve count (interstitial cadence)
      removeAds: false,
      events: []         // append-only log
    };
  }

  const PPStore = {
    today(d) {
      const t = d || new Date();
      const p = x => String(x).padStart(2, '0');
      return `${t.getFullYear()}-${p(t.getMonth() + 1)}-${p(t.getDate())}`;
    },
    load() {
      try {
        const raw = localStorage.getItem(KEY);
        if (raw) return Object.assign(defaults(), JSON.parse(raw));
        const old = localStorage.getItem(KEY_V1);
        if (old) {
          const parsed = Object.assign(defaults(), JSON.parse(old));
          let migrated;
          try {
            migrated = PPStore.migrate(parsed);
          } catch (e) {
            // The save parsed fine but migration itself blew up (e.g. a
            // malformed events array). Keep everything the player already
            // has — coins, pet, days, streak — and just start the bond
            // from zero instead of throwing the whole save away.
            parsed.version = 2;
            parsed.bond = PPBond.blankBond();
            migrated = parsed;
          }
          PPStore.save(migrated);
          return migrated;
        }
      } catch (e) { /* fall through */ }
      if (!memory) memory = defaults();
      return memory;
    },
    // v1 → v2: grant a bond level earned from the existing event history.
    // Coins, owned items, days, streak and pet identity are untouched.
    // Visit and petting XP start from today — those events never existed in v1.
    migrate(state) {
      state.version = 2;
      state.bond = PPBond.blankBond();
      state.bond.xp = PPBond.backfill(state.events);
      state.bond.level = PPBond.levelFor(state.bond.xp).level;
      return state;
    },
    save(state) {
      try { localStorage.setItem(KEY, JSON.stringify(state)); }
      catch (e) { memory = state; }
    },
    log(state, type, data) {
      state.events.push(Object.assign({ t: Date.now(), type }, data || {}));
      if (state.events.length > 5000) state.events.splice(0, state.events.length - 5000);
      PPStore.save(state);
    },
    reset() {
      try {
        localStorage.removeItem(KEY);
        localStorage.removeItem(KEY_V1);
      } catch (e) { /* noop */ }
      memory = null;
    }
  };
  window.PPStore = PPStore;
})();
