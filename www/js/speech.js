/* Puzzle Pet — the pet's speech pool. Pure data plus one selector; no DOM.
 *
 * Two rules are encoded here rather than enforced by review:
 *   1. Mood wins — a returning player always gets a missing-you line first.
 *   2. No sad lines exist at any tier. The pet misses you; it never suffers.
 *
 * Every pet is "they". Lines must read naturally for a dino and an alien too.
 * Adding a line is a data edit — that is the point. */
(function (global) {
  'use strict';

  // minLevel gates when a line becomes eligible. The spec's "speech tiers"
  // are simply the levels at which new lines unlock: 1, 2, 3, 5, 8.
  const LINES = [
    // --- Tier 1: base pool. Every mood needs an untagged line here so no
    //     level/mood combination can ever be starved. ---
    { text: '{name} is happily pottering about.', minLevel: 1, mood: 'content' },
    { text: '{name} is watching the world go by.', minLevel: 1, mood: 'content' },
    { text: '{name} settles in beside you.', minLevel: 1, mood: 'content' },
    { text: '{name} is having a great day!', minLevel: 1, mood: 'happy' },
    { text: '{name} did a little spin.', minLevel: 1, mood: 'happy' },
    { text: '{name} missed you — so glad you\'re back! ✨', minLevel: 1, mood: 'missing' },
    { text: '{name} perks up the second they see you.', minLevel: 1, mood: 'missing' },

    // --- Tier 2 (level 2) ---
    { text: '{name} thinks you\'re rather good at this.', minLevel: 2, mood: 'happy' },
    { text: '{name} is keeping your seat warm.', minLevel: 2, mood: 'content' },
    { text: '{name} saved you the comfy spot.', minLevel: 2, mood: 'missing' },

    // --- Tier 3 (level 3): context-aware lines start here ---
    { text: '{name} counted every day of that streak.', minLevel: 3, streakMin: 3 },
    { text: 'Good morning! {name} was up first.', minLevel: 3, hourMax: 11 },
    { text: '{name} is winding down with you.', minLevel: 3, hourMin: 20 },
    { text: '{name} keeps nudging their favourite thing.', minLevel: 3, ownedMin: 2 },

    // --- Tier 4 (level 5) ---
    { text: '{name} has opinions about that last puzzle.', minLevel: 5, mood: 'happy' },
    { text: '{name} knows exactly how this goes now.', minLevel: 5, streakMin: 7 },
    { text: '{name} rearranged things while you were out.', minLevel: 5, ownedMin: 3 },
    { text: '{name} waited up.', minLevel: 5, mood: 'missing', hourMin: 20 },

    // --- Tier 5 (level 8): the long-history lines ---
    { text: 'You and {name} have been at this a while now.', minLevel: 8, daysKnownMin: 30 },
    { text: '{name} could probably solve it themselves by now.', minLevel: 8, streakMin: 14 },
    { text: '{name} has made this place properly theirs.', minLevel: 8, ownedMin: 4 },
    { text: '{name} kept the light on for you.', minLevel: 8, mood: 'missing' }
  ];

  function eligible(line, ctx) {
    if (line.minLevel > ctx.level) return false;
    // Mood wins: in the missing-you mood only missing-you lines are offered.
    if (ctx.mood === 'missing') {
      if (line.mood !== 'missing') return false;
    } else if (line.mood && line.mood !== ctx.mood) {
      return false;
    }
    if (line.streakMin !== undefined && (ctx.streak || 0) < line.streakMin) return false;
    if (line.hourMin !== undefined && (ctx.hour || 0) < line.hourMin) return false;
    if (line.hourMax !== undefined && (ctx.hour || 0) > line.hourMax) return false;
    if (line.ownedMin !== undefined && (ctx.owned || 0) < line.ownedMin) return false;
    if (line.daysKnownMin !== undefined && (ctx.daysKnown || 0) < line.daysKnownMin) return false;
    return true;
  }

  let lastText = null;

  function pick(ctx) {
    let pool = LINES.filter(l => eligible(l, ctx));
    // Avoid an immediate repeat, but never at the cost of returning nothing.
    if (pool.length > 1) {
      const fresh = pool.filter(l => l.text !== lastText);
      if (fresh.length) pool = fresh;
    }
    const chosen = pool[Math.floor(Math.random() * pool.length)];
    lastText = chosen.text;
    return chosen.text.replace('{name}', ctx.name);
  }

  const PPSpeech = { LINES, pick };
  if (typeof module !== 'undefined' && module.exports) module.exports = PPSpeech;
  global.PPSpeech = PPSpeech;
})(typeof window !== 'undefined' ? window : globalThis);
