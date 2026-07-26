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

if (failures) { console.error(`${failures} failure(s)`); process.exit(1); }
console.log('level tests: all passed');
