/* Puzzle Pet — all tunable numbers in one place (economy, energy, cadence).
 * These are the "open question" knobs from the brief; tune here, nowhere else. */
(function (global) {
  'use strict';
  const PPConfig = {
  DAILY_SIZES: [5, 7, 9],                 // easy / medium / hard boards
  DAILY_LABELS: ['Easy', 'Medium', 'Hard'],
  DAILY_PAYOUTS: [10, 20, 45],            // escalating; set total must beat 3× opener
  DAILY_SET_BONUS: 25,                    // extra for finishing all three
  FREEPLAY_SIZE: 6,
  FREEPLAY_PAYOUT: 4,                     // daily set must always be the best rate

  ENERGY_MAX: 100,
  ENERGY_PER_MISTAKE: 10,                 // drained when a placed piece conflicts
  ENERGY_REGEN_MS: 90 * 1000,             // +1 energy per 90s while waiting
  ENERGY_RESTORE_COINS: 25,               // "share a snack" restore price

  INTERSTITIAL_EVERY: 3,                  // between-puzzle cadence; never mid-puzzle

  CONSUMABLES: [
    { id: 'berry',  name: 'Berry',      emoji: '🫐', price: 10, energy: 25 },
    { id: 'apple',  name: 'Apple',      emoji: '🍎', price: 18, energy: 45 },
    { id: 'cake',   name: 'Honey cake', emoji: '🍰', price: 40, energy: 100 }
  ],
  PERMANENTS: [
    { id: 'ball',   name: 'Bouncy ball',  emoji: '⚽', price: 80 },
    { id: 'plant',  name: 'Little plant', emoji: '🪴', price: 120 },
    { id: 'lamp',   name: 'Cozy lamp',    emoji: '🛋️', price: 160 },
    { id: 'rug',    name: 'Warm rug',     emoji: '🧶', price: 220 },
    { id: 'poster', name: 'Star poster',  emoji: '🌟', price: 260 }
  ],

  SPECIES: ['dog', 'cat', 'bunny', 'fox', 'dino', 'alien'],
  DEFAULT_NAMES: { dog: 'Biscuit', cat: 'Mochi', bunny: 'Clover', fox: 'Maple', dino: 'Pebble', alien: 'Zuzu' },

  // --- Bond (care level). Starting points only; tuning happens post-implementation. ---
  BOND_XP: {
    dailySolve: [4, 6, 10],        // by slot: easy / medium / hard
    setBonus: 6,
    freeplaySolve: 1,              // worst rate, mirroring coins
    visit: 3,                      // once per day
    pet: 1,
    petCapPerDay: 5,
    feed: { berry: 2, apple: 4, cake: 8 }
  },
  BOND_LEVELS: [                   // cumulative XP thresholds; names are display copy only
    { level: 1, xp: 0,    name: 'New friends' },
    { level: 2, xp: 20,   name: 'Getting comfy' },
    { level: 3, xp: 70,   name: 'Settling in' },
    { level: 4, xp: 160,  name: 'Room to grow' },
    { level: 5, xp: 320,  name: 'Little routines' },
    { level: 6, xp: 560,  name: 'Long afternoons' },
    { level: 7, xp: 900,  name: 'Home ground' },
    { level: 8, xp: 1400, name: 'Old friends' }
  ],
  BOND_ENDLESS: { stepGrowth: 1.15, coinGift: 50 },
  SPECIES_BLURBS: {
    dog:   'Bounds over the moment you open the app.',
    cat:   'Supervises every puzzle from a comfortable distance.',
    bunny: 'Quiet, watchful, and thrilled by small victories.',
    fox:   'Clever enough to solve it, polite enough to wait.',
    dino:  'Small, ancient, and very proud of you.',
    alien: 'Came a long way to watch someone think.'
  }
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = PPConfig;
  global.PPConfig = PPConfig;
})(typeof window !== 'undefined' ? window : globalThis);
