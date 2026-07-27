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

  SHOP_TEASE_RANGE: 5,               // tease the next locked tier only if it is within this many levels

  CONSUMABLES: [
    { id: 'berry',  name: 'Berry',      emoji: '🫐', price: 10, energy: 25 },
    { id: 'apple',  name: 'Apple',      emoji: '🍎', price: 18, energy: 45 },
    { id: 'cake',   name: 'Honey cake', emoji: '🍰', price: 40, energy: 100 }
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
  ENABLED_SPECIES: ['cat', 'dog'],   // starter roster; others arrive as level unlocks
  SPECIES_UNLOCKS: { bunny: 12, fox: 18, dino: 24, alien: 30 },
  XP_PAYOUTS: [10, 20, 35],          // daily easy / medium / hard
  XP_SET_BONUS: 15,                  // granted with the coin set bonus
  XP_FREEPLAY: 3,                    // intentionally weak; daily set stays best rate
  LEVEL_XP: [                        // cumulative XP to REACH L2..L30 (29 entries)
      60,   150,   270,   430,   630,   880,  1180,  1540,  1960,
    2340,  2730,  3130,  3540,  3960,  4390,  4830,  5280,  5740,  6210,
    6730,  7275,  7845,  8440,  9060,  9705, 10375, 11070, 11790, 12535
  ],

  AREAS: [                           // room regions, rendered as panels in the pet room
    { id: 'main',   level: 1,  name: 'Home' },
    { id: 'nook',   level: 5,  name: 'Window nook' },
    { id: 'garden', level: 10, name: 'Garden' },
    { id: 'pond',   level: 20, name: 'Pond' },
    { id: 'deck',   level: 30, name: 'Stargazing deck' }
  ],

  PERMANENTS: [
    { id: 'ball',      name: 'Bouncy ball',        emoji: '⚽', price: 80,   level: 1,  area: 'main' },
    { id: 'plant',     name: 'Little plant',       emoji: '🪴', price: 120,  level: 1,  area: 'main' },
    { id: 'lamp',      name: 'Cozy lamp',          emoji: '🛋️', price: 160,  level: 2,  area: 'main' },
    { id: 'rug',       name: 'Warm rug',           emoji: '🧶', price: 220,  level: 2,  area: 'main' },
    { id: 'bowl',      name: 'Food bowl',          emoji: '🥣', price: 180,  level: 3,  area: 'main' },
    { id: 'poster',    name: 'Star poster',        emoji: '🌟', price: 260,  level: 3,  area: 'main' },
    { id: 'shelf',     name: 'Bookshelf',          emoji: '📚', price: 320,  level: 4,  area: 'main' },
    { id: 'cushion',   name: 'Window cushion',     emoji: '💺', price: 300,  level: 5,  area: 'nook' },
    { id: 'lights',    name: 'String lights',      emoji: '✨', price: 260,  level: 5,  area: 'nook' },
    { id: 'toychest',  name: 'Toy chest',          emoji: '🧸', price: 380,  level: 6,  area: 'nook' },
    { id: 'frame',     name: 'Picture frame',      emoji: '🖼️', price: 340,  level: 7,  area: 'nook' },
    { id: 'tent',      name: 'Pet tent',           emoji: '⛺', price: 450,  level: 8,  area: 'main' },
    { id: 'aquarium',  name: 'Aquarium',           emoji: '🐠', price: 520,  level: 9,  area: 'nook' },
    { id: 'flowerbed', name: 'Flower bed',         emoji: '🌷', price: 400,  level: 10, area: 'garden' },
    { id: 'fountain',  name: 'Fountain',           emoji: '⛲', price: 600,  level: 10, area: 'garden' },
    { id: 'gnome',     name: 'Garden gnome',       emoji: '🪆', price: 380,  level: 11, area: 'garden' },
    { id: 'clover',    name: 'Clover patch',       emoji: '🍀', price: 420,  level: 12, area: 'garden' },
    { id: 'swing',     name: 'Tree swing',         emoji: '🛝', price: 480,  level: 13, area: 'garden' },
    { id: 'chimes',    name: 'Wind chimes',        emoji: '🎐', price: 440,  level: 14, area: 'nook' },
    { id: 'birdhouse', name: 'Birdhouse',          emoji: '🐦', price: 500,  level: 15, area: 'garden' },
    { id: 'veggie',    name: 'Veggie patch',       emoji: '🥕', price: 550,  level: 16, area: 'garden' },
    { id: 'hammock',   name: 'Hammock',            emoji: '🪢', price: 600,  level: 17, area: 'garden' },
    { id: 'mushroom',  name: 'Mushroom ring',      emoji: '🍄', price: 520,  level: 18, area: 'garden' },
    { id: 'lantern',   name: 'Lantern string',     emoji: '🏮', price: 580,  level: 19, area: 'garden' },
    { id: 'lily',      name: 'Lily pads',          emoji: '🪷', price: 500,  level: 20, area: 'pond' },
    { id: 'koi',       name: 'Koi friends',        emoji: '🐟', price: 700,  level: 20, area: 'pond' },
    { id: 'stones',    name: 'Stepping stones',    emoji: '🪨', price: 620,  level: 21, area: 'pond' },
    { id: 'cattails',  name: 'Cattails',           emoji: '🌾', price: 560,  level: 22, area: 'pond' },
    { id: 'dock',      name: 'Little dock',        emoji: '🪵', price: 750,  level: 23, area: 'pond' },
    { id: 'fossil',    name: 'Fossil rock',        emoji: '🦴', price: 650,  level: 24, area: 'pond' },
    { id: 'firefly',   name: 'Firefly jar',        emoji: '🫙', price: 700,  level: 25, area: 'garden' },
    { id: 'duck',      name: 'Duck friend',        emoji: '🦆', price: 800,  level: 26, area: 'pond' },
    { id: 'rowboat',   name: 'Rowboat',            emoji: '🛶', price: 900,  level: 27, area: 'pond' },
    { id: 'firepit',   name: 'Fire pit',           emoji: '🔥', price: 850,  level: 28, area: 'garden' },
    { id: 'crug',      name: 'Constellation rug',  emoji: '🌌', price: 900,  level: 29, area: 'main' },
    { id: 'telescope', name: 'Telescope',          emoji: '🔭', price: 1000, level: 30, area: 'deck' },
    { id: 'mobile',    name: 'Shooting-star mobile', emoji: '🌠', price: 1200, level: 30, area: 'deck' }
  ],

  DECO_SPOTS: {                      // per-area decor positions; lattice geometry is test-enforced
    main: {
      ball:   'left:12%; bottom:12px;',
      plant:  'right:10%; bottom:14px;',
      lamp:   'left:7%;  top:34%;',
      rug:    'right:26%; bottom:6px;',
      poster: 'right:8%; top:12%;',
      bowl:   'left:24%; top:56%;',
      shelf:  'right:6%; top:30%;',
      tent:   'left:22%; bottom:8px;',
      crug:   'right:18%; bottom:2px;'
    },
    nook: {
      cushion:  'left:8%;  bottom:10px;',
      aquarium: 'left:30%; bottom:10px;',
      toychest: 'left:52%; bottom:10px;',
      lights:   'left:30%; top:16%;',
      chimes:   'left:52%; top:16%;',
      frame:    'left:74%; top:16%;'
    },
    garden: {
      flowerbed: 'left:8%;  bottom:10px;',
      veggie:    'left:30%; bottom:10px;',
      mushroom:  'left:52%; bottom:10px;',
      firepit:   'left:74%; bottom:10px;',
      gnome:     'left:8%;  top:48%;',
      clover:    'left:30%; top:48%;',
      hammock:   'left:52%; top:48%;',
      firefly:   'left:74%; top:48%;',
      swing:     'left:8%;  top:16%;',
      birdhouse: 'left:30%; top:16%;',
      lantern:   'left:52%; top:16%;',
      fountain:  'left:74%; top:16%;'
    },
    pond: {
      lily:     'left:8%;  bottom:10px;',
      stones:   'left:30%; bottom:10px;',
      cattails: 'left:52%; bottom:10px;',
      dock:     'left:74%; bottom:10px;',
      fossil:   'left:8%;  top:48%;',
      koi:      'left:30%; top:48%;',
      duck:     'left:52%; top:48%;',
      rowboat:  'left:74%; top:48%;'
    },
    deck: {
      telescope: 'left:30%; bottom:10px;',
      mobile:    'left:52%; top:16%;'
    }
  }
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = PPConfig;
  global.PPConfig = PPConfig;
})(typeof window !== 'undefined' ? window : globalThis);
