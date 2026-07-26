// Puzzle Pet — Node tests for the speech pool.
// The important one is the denylist: "the pet never suffers" enforced as data.
const PPSpeech = require('../www/js/speech.js');

let failures = 0;
function check(cond, msg) {
  if (!cond) { failures++; console.error('FAIL:', msg); }
}

const MOODS = ['happy', 'content', 'missing'];

// --- Every line is well formed ---
PPSpeech.LINES.forEach((l, i) => {
  check(typeof l.text === 'string' && l.text.length > 0, `line ${i} has text`);
  check(Number.isInteger(l.minLevel) && l.minLevel >= 1, `line ${i} has a valid minLevel`);
  check(!l.mood || MOODS.indexOf(l.mood) !== -1, `line ${i} mood is a known mood`);
});

// --- No sad lines at any tier. This encodes a non-negotiable design rule. ---
// "missed you" is deliberately allowed; the missing-you mood requires it.
const DENY = ['sad', 'lonely', 'hungry', 'starv', 'sick', 'neglect', 'abandon',
              'cry', 'crying', 'upset', 'hurt', 'sorry', 'alone'];
PPSpeech.LINES.forEach((l, i) => {
  const lower = l.text.toLowerCase();
  DENY.forEach(word => {
    check(lower.indexOf(word) === -1, `line ${i} must not contain "${word}": ${l.text}`);
  });
});

// --- No combination of level and mood is starved ---
for (let level = 1; level <= 12; level++) {
  MOODS.forEach(mood => {
    const ctx = { name: 'Pip', mood, level, streak: 0, hour: 12, owned: 0, daysKnown: 0 };
    const line = PPSpeech.pick(ctx);
    check(typeof line === 'string' && line.length > 0,
      `pick returns a line for level ${level} / ${mood}`);
    check(line.indexOf('{name}') === -1, `pick substitutes {name} at level ${level} / ${mood}`);
  });
}

// --- Rich context also resolves ---
const rich = PPSpeech.pick({ name: 'Pip', mood: 'happy', level: 8, streak: 40,
                             hour: 21, owned: 5, daysKnown: 200 });
check(typeof rich === 'string' && rich.length > 0, 'pick handles a fully-populated context');

// --- Mood wins: a missing-you player only ever gets missing-you lines ---
for (let i = 0; i < 40; i++) {
  const line = PPSpeech.pick({ name: 'Pip', mood: 'missing', level: 8, streak: 10,
                               hour: 9, owned: 3, daysKnown: 60 });
  const source = PPSpeech.LINES.find(l => l.text.replace('{name}', 'Pip') === line);
  check(source && source.mood === 'missing', 'missing mood only yields missing lines');
}

// --- Level gates: a level 1 player never sees a high-tier line ---
for (let i = 0; i < 40; i++) {
  const line = PPSpeech.pick({ name: 'Pip', mood: 'content', level: 1, streak: 0,
                               hour: 12, owned: 0, daysKnown: 0 });
  const source = PPSpeech.LINES.find(l => l.text.replace('{name}', 'Pip') === line);
  check(source && source.minLevel === 1, 'level 1 only yields minLevel 1 lines');
}

if (failures) { console.error(`${failures} failure(s)`); process.exit(1); }
console.log(`speech tests: all passed (${PPSpeech.LINES.length} lines)`);
