/* Puzzle Pet — the leveling spine: XP curve to level 30, display ratchet,
 * XP sources, event-log backfill. Pure functions; no DOM; loads in Node.
 * Non-negotiables: XP never decreases; the DISPLAYED level never decreases
 * either (pet.levelHigh is the high-water mark, so a threshold retune during
 * tuning can never demote an existing player); levels gate cosmetics only. */
(function (global) {
  'use strict';

  // Looked up lazily so script/require order never matters.
  const C = () => global.PPConfig;

  const CAP_OF = () => C().LEVEL_XP.length + 1;

  // Cumulative XP required to reach `level`. L1 is free; above the cap is
  // unreachable by design — there is no endless tail in v2.
  function thresholdFor(level) {
    if (level <= 1) return 0;
    if (level > CAP_OF()) return Infinity;
    return C().LEVEL_XP[level - 2];
  }

  // Level and progress for a lifetime XP total.
  function levelForXp(xp) {
    const L = C().LEVEL_XP;
    let level = 1;
    while (level < CAP_OF() && xp >= L[level - 1]) level++;
    const atCap = level >= CAP_OF();
    const base = thresholdFor(level);
    return {
      level,
      base,
      next: atCap ? null : thresholdFor(level + 1),
      into: xp - base,
      needed: atCap ? null : thresholdFor(level + 1) - base,
      atCap
    };
  }

  // What the player is shown. levelHigh ratchets: once a level is reached it
  // is never displayed lower, even if LEVEL_XP is later tuned upward.
  function displayLevel(pet) {
    return Math.max(levelForXp(pet.xp || 0).level, pet.levelHigh || 1);
  }

  // XP for one award. Puzzle solves ONLY — feeding, petting and visiting are
  // interactions, not XP sources, in v2. Returns 0 for anything unrecognized,
  // never NaN, because a bad value would corrupt a player's lifetime total.
  function xpFor(source, opts) {
    const o = opts || {};
    switch (source) {
      case 'daily':    return C().XP_PAYOUTS[o.slot] || 0;
      case 'setBonus': return C().XP_SET_BONUS;
      case 'freeplay': return C().XP_FREEPLAY;
      default:         return 0;
    }
  }

  // Recomputes lifetime XP from history so an existing save arrives at the
  // level it already earned. Two sources: puzzle_solved events (per solve,
  // kind must be 'daily' or 'free'), and days[*].bonus (the set bonus was
  // never logged as an event, but the days map persists it). Deliberately
  // under-credits — the event log is capped at 5000 entries. Never hand a
  // player a level they didn't earn. Defensively handles non-arrays and
  // non-objects without throwing.
  function backfill(events, days) {
    let xp = 0;
    if (Array.isArray(events)) {
      events.forEach(e => {
        if (!e || e.type !== 'puzzle_solved') return;
        if (e.kind === 'daily') {
          xp += xpFor('daily', { slot: e.slot });
        } else if (e.kind === 'free') {
          xp += xpFor('freeplay');
        }
      });
    }
    const daysObj = (days && typeof days === 'object') ? days : {};
    Object.keys(daysObj).forEach(d => {
      if (daysObj[d] && daysObj[d].bonus) xp += xpFor('setBonus');
    });
    return xp;
  }

  const PPLevel = { get CAP() { return CAP_OF(); }, thresholdFor, levelForXp, displayLevel, xpFor, backfill };
  if (typeof module !== 'undefined' && module.exports) module.exports = PPLevel;
  global.PPLevel = PPLevel;
})(typeof window !== 'undefined' ? window : globalThis);
