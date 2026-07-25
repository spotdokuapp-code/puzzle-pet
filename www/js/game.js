/* Puzzle Pet — board play. Tap cycles empty → mark → piece → empty.
 * No fail state: conflicts highlight live, the puzzle never ends on you.
 * A "mistake" (for pet energy) = placing a piece that immediately conflicts. */
(function () {
  'use strict';

  const REGION_COLORS = [
    '#ffe3e3', '#dcedff', '#e2f6dc', '#fff3cf', '#f0e2ff',
    '#d9f4f0', '#ffe7d1', '#e8e8f8', '#f6ddef'
  ];

  let cur = null; // { puzzle, cells[], meta, onWin, onMistake, startTs, mistakes, hintsUsed }

  function conflicts(n, region, cells) {
    // Returns Set of cell indices (with pieces) that are in conflict.
    const bad = new Set();
    const pieces = [];
    for (let i = 0; i < n * n; i++) if (cells[i] === 2) pieces.push(i);
    for (let a = 0; a < pieces.length; a++) {
      for (let b = a + 1; b < pieces.length; b++) {
        const i = pieces[a], j = pieces[b];
        const r1 = Math.floor(i / n), c1 = i % n, r2 = Math.floor(j / n), c2 = j % n;
        if (r1 === r2 || c1 === c2 || region[i] === region[j] ||
            (Math.abs(r1 - r2) <= 1 && Math.abs(c1 - c2) <= 1)) {
          bad.add(i); bad.add(j);
        }
      }
    }
    return bad;
  }

  function isWin(n, region, cells) {
    const pieces = [];
    for (let i = 0; i < n * n; i++) if (cells[i] === 2) pieces.push(i);
    if (pieces.length !== n) return false;
    if (conflicts(n, region, cells).size) return false;
    const rows = new Set(), cols = new Set(), regs = new Set();
    for (const i of pieces) {
      rows.add(Math.floor(i / n)); cols.add(i % n); regs.add(region[i]);
    }
    return rows.size === n && cols.size === n && regs.size === n;
  }

  function render() {
    const { puzzle, cells } = cur;
    const n = puzzle.n;
    const board = document.getElementById('board');
    board.style.setProperty('--n', n);
    board.innerHTML = '';
    const bad = conflicts(n, puzzle.region, cells);
    for (let i = 0; i < n * n; i++) {
      const d = document.createElement('button');
      d.className = 'cell';
      d.dataset.i = i;
      d.style.background = REGION_COLORS[puzzle.region[i] % REGION_COLORS.length];
      const r = Math.floor(i / n), c = i % n;
      // Thick borders on region boundaries.
      if (c === 0 || puzzle.region[i] !== puzzle.region[i - 1]) d.classList.add('bl');
      if (c === n - 1 || puzzle.region[i] !== puzzle.region[i + 1]) d.classList.add('br');
      if (r === 0 || puzzle.region[i] !== puzzle.region[i - n]) d.classList.add('bt');
      if (r === n - 1 || puzzle.region[i] !== puzzle.region[i + n]) d.classList.add('bb');
      if (cells[i] === 1) { d.textContent = '·'; d.classList.add('mark'); }
      if (cells[i] === 2) { d.textContent = '★'; d.classList.add('piece'); }
      if (cells[i] === 2 && bad.has(i)) d.classList.add('error');
      d.addEventListener('click', () => tap(i));
      board.appendChild(d);
    }
  }

  function tap(i) {
    if (!cur) return;
    const { puzzle, cells } = cur;
    cells[i] = (cells[i] + 1) % 3;
    if (cells[i] === 2) {
      const bad = conflicts(puzzle.n, puzzle.region, cells);
      if (bad.has(i)) {
        cur.mistakes++;
        if (cur.onMistake) cur.onMistake();
      }
    }
    render();
    if (isWin(puzzle.n, puzzle.region, cells)) {
      const result = {
        ms: Date.now() - cur.startTs,
        mistakes: cur.mistakes,
        hintsUsed: cur.hintsUsed
      };
      const onWin = cur.onWin;
      cur = null;
      if (onWin) onWin(result);
    }
  }

  window.PPGame = {
    start(opts) {
      cur = {
        puzzle: opts.puzzle,
        cells: new Array(opts.puzzle.n * opts.puzzle.n).fill(0),
        meta: opts.meta || {},
        onWin: opts.onWin,
        onMistake: opts.onMistake,
        startTs: Date.now(),
        mistakes: 0,
        hintsUsed: 0
      };
      render();
    },
    clear() {
      if (!cur) return;
      cur.cells.fill(0);
      render();
    },
    hint() {
      if (!cur) return false;
      const { puzzle, cells } = cur;
      const n = puzzle.n;
      // Reveal one correct piece the player hasn't placed yet.
      for (let r = 0; r < n; r++) {
        const i = r * n + puzzle.solution[r];
        if (cells[i] !== 2) {
          cells[i] = 2;
          cur.hintsUsed++;
          render();
          if (isWin(n, puzzle.region, cells)) {
            const result = { ms: Date.now() - cur.startTs, mistakes: cur.mistakes, hintsUsed: cur.hintsUsed };
            const onWin = cur.onWin;
            cur = null;
            if (onWin) onWin(result);
          }
          return true;
        }
      }
      return false;
    },
    active() { return !!cur; },
    // Test hook: current puzzle + auto-solve.
    _debug() { return cur ? { puzzle: cur.puzzle, cells: cur.cells } : null; },
    _autosolve() {
      if (!cur) return;
      const { puzzle } = cur;
      for (let r = 0; r < puzzle.n; r++) cur.cells[r * puzzle.n + puzzle.solution[r]] = 2;
      const done = isWin(puzzle.n, puzzle.region, cur.cells);
      render();
      if (done) {
        const result = { ms: Date.now() - cur.startTs, mistakes: cur.mistakes, hintsUsed: cur.hintsUsed };
        const onWin = cur.onWin;
        cur = null;
        if (onWin) onWin(result);
      }
    }
  };
})();
