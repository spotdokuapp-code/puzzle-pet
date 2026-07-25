/* Puzzle Pet — daily set: 3 puzzles per date, deterministic seed so everyone
 * (and every replay of a back-filled day) gets the same puzzles. */
(function () {
  'use strict';
  const cache = {};
  window.PPDaily = {
    get(dateStr, slot) {
      const key = dateStr + ':' + slot;
      if (!cache[key]) {
        cache[key] = PPGen.generate(PPConfig.DAILY_SIZES[slot], 'daily:' + key);
      }
      return cache[key];
    },
    freeplay(counter) {
      // Seeded but varied per solve; deterministic per player-counter for testability.
      return PPGen.generate(PPConfig.FREEPLAY_SIZE, 'freeplay:' + counter + ':' + PPStore.today());
    }
  };
})();
