// Puzzle Pet — catalog integrity. Guards spec §6's promises against future
// edits: exact shape, no empty levels 2–30, every area reference real.
require('../www/js/config.js');
const C = globalThis.PPConfig;

let failures = 0;
function check(cond, msg) {
  if (!cond) { failures++; console.error('FAIL:', msg); }
}

const AREA_IDS = C.AREAS.map(a => a.id);
check(AREA_IDS.join(',') === 'main,nook,garden,pond,deck', 'areas in order');
C.AREAS.forEach(a => check(Number.isInteger(a.level) && a.level >= 1, `area ${a.id} has a level`));

check(C.PERMANENTS.length === 37, `37 permanents (got ${C.PERMANENTS.length})`);

const ids = new Set();
let prevLevel = 0;
C.PERMANENTS.forEach(p => {
  check(p.id && !ids.has(p.id), `unique id ${p.id}`);
  ids.add(p.id);
  check(typeof p.name === 'string' && p.name.length > 0, `${p.id} has a name`);
  check(typeof p.emoji === 'string' && p.emoji.length > 0, `${p.id} has an emoji`);
  check(Number.isInteger(p.price) && p.price > 0, `${p.id} price positive`);
  check(Number.isInteger(p.level) && p.level >= 1 && p.level <= 30, `${p.id} level 1..30`);
  check(AREA_IDS.includes(p.area), `${p.id} area "${p.area}" exists`);
  const area = C.AREAS.find(a => a.id === p.area);
  check(p.level >= area.level, `${p.id} not below its area's unlock level`);
  check(p.level >= prevLevel, `catalog sorted by level at ${p.id}`);
  prevLevel = p.level;
});

// Spec §2: every level 2..30 unlocks at least one thing (item, area, or —
// in plan 4 — a species). Items and areas are what exist in config today;
// species milestone levels are covered by their area/item entries per §6.
for (let lv = 2; lv <= 30; lv++) {
  const hasItem = C.PERMANENTS.some(p => p.level === lv);
  const hasArea = C.AREAS.some(a => a.level === lv);
  check(hasItem || hasArea, `level ${lv} unlocks something`);
}

// The original five keep their ids and prices — migrated saves own them.
[['ball', 80], ['plant', 120], ['lamp', 160], ['rug', 220], ['poster', 260]].forEach(([id, price]) => {
  const p = C.PERMANENTS.find(x => x.id === id);
  check(p && p.price === price, `legacy item ${id} intact at ${price}`);
});

if (failures) { console.error(`${failures} failure(s)`); process.exit(1); }
console.log(`catalog tests: all passed (${C.PERMANENTS.length} items)`);
