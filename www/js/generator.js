/* Puzzle Pet — Star Battle generator & solver.
 * One piece per row, column, and region; no two pieces touch, even diagonally.
 * Pipeline: solution-first backtracking → multi-source flood regions →
 * uniqueness via counting solver + hill-climbing boundary repair →
 * difficulty scored by solver backtracking node count.
 * All randomness flows through a seeded RNG so daily puzzles are deterministic.
 */
(function (global) {
  'use strict';

  // ---- Seeded RNG (xmur3 string hash → mulberry32) ----
  function xmur3(str) {
    let h = 1779033703 ^ str.length;
    for (let i = 0; i < str.length; i++) {
      h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    return function () {
      h = Math.imul(h ^ (h >>> 16), 2246822507);
      h = Math.imul(h ^ (h >>> 13), 3266489909);
      return (h ^= h >>> 16) >>> 0;
    };
  }
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function makeRng(seedStr) {
    const h = xmur3(String(seedStr));
    return mulberry32(h());
  }
  function shuffled(arr, rng) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // ---- Step 1: solution-first. One piece per row/col, adjacent rows' columns differ by ≥2. ----
  function generateSolution(n, rng) {
    const cols = new Array(n).fill(-1);
    const used = new Array(n).fill(false);
    function place(row) {
      if (row === n) return true;
      for (const c of shuffled([...Array(n).keys()], rng)) {
        if (used[c]) continue;
        if (row > 0 && Math.abs(c - cols[row - 1]) < 2) continue;
        cols[row] = c; used[c] = true;
        if (place(row + 1)) return true;
        cols[row] = -1; used[c] = false;
      }
      return false;
    }
    return place(0) ? cols : null; // cols[row] = column of the piece in that row
  }

  // ---- Step 2: regions by multi-source random flood growth from the solution cells. ----
  function growRegions(n, solutionCols, rng) {
    const region = new Array(n * n).fill(-1);
    for (let r = 0; r < n; r++) region[r * n + solutionCols[r]] = r;
    let unassigned = n * n - n;
    const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    while (unassigned > 0) {
      // Collect (assignedCell → unassigned neighbor) frontier edges, pick one at random.
      const frontier = [];
      for (let i = 0; i < n * n; i++) {
        if (region[i] === -1) continue;
        const r = Math.floor(i / n), c = i % n;
        for (const [dr, dc] of dirs) {
          const nr = r + dr, nc = c + dc;
          if (nr >= 0 && nr < n && nc >= 0 && nc < n && region[nr * n + nc] === -1) {
            frontier.push([region[i], nr * n + nc]);
          }
        }
      }
      const [reg, cell] = frontier[Math.floor(rng() * frontier.length)];
      region[cell] = reg;
      unassigned--;
    }
    return region; // region[r*n+c] = region index 0..n-1
  }

  // ---- Counting solver. Returns {count, nodes}; stops counting at `limit`. ----
  function solveCount(n, region, limit) {
    let count = 0, nodes = 0;
    const colUsed = new Array(n).fill(false);
    const regUsed = new Array(n).fill(false);
    const placed = new Array(n).fill(-1);
    function walk(row) {
      if (count >= limit) return;
      if (row === n) { count++; return; }
      for (let c = 0; c < n; c++) {
        if (colUsed[c] || regUsed[region[row * n + c]]) continue;
        if (row > 0 && Math.abs(c - placed[row - 1]) < 2) continue;
        nodes++;
        colUsed[c] = true; regUsed[region[row * n + c]] = true; placed[row] = c;
        walk(row + 1);
        colUsed[c] = false; regUsed[region[row * n + c]] = false; placed[row] = -1;
        if (count >= limit) return;
      }
    }
    walk(0);
    return { count, nodes };
  }

  // ---- Region connectivity check when cell `moved` leaves region `reg`. ----
  function staysConnected(n, region, reg, moved) {
    const cells = [];
    for (let i = 0; i < n * n; i++) if (region[i] === reg && i !== moved) cells.push(i);
    if (cells.length === 0) return false; // never empty a region
    const set = new Set(cells);
    const seen = new Set([cells[0]]);
    const stack = [cells[0]];
    while (stack.length) {
      const i = stack.pop();
      const r = Math.floor(i / n), c = i % n;
      for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
        const nr = r + dr, nc = c + dc;
        if (nr < 0 || nr >= n || nc < 0 || nc >= n) continue;
        const j = nr * n + nc;
        if (set.has(j) && !seen.has(j)) { seen.add(j); stack.push(j); }
      }
    }
    return seen.size === cells.length;
  }

  // ---- Step 3: hill-climbing repair toward a unique solution. ----
  function repairToUnique(n, region, solutionCols, rng, maxIters) {
    const solutionCells = new Set();
    for (let r = 0; r < n; r++) solutionCells.add(r * n + solutionCols[r]);
    let best = solveCount(n, region, 8).count;
    let iters = 0;
    const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    while (best > 1 && iters < maxIters) {
      iters++;
      // Random boundary cell (not a solution cell) → adopt a random neighbor's region.
      const candidates = [];
      for (let i = 0; i < n * n; i++) {
        if (solutionCells.has(i)) continue;
        const r = Math.floor(i / n), c = i % n;
        for (const [dr, dc] of dirs) {
          const nr = r + dr, nc = c + dc;
          if (nr < 0 || nr >= n || nc < 0 || nc >= n) continue;
          const other = region[nr * n + nc];
          if (other !== region[i]) candidates.push([i, other]);
        }
      }
      if (!candidates.length) break;
      const [cell, newReg] = candidates[Math.floor(rng() * candidates.length)];
      const oldReg = region[cell];
      if (!staysConnected(n, region, oldReg, cell)) continue;
      region[cell] = newReg;
      const cnt = solveCount(n, region, 8).count;
      if (cnt <= best && cnt >= 1) best = cnt; // accept: never worse, never zero
      else region[cell] = oldReg;              // revert
    }
    return best === 1;
  }

  /** Generate one puzzle. Returns {n, region, solution, difficulty} or null. */
  function generate(n, seedStr) {
    for (let attempt = 0; attempt < 20; attempt++) {
      const rng = makeRng(seedStr + '#' + attempt);
      const solution = generateSolution(n, rng);
      if (!solution) continue;
      const region = growRegions(n, solution, rng);
      if (!repairToUnique(n, region, solution, rng, 400 + n * n * 8)) continue;
      const { count, nodes } = solveCount(n, region, 2);
      if (count !== 1) continue;
      return { n, region, solution, difficulty: nodes };
    }
    return null;
  }

  /** Validate a full player grid (array of n cell indices, one per row) — used by tests. */
  function isSolution(n, region, cols) {
    const colSeen = new Set(), regSeen = new Set();
    for (let r = 0; r < n; r++) {
      const c = cols[r];
      if (c < 0 || c >= n || colSeen.has(c) || regSeen.has(region[r * n + c])) return false;
      if (r > 0 && Math.abs(c - cols[r - 1]) < 2) return false;
      colSeen.add(c); regSeen.add(region[r * n + c]);
    }
    return true;
  }

  const PPGen = { makeRng, shuffled, generate, solveCount, isSolution };
  if (typeof module !== 'undefined' && module.exports) module.exports = PPGen;
  global.PPGen = PPGen;
})(typeof window !== 'undefined' ? window : globalThis);
