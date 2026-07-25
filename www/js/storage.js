/* Puzzle Pet — persistence. localStorage with in-memory fallback.
 * Day-one principle: every meaningful action is appended to an event log
 * so later features can be retroactively granted from history. */
(function () {
  'use strict';
  const KEY = 'puzzlepet.v1';
  let memory = null; // fallback when localStorage unavailable (private mode, etc.)

  function defaults() {
    return {
      version: 1,
      createdDay: PPStore.today(),
      coins: 0,
      pet: { species: null, name: '', energy: PPConfig.ENERGY_MAX, energyTs: Date.now() },
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
      } catch (e) { /* fall through */ }
      if (!memory) memory = defaults();
      return memory;
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
      try { localStorage.removeItem(KEY); } catch (e) { /* noop */ }
      memory = null;
    }
  };
  window.PPStore = PPStore;
})();
