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

  SPECIES_BLURBS: {
    dog:   'Bounds over the moment you open the app.',
    cat:   'Supervises every puzzle from a comfortable distance.',
    bunny: 'Quiet, watchful, and thrilled by small victories.',
    fox:   'Clever enough to solve it, polite enough to wait.',
    dino:  'Small, ancient, and very proud of you.',
    alien: 'Came a long way to watch someone think.'
  },

  // --- Leveling (v2). Puzzle XP only; values are spec-locked, tuning deferred. ---
  ENABLED_SPECIES: ['cat', 'dog'],   // onboarding roster; others return as unlocks (plan 4)
  XP_PAYOUTS: [10, 20, 35],          // daily easy / medium / hard
  XP_SET_BONUS: 15,                  // granted with the coin set bonus
  XP_FREEPLAY: 3,                    // intentionally weak; daily set stays best rate
  LEVEL_XP: [                        // cumulative XP to REACH L2..L30 (29 entries)
      60,   150,   270,   430,   630,   880,  1180,  1540,  1960,
    2340,  2730,  3130,  3540,  3960,  4390,  4830,  5280,  5740,  6210,
    6730,  7275,  7845,  8440,  9060,  9705, 10375, 11070, 11790, 12535
  ]
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = PPConfig;
  global.PPConfig = PPConfig;
})(typeof window !== 'undefined' ? window : globalThis);
