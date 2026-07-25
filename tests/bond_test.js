// Puzzle Pet — Node tests for the bond system: thresholds, level lookup,
// the endless tail, daily gates, and event-log backfill.
require('../www/js/config.js');
const PPBond = require('../www/js/bond.js');
const C = globalThis.PPConfig;

let failures = 0;
function check(cond, msg) {
  if (!cond) { failures++; console.error('FAIL:', msg); }
}

// --- Thresholds match config exactly for named tiers ---
C.BOND_LEVELS.forEach(t => {
  check(PPBond.thresholdFor(t.level) === t.xp, `threshold level ${t.level} === ${t.xp}`);
});

// --- Thresholds are strictly increasing, named tiers and well into the endless tail ---
for (let lv = 1; lv < 40; lv++) {
  check(PPBond.thresholdFor(lv + 1) > PPBond.thresholdFor(lv), `threshold increases at ${lv}`);
}

// --- Endless tail grows the step by BOND_ENDLESS.stepGrowth ---
const last = C.BOND_LEVELS[C.BOND_LEVELS.length - 1];
const prev = C.BOND_LEVELS[C.BOND_LEVELS.length - 2];
const namedStep = last.xp - prev.xp;
const expected9 = last.xp + Math.round(namedStep * C.BOND_ENDLESS.stepGrowth);
check(PPBond.thresholdFor(last.level + 1) === expected9,
  `first endless threshold === ${expected9}`);

// --- Level lookup at every boundary: one below, exactly at, one above ---
C.BOND_LEVELS.forEach(t => {
  if (t.xp > 0) {
    check(PPBond.levelFor(t.xp - 1).level === t.level - 1, `xp ${t.xp - 1} is level ${t.level - 1}`);
  }
  check(PPBond.levelFor(t.xp).level === t.level, `xp ${t.xp} is level ${t.level}`);
  check(PPBond.levelFor(t.xp + 1).level === t.level, `xp ${t.xp + 1} is still level ${t.level}`);
});

// --- levelFor reports usable progress numbers ---
const mid = PPBond.levelFor(45);   // between level 2 (20) and level 3 (70)
check(mid.level === 2, 'xp 45 is level 2');
check(mid.name === 'Getting comfy', 'level 2 is named Getting comfy');
check(mid.into === 25, 'xp 45 is 25 into level 2');
check(mid.needed === 50, 'level 2 spans 50 xp');

// --- Named tiers carry a name; endless levels do not ---
check(PPBond.levelFor(0).name === 'New friends', 'level 1 named');
check(PPBond.levelFor(PPBond.thresholdFor(9)).name === null, 'endless level has no name');
check(PPBond.levelFor(PPBond.thresholdFor(9)).level === 9, 'endless level number correct');

// --- xpFor covers every source ---
check(PPBond.xpFor('daily', { slot: 0 }) === C.BOND_XP.dailySolve[0], 'xpFor daily slot 0');
check(PPBond.xpFor('daily', { slot: 2 }) === C.BOND_XP.dailySolve[2], 'xpFor daily slot 2');
check(PPBond.xpFor('setBonus') === C.BOND_XP.setBonus, 'xpFor setBonus');
check(PPBond.xpFor('freeplay') === C.BOND_XP.freeplaySolve, 'xpFor freeplay');
check(PPBond.xpFor('visit') === C.BOND_XP.visit, 'xpFor visit');
check(PPBond.xpFor('pet') === C.BOND_XP.pet, 'xpFor pet');
check(PPBond.xpFor('feed', { item: 'cake' }) === C.BOND_XP.feed.cake, 'xpFor feed cake');
check(PPBond.xpFor('nonsense') === 0, 'unknown source is 0, not NaN');
check(PPBond.xpFor('feed', { item: 'nonsense' }) === 0, 'unknown feed item is 0, not NaN');
check(PPBond.xpFor('daily', { slot: 99 }) === 0, 'out-of-range slot is 0, not undefined');

// --- Endless-tail step is clamped to a minimum of 1, so thresholds stay
// strictly increasing (and levelFor terminates) even for a stepGrowth value
// low enough to otherwise round the step down to 0. ---
(function checkEndlessStepFloor() {
  const originalStepGrowth = C.BOND_ENDLESS.stepGrowth;
  C.BOND_ENDLESS.stepGrowth = 0.1;
  try {
    let prevXp = PPBond.thresholdFor(C.BOND_LEVELS.length + 1);
    for (let lv = C.BOND_LEVELS.length + 2; lv <= C.BOND_LEVELS.length + 20; lv++) {
      const xp = PPBond.thresholdFor(lv);
      check(xp > prevXp, `low-stepGrowth threshold still increases at level ${lv}`);
      prevXp = xp;
    }
    const farXp = PPBond.thresholdFor(C.BOND_LEVELS.length + 20);
    const result = PPBond.levelFor(farXp);
    check(result.level === C.BOND_LEVELS.length + 20, 'levelFor terminates and returns correct level under low stepGrowth');
  } finally {
    C.BOND_ENDLESS.stepGrowth = originalStepGrowth;
  }
})();

// --- award() adds XP and reports the level transition ---
function freshState() {
  return { bond: PPBond.blankBond(), events: [] };
}

const s1 = freshState();
const a1 = PPBond.award(s1, 'daily', { slot: 0 });
check(a1.gained === C.BOND_XP.dailySolve[0], 'award returns gained xp');
check(a1.from === 1 && a1.to === 1, 'small award does not level up');
check(s1.bond.xp === C.BOND_XP.dailySolve[0], 'award mutates state xp');

const s2 = freshState();
s2.bond.xp = C.BOND_LEVELS[1].xp - 1;      // one XP short of level 2
s2.bond.level = 1;
const a2 = PPBond.award(s2, 'pet');
check(a2.from === 1 && a2.to === 2, 'crossing a threshold reports from 1 to 2');
check(s2.bond.level === 2, 'award updates state level');

// --- award never decreases XP, whatever it is handed ---
const s3 = freshState();
s3.bond.xp = 100;
PPBond.award(s3, 'nonsense');
check(s3.bond.xp === 100, 'unknown source leaves xp unchanged, never negative');

// --- claimVisit: once per day ---
const s4 = freshState();
const first = PPBond.claimVisit(s4, '2026-07-25');
check(first && first.gained === C.BOND_XP.visit, 'first visit of the day awards');
check(PPBond.claimVisit(s4, '2026-07-25') === null, 'second visit same day awards nothing');
const nextDay = PPBond.claimVisit(s4, '2026-07-26');
check(nextDay && nextDay.gained === C.BOND_XP.visit, 'visit awards again on a new day');

// --- claimPet: capped per day, resets on a new day ---
const s5 = freshState();
let awarded = 0;
for (let i = 0; i < C.BOND_XP.petCapPerDay + 3; i++) {
  if (PPBond.claimPet(s5, '2026-07-25')) awarded++;
}
check(awarded === C.BOND_XP.petCapPerDay, `petting caps at ${C.BOND_XP.petCapPerDay}/day`);
check(PPBond.claimPet(s5, '2026-07-26') !== null, 'petting cap resets on a new day');
check(s5.bond.pets === 1, 'pet counter resets to 1 on the new day');

if (failures) { console.error(`${failures} failure(s)`); process.exit(1); }
console.log('bond tests: all passed');
