/* Puzzle Pet — persistence. localStorage with in-memory fallback.
 * Day-one principle: every meaningful action is appended to an event log
 * so later features can be retroactively granted from history. */
(function () {
  'use strict';
  const KEY = 'puzzlepet.v3';
  const KEY_V2 = 'puzzlepet.v2';
  const KEY_V1 = 'puzzlepet.v1';
  let memory = null; // fallback when localStorage unavailable (private mode, etc.)

  function defaults() {
    return {
      version: 3,
      createdDay: PPStore.today(),
      coins: 0,
      pet: { species: null, name: '', energy: PPConfig.ENERGY_MAX, energyTs: Date.now(), xp: 0, levelHigh: 1 },
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
        if (raw) {
          const s = Object.assign(defaults(), JSON.parse(raw));
          // Saved objects replace the nested pet wholesale, so a v3 save
          // written before a field existed needs an explicit patch.
          if (s.pet.xp == null) { s.pet.xp = 0; s.pet.levelHigh = 1; }
          return s;
        }
        const old = localStorage.getItem(KEY_V2) || localStorage.getItem(KEY_V1);
        if (old) {
          const parsed = Object.assign(defaults(), JSON.parse(old));
          let migrated;
          try {
            migrated = PPStore.migrate(parsed);
          } catch (e) {
            // The save parsed but migration blew up (e.g. malformed events).
            // Keep everything the player has; start XP from zero rather than
            // throwing the save away. A tampered save can even have a null
            // pet — guard here too, or this catch throws and the whole save
            // is lost to defaults().
            parsed.version = 3;
            if (!parsed.pet) parsed.pet = Object.assign({}, defaults().pet);
            parsed.pet.xp = 0;
            parsed.pet.levelHigh = 1;
            delete parsed.bond;
            migrated = parsed;
          }
          PPStore.save(migrated);
          return migrated;
        }
      } catch (e) { /* fall through */ }
      if (!memory) memory = defaults();
      return memory;
    },
    // v1/v2 → v3: recompute lifetime XP from history at the NEW values.
    // Coins, owned items, days, streak, and pet identity are untouched.
    // The old bond field is dropped; old bond_visit/bond_pet events are
    // simply ignored by backfill. Old keys are left in place deliberately —
    // save() swallows quota failures, so we cannot prove the v3 write
    // landed, and the old key is what makes re-migration safe.
    migrate(state) {
      state.version = 3;
      if (!state.pet) state.pet = Object.assign({}, defaults().pet);
      const xp = PPLevel.backfill(state.events, state.days);
      state.pet.xp = xp;
      state.pet.levelHigh = PPLevel.levelForXp(xp).level;
      delete state.bond;
      state.events.push({ t: Date.now(), type: 'xp_backfill', xp, level: state.pet.levelHigh });
      if (state.pet.levelHigh > 1) state.backfillToast = state.pet.levelHigh;
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
        localStorage.removeItem(KEY_V2);
        localStorage.removeItem(KEY_V1);
      } catch (e) { /* noop */ }
      memory = null;
    }
  };
  window.PPStore = PPStore;
})();
