// Puzzle Pet — Node tests for the leveling system: the 30-level curve,
// boundary lookups, the display ratchet, XP sources, and event-log backfill.
require('../www/js/config.js');
const PPLevel = require('../www/js/level.js');
const C = globalThis.PPConfig;

let failures = 0;
function check(cond, msg) {
  if (!cond) { failures++; console.error('FAIL:', msg); }
}

// --- Shape: 29 thresholds, strictly increasing ---
check(C.LEVEL_XP.length === 29, 'LEVEL_XP has 29 entries');
for (let i = 1; i < C.LEVEL_XP.length; i++) {
  check(C.LEVEL_XP[i] > C.LEVEL_XP[i - 1], `LEVEL_XP increases at index ${i}`);
}
check(PPLevel.CAP === 30, 'CAP is 30');

// --- thresholdFor ---
check(PPLevel.thresholdFor(1) === 0, 'L1 costs 0');
check(PPLevel.thresholdFor(2) === C.LEVEL_XP[0], 'L2 threshold from config');
check(PPLevel.thresholdFor(30) === C.LEVEL_XP[28], 'L30 threshold from config');
check(PPLevel.thresholdFor(31) === Infinity, 'above cap is unreachable');

// --- levelForXp at every boundary: one below, exactly at, one above ---
C.LEVEL_XP.forEach((xp, i) => {
  const lv = i + 2;
  check(PPLevel.levelForXp(xp - 1).level === lv - 1, `xp ${xp - 1} is L${lv - 1}`);
  check(PPLevel.levelForXp(xp).level === lv, `xp ${xp} is L${lv}`);
  check(PPLevel.levelForXp(xp + 1).level === lv, `xp ${xp + 1} still L${lv}`);
});

// --- progress numbers mid-level ---
const mid = PPLevel.levelForXp(100);   // between L2 (60) and L3 (150)
check(mid.level === 2, 'xp 100 is L2');
check(mid.into === 40 && mid.needed === 90, 'xp 100 is 40/90 into L2');
check(mid.atCap === false, 'xp 100 not at cap');

// --- the cap ---
const capped = PPLevel.levelForXp(999999);
check(capped.level === 30 && capped.atCap === true, 'huge xp caps at L30');
check(capped.next === null && capped.needed === null, 'no next level at cap');

// --- displayLevel ratchet: a threshold retune can never demote ---
check(PPLevel.displayLevel({ xp: 100, levelHigh: 5 }) === 5, 'levelHigh floors display');
check(PPLevel.displayLevel({ xp: 100, levelHigh: 1 }) === 2, 'derived wins when higher');
check(PPLevel.displayLevel({ xp: 100 }) === 2, 'missing levelHigh defaults safely');

// --- xpFor ---
check(PPLevel.xpFor('daily', { slot: 0 }) === C.XP_PAYOUTS[0], 'daily slot 0');
check(PPLevel.xpFor('daily', { slot: 2 }) === C.XP_PAYOUTS[2], 'daily slot 2');
check(PPLevel.xpFor('setBonus') === C.XP_SET_BONUS, 'set bonus');
check(PPLevel.xpFor('freeplay') === C.XP_FREEPLAY, 'freeplay');
check(PPLevel.xpFor('feed', { item: 'cake' }) === 0, 'feeding grants no XP');
check(PPLevel.xpFor('visit') === 0, 'visiting grants no XP');
check(PPLevel.xpFor('pet') === 0, 'petting grants no XP');
check(PPLevel.xpFor('daily', { slot: 99 }) === 0, 'bad slot is 0, not undefined');
check(PPLevel.xpFor('nonsense') === 0, 'unknown source is 0, not NaN');

// --- backfill: replay events at the NEW values; +setBonus per bonus day ---
const history = [
  { type: 'pet_chosen', species: 'cat', name: 'Mochi' },
  { type: 'puzzle_solved', kind: 'daily', slot: 0 },
  { type: 'puzzle_solved', kind: 'daily', slot: 1 },
  { type: 'puzzle_solved', kind: 'daily', slot: 2 },
  { type: 'puzzle_solved', kind: 'free' },
  { type: 'feed', item: 'cake' },          // no XP in v2
  { type: 'bond_visit', xp: 3 },           // legacy v2-save event: ignored
  { type: 'bond_pet', xp: 1 },             // legacy v2-save event: ignored
  { type: 'buy_permanent', item: 'ball' }
];
const daysMap = {
  '2026-06-20': { slots: [true, true, true], bonus: true },
  '2026-06-21': { slots: [true, false, false], bonus: false }
};
const expected = C.XP_PAYOUTS[0] + C.XP_PAYOUTS[1] + C.XP_PAYOUTS[2]
               + C.XP_FREEPLAY + C.XP_SET_BONUS;
check(PPLevel.backfill(history, daysMap) === expected, `backfill totals ${expected}`);

// Defensive: malformed, missing, and typo'd inputs must not throw or produce NaN.
check(PPLevel.backfill([], {}) === 0, 'empty history is 0');
check(PPLevel.backfill(undefined, undefined) === 0, 'missing history is 0');
check(PPLevel.backfill([{ type: 'puzzle_solved', kind: 'daily' }], {}) === 0,
  'daily solve with no slot is 0, not NaN');
check(PPLevel.backfill([null, { type: 'feed' }], { x: null }) === 0,
  'null entries are skipped');

// --- strict allow-list for puzzle_solved.kind ---
check(PPLevel.backfill([{ type: 'puzzle_solved' }], {}) === 0,
  'puzzle_solved with missing kind is 0');
check(PPLevel.backfill([{ type: 'puzzle_solved', kind: 'dialy' }], {}) === 0,
  'puzzle_solved with typo\'d kind is 0');
check(PPLevel.backfill([{ type: 'puzzle_solved', kind: 'free' }], {}) === C.XP_FREEPLAY,
  'puzzle_solved with kind "free" credits freeplay');

// --- non-array/non-object inputs don't throw ---
check(PPLevel.backfill({}, {}) === 0, 'object events arg doesn\'t throw');
check(PPLevel.backfill('oops', 'oops') === 0, 'string events/days args don\'t throw');

if (failures) { console.error(`${failures} failure(s)`); process.exit(1); }
console.log('level tests: all passed');
