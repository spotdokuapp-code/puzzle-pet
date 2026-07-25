/* Puzzle Pet — original hand-built SVG creatures, 64×64 viewBox, shared cartoon style.
 * Moods: 'happy' (big smile), 'content' (soft smile), 'missing' (hopeful sparkle —
 * the pet misses you, it never suffers). */
(function () {
  'use strict';

  const PALETTE = {
    dog:   { body: '#e8b26a', belly: '#f7dcae', accent: '#b07c3c' },
    cat:   { body: '#9aa7c7', belly: '#d5dcee', accent: '#6b7699' },
    bunny: { body: '#f2e6da', belly: '#fdf7f0', accent: '#d9a5a5' },
    fox:   { body: '#e78a4e', belly: '#fbe9d8', accent: '#b25f2a' },
    dino:  { body: '#8cc084', belly: '#d6ecc9', accent: '#5d9455' },
    alien: { body: '#b58fd6', belly: '#e3d3f2', accent: '#8a63ad' }
  };

  function face(mood) {
    const eyes =
      '<circle cx="26" cy="34" r="2.6" fill="#3a2e28"/><circle cx="38" cy="34" r="2.6" fill="#3a2e28"/>' +
      '<circle cx="26.9" cy="33.1" r="0.9" fill="#fff"/><circle cx="38.9" cy="33.1" r="0.9" fill="#fff"/>';
    if (mood === 'happy') {
      return eyes +
        '<path d="M27 41 q5 5 10 0" stroke="#3a2e28" stroke-width="2" fill="none" stroke-linecap="round"/>' +
        '<ellipse cx="20" cy="39" rx="3" ry="2" fill="#f2a6a6" opacity="0.7"/>' +
        '<ellipse cx="44" cy="39" rx="3" ry="2" fill="#f2a6a6" opacity="0.7"/>';
    }
    if (mood === 'missing') { // wide hopeful eyes, gentle smile, a little sparkle of excitement
      return eyes +
        '<path d="M29 41.5 q3 2.5 6 0" stroke="#3a2e28" stroke-width="2" fill="none" stroke-linecap="round"/>' +
        '<path d="M47 24 l1.2 2.6 2.6 1.2 -2.6 1.2 -1.2 2.6 -1.2 -2.6 -2.6 -1.2 2.6 -1.2 z" fill="#ffd76a"/>';
    }
    return eyes + // content
      '<path d="M28 41 q4 3 8 0" stroke="#3a2e28" stroke-width="2" fill="none" stroke-linecap="round"/>';
  }

  // back = drawn behind the body (ears, spikes, antennae); front = on top (noses, whiskers)
  const FEATURES = {
    dog: {
      back: p => `<ellipse cx="14" cy="26" rx="5" ry="9" fill="${p.accent}" transform="rotate(18 14 26)"/>` +
                 `<ellipse cx="50" cy="26" rx="5" ry="9" fill="${p.accent}" transform="rotate(-18 50 26)"/>`,
      front: () => '<ellipse cx="32" cy="38.5" rx="3" ry="2.2" fill="#3a2e28"/>'
    },
    cat: {
      back: p => `<path d="M16 26 L19 12 L28 22 Z" fill="${p.body}"/><path d="M48 26 L45 12 L36 22 Z" fill="${p.body}"/>` +
                 `<path d="M19.5 23 L20.8 16.5 L25 21 Z" fill="${p.accent}"/><path d="M44.5 23 L43.2 16.5 L39 21 Z" fill="${p.accent}"/>`,
      front: () => '<path d="M30.5 38 h3 l-1.5 1.8 z" fill="#3a2e28"/>' +
                   '<path d="M18 38 h-7 M18 41 h-6" stroke="#3a2e28" stroke-width="1" opacity="0.5"/>' +
                   '<path d="M46 38 h7 M46 41 h6" stroke="#3a2e28" stroke-width="1" opacity="0.5"/>'
    },
    bunny: {
      back: p => `<ellipse cx="24" cy="13" rx="4.5" ry="11" fill="${p.body}"/><ellipse cx="40" cy="13" rx="4.5" ry="11" fill="${p.body}"/>` +
                 `<ellipse cx="24" cy="14" rx="2.2" ry="7.5" fill="${p.accent}"/><ellipse cx="40" cy="14" rx="2.2" ry="7.5" fill="${p.accent}"/>`,
      front: p => `<path d="M30.8 38 h2.4 l-1.2 1.5 z" fill="${p.accent}"/>`
    },
    fox: {
      back: p => `<path d="M14 28 L16 12 L28 21 Z" fill="${p.body}"/><path d="M50 28 L48 12 L36 21 Z" fill="${p.body}"/>` +
                 '<path d="M17.5 24.5 L18.5 16.5 L25 21.5 Z" fill="#4a3428"/><path d="M46.5 24.5 L45.5 16.5 L39 21.5 Z" fill="#4a3428"/>',
      front: () => '<ellipse cx="32" cy="38.5" rx="2.6" ry="2" fill="#4a3428"/>'
    },
    dino: {
      back: p => `<path d="M24 22 l4 -7 4 7 z" fill="${p.accent}"/><path d="M32 20 l4 -8 4 8 z" fill="${p.accent}"/><path d="M40 22 l4 -6 3.5 6 z" fill="${p.accent}"/>`,
      front: p => `<circle cx="20" cy="46" r="2" fill="${p.accent}" opacity="0.5"/><circle cx="45" cy="43" r="1.6" fill="${p.accent}" opacity="0.5"/>` +
                  '<ellipse cx="30" cy="38.8" rx="1.2" ry="0.9" fill="#3a2e28" opacity="0.8"/><ellipse cx="34" cy="38.8" rx="1.2" ry="0.9" fill="#3a2e28" opacity="0.8"/>'
    },
    alien: {
      back: p => `<line x1="26" y1="21" x2="23" y2="10" stroke="${p.body}" stroke-width="2.5" stroke-linecap="round"/>` +
                 `<line x1="38" y1="21" x2="41" y2="10" stroke="${p.body}" stroke-width="2.5" stroke-linecap="round"/>` +
                 `<circle cx="23" cy="9" r="3.2" fill="${p.accent}"/><circle cx="41" cy="9" r="3.2" fill="${p.accent}"/>` +
                 '<circle cx="23" cy="9" r="1.2" fill="#ffd76a"/><circle cx="41" cy="9" r="1.2" fill="#ffd76a"/>',
      front: () => ''
    }
  };

  window.PPSprites = {
    svg(species, mood, size) {
      const p = PALETTE[species] || PALETTE.dog;
      const f = FEATURES[species] || FEATURES.dog;
      const s = size || 64;
      return `<svg width="${s}" height="${s}" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${species}">` +
        f.back(p) +
        `<ellipse cx="32" cy="38" rx="20" ry="18" fill="${p.body}"/>` +
        `<ellipse cx="32" cy="44" rx="12" ry="9" fill="${p.belly}"/>` +
        f.front(p) +
        face(mood || 'content') +
        '</svg>';
    }
  };
})();
