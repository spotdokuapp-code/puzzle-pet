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

// --- Decor spots: every item has a spot, in its own area's map ---
C.PERMANENTS.forEach(p => {
  const spot = C.DECO_SPOTS[p.area] && C.DECO_SPOTS[p.area][p.id];
  check(typeof spot === 'string' && spot.length > 0, `${p.id} has a spot in ${p.area}`);
});
Object.keys(C.DECO_SPOTS).forEach(areaId => {
  check(AREA_IDS.includes(areaId), `spot map ${areaId} is a real area`);
  Object.keys(C.DECO_SPOTS[areaId]).forEach(id => {
    const item = C.PERMANENTS.find(p => p.id === id);
    check(item && item.area === areaId, `spot ${areaId}/${id} matches the item's area`);
  });
});

// --- Lattice geometry: non-main spots must be provably collision-free.
// Panels are modeled at 320x240 with a 28px glyph box. Main's nine legacy
// spots are grandfathered (verified via real rendered rects in plan 2)
// and excluded here; every NEW area must keep >= 4px clearance.
function box(css) {
  const W = 320, H = 240, G = 28;
  const get = (re) => { const m = css.match(re); return m ? parseFloat(m[1]) : null; };
  const lp = get(/left:\s*([\d.]+)%/), rp = get(/right:\s*([\d.]+)%/);
  const tp = get(/top:\s*([\d.]+)%/), bp = get(/bottom:\s*([\d.]+)px/);
  const x = lp !== null ? W * lp / 100 : W - (W * rp / 100) - G;
  const y = tp !== null ? H * tp / 100 : H - bp - G;
  return { x1: x, y1: y, x2: x + G, y2: y + G };
}
['nook', 'garden', 'pond', 'deck'].forEach(areaId => {
  const entries = Object.entries(C.DECO_SPOTS[areaId]);
  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      const a = box(entries[i][1]), b = box(entries[j][1]);
      const clear = a.x2 + 4 <= b.x1 || b.x2 + 4 <= a.x1 || a.y2 + 4 <= b.y1 || b.y2 + 4 <= a.y1;
      check(clear, `${areaId}: ${entries[i][0]} and ${entries[j][0]} keep 4px clearance`);
    }
  }
});

if (failures) { console.error(`${failures} failure(s)`); process.exit(1); }
console.log(`catalog tests: all passed (${C.PERMANENTS.length} items)`);
