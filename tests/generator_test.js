// Node test for the Star Battle generator: determinism, uniqueness, performance.
const PPGen = require('../www/js/generator.js');

let failures = 0;
function check(cond, msg) {
  if (!cond) { failures++; console.error('FAIL:', msg); }
}

// Determinism: same seed → identical puzzle.
for (const n of [5, 7, 9]) {
  const a = PPGen.generate(n, `det:${n}`);
  const b = PPGen.generate(n, `det:${n}`);
  check(a && b, `generate ${n}x${n}`);
  check(JSON.stringify(a) === JSON.stringify(b), `determinism ${n}x${n}`);
}

// Uniqueness + validity + perf across sizes and seeds.
for (const n of [5, 6, 7, 8, 9]) {
  const times = [];
  for (let s = 0; s < 10; s++) {
    const t0 = process.hrtime.bigint();
    const p = PPGen.generate(n, `test:${n}:${s}`);
    times.push(Number(process.hrtime.bigint() - t0) / 1e6);
    check(p, `generate ${n}x${n} seed ${s}`);
    if (!p) continue;
    check(PPGen.solveCount(n, p.region, 3).count === 1, `unique ${n}x${n} seed ${s}`);
    check(PPGen.isSolution(n, p.region, p.solution), `solution valid ${n}x${n} seed ${s}`);
    // Every region non-empty and contains its solution cell.
    const sizes = new Array(n).fill(0);
    p.region.forEach(r => sizes[r]++);
    check(sizes.every(x => x > 0), `regions non-empty ${n}x${n} seed ${s}`);
    for (let r = 0; r < n; r++) {
      check(p.region[r * n + p.solution[r]] === r, `region ${r} holds its piece ${n}x${n} seed ${s}`);
    }
  }
  const avg = times.reduce((x, y) => x + y, 0) / times.length;
  console.log(`${n}x${n}: avg ${avg.toFixed(1)}ms  max ${Math.max(...times).toFixed(1)}ms`);
}

if (failures) { console.error(`${failures} failure(s)`); process.exit(1); }
console.log('generator tests: all passed');
