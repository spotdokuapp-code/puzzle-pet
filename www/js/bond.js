/* Puzzle Pet — the bond (care level) spine: XP, levels, daily gates, backfill.
 * Pure functions over (state, config). No DOM. Loads in Node for tests.
 * Non-negotiable: bond XP never decreases, and bond gates cosmetics only —
 * never a puzzle, the streak, coins, or energy. */
(function (global) {
  'use strict';

  // Looked up lazily so script/require order never matters.
  const C = () => global.PPConfig;

  // Cumulative XP required to reach `level`. Named tiers come from config;
  // past the last named tier each step grows by BOND_ENDLESS.stepGrowth forever.
  function thresholdFor(level) {
    const L = C().BOND_LEVELS;
    if (level <= L.length) return L[level - 1].xp;
    let xp = L[L.length - 1].xp;
    let step = L[L.length - 1].xp - L[L.length - 2].xp;
    for (let k = L.length + 1; k <= level; k++) {
      // Clamp to a minimum of 1 so the sequence is always strictly increasing,
      // even if a future stepGrowth tuning value would otherwise round step to 0
      // (which would make levelFor's while-loop never terminate).
      step = Math.max(1, Math.round(step * C().BOND_ENDLESS.stepGrowth));
      xp += step;
    }
    return xp;
  }

  // Level and progress for a given XP total.
  // `name` is null past the named tiers — callers show the number instead.
  function levelFor(xp) {
    const L = C().BOND_LEVELS;
    let level = 1;
    while (xp >= thresholdFor(level + 1)) level++;
    const base = thresholdFor(level);
    const next = thresholdFor(level + 1);
    return {
      level,
      name: level <= L.length ? L[level - 1].name : null,
      base,
      next,
      into: xp - base,
      needed: next - base
    };
  }

  // XP for one award. Returns 0 for anything unrecognised — never NaN or undefined,
  // because a bad value here would silently corrupt a player's saved total.
  function xpFor(source, opts) {
    const X = C().BOND_XP;
    const o = opts || {};
    switch (source) {
      case 'daily':    return X.dailySolve[o.slot] || 0;
      case 'setBonus': return X.setBonus;
      case 'freeplay': return X.freeplaySolve;
      case 'visit':    return X.visit;
      case 'pet':      return X.pet;
      case 'feed':     return X.feed[o.item] || 0;
      default:         return 0;
    }
  }

  const PPBond = { thresholdFor, levelFor, xpFor };
  if (typeof module !== 'undefined' && module.exports) module.exports = PPBond;
  global.PPBond = PPBond;
})(typeof window !== 'undefined' ? window : globalThis);
