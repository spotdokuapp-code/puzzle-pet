/* Puzzle Pet — app shell: screens, daily loop, calendar, pet room, economy.
 * Emotional rules (non-negotiable): the pet misses you, it never suffers.
 * Pause-don't-decay; back-fill restores anything missed; opener alone keeps the streak. */
(function () {
  'use strict';
  const C = window.PPConfig;
  let S = PPStore.load();

  // ---------- helpers ----------
  const $ = id => document.getElementById(id);
  const save = () => PPStore.save(S);
  const log = (type, data) => PPStore.log(S, type, data);

  function addDays(dateStr, delta) {
    const [y, m, d] = dateStr.split('-').map(Number);
    const dt = new Date(y, m - 1, d + delta);
    return PPStore.today(dt);
  }
  function ensureDay(dateStr) {
    if (!S.days[dateStr]) S.days[dateStr] = { slots: [false, false, false], bonus: false };
    return S.days[dateStr];
  }
  function slotsDone(dateStr) {
    const d = S.days[dateStr];
    return d ? d.slots.filter(Boolean).length : 0;
  }
  function streak() {
    const today = PPStore.today();
    let day = (S.days[today] && S.days[today].slots[0]) ? today : addDays(today, -1);
    let count = 0;
    while (S.days[day] && S.days[day].slots[0]) { count++; day = addDays(day, -1); }
    return count;
  }
  function toast(msg, ms) {
    const t = $('toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => t.classList.remove('show'), ms || 2200);
  }
  function show(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    $(screenId).classList.add('active');
  }
  function overlay(id, on) { $(id).classList.toggle('show', !!on); }

  // ---------- energy ----------
  function applyRegen() {
    const now = Date.now();
    const gained = Math.floor((now - S.pet.energyTs) / C.ENERGY_REGEN_MS);
    if (gained > 0) {
      S.pet.energy = Math.min(C.ENERGY_MAX, S.pet.energy + gained);
      S.pet.energyTs += gained * C.ENERGY_REGEN_MS;
      if (S.pet.energy >= C.ENERGY_MAX) S.pet.energyTs = now;
      save();
    }
  }
  function drainEnergy(amount) {
    applyRegen();
    const was = S.pet.energy;
    S.pet.energy = Math.max(0, S.pet.energy - amount);
    if (was >= C.ENERGY_MAX) S.pet.energyTs = Date.now();
    save();
    if (S.pet.energy === 0 && was > 0) {
      toast(`${S.pet.name} is getting sleepy… finish up, then a rest! 😴`);
    }
  }
  function restoreEnergy() {
    S.pet.energy = C.ENERGY_MAX;
    S.pet.energyTs = Date.now();
    save();
  }

  // ---------- mood (never sad, never suffering) ----------
  function mood() {
    const today = PPStore.today();
    if (S.lastActiveDay && S.lastActiveDay < addDays(today, -1) ) return 'missing';
    if (S.pet.energy > 60 && slotsDone(today) > 0) return 'happy';
    return 'content';
  }
  function moodText() {
    return PPSpeech.pick(speechCtx());
  }
  // Everything the speech pool needs to choose a line.
  function speechCtx() {
    const created = S.createdDay || PPStore.today();
    const daysKnown = Math.max(0,
      Math.round((new Date(PPStore.today()) - new Date(created)) / 86400000));
    return {
      name: S.pet.name,
      mood: mood(),
      level: PPLevel.displayLevel(S.pet),
      streak: streak(),
      hour: new Date().getHours(),
      owned: Object.keys(S.owned).length,
      daysKnown
    };
  }
  // The only place XP enters the game. Puzzle solves only — feeding, petting
  // and visiting are interactions, not XP sources. Returns the XP gained so
  // the win overlay can show it. Ratchet: levelHigh only ever rises.
  function awardXp(source, opts) {
    const gained = PPLevel.xpFor(source, opts);
    if (!gained) return 0;
    const before = PPLevel.displayLevel(S.pet);
    S.pet.xp += gained;
    const after = PPLevel.displayLevel(S.pet);
    if (after > before) {
      S.pet.levelHigh = after;
      log('level_up', { level: after });
      // Queued, not shown: the overlay appears after the win overlay's
      // Continue and after any interstitial. Crossing two thresholds before
      // it shows merges into one overlay (lowest from, highest to).
      pendingLevelUp = { from: pendingLevelUp ? pendingLevelUp.from : before, to: after };
      grantSpeciesUnlocks();
    }
    save();
    return gained;
  }

  // Species reveals are earned by level, and a migrated or ratcheted save
  // may already be past a milestone. Log each species_unlocked exactly once;
  // availability itself is derived, so this is the event-log record, not a
  // gate. Quiet by design — the roster appears in Your friends.
  function grantSpeciesUnlocks() {
    if (!S.pet.species) return;
    const have = new Set(S.events.filter(e => e.type === 'species_unlocked').map(e => e.species));
    const lv = PPLevel.displayLevel(S.pet);
    Object.keys(C.SPECIES_UNLOCKS).forEach(sp => {
      if (lv >= C.SPECIES_UNLOCKS[sp] && !have.has(sp)) {
        log('species_unlocked', { species: sp, level: C.SPECIES_UNLOCKS[sp] });
      }
    });
  }

  // Everything a crossing unlocks. The friend leads (spec §7), then areas,
  // then items the player doesn't own. Locked content never appears early.
  function unlocksFor(from, to) {
    const lines = [];
    let newArea = null;
    let newSpecies = null;
    Object.keys(C.SPECIES_UNLOCKS).forEach(sp => {
      const lv = C.SPECIES_UNLOCKS[sp];
      if (lv > from && lv <= to && sp !== S.pet.species) {
        lines.push(`🐾 ${C.DEFAULT_NAMES[sp]} the ${sp} would love to move in! You can invite them anytime.`);
        newSpecies = sp;
      }
    });
    C.AREAS.filter(a => a.id !== 'main' && a.level > from && a.level <= to).forEach(a => {
      lines.push(`🏡 ${a.name}`);
      newArea = a.id;
    });
    C.PERMANENTS
      .filter(p => p.level > from && p.level <= to && !S.owned[p.id])
      .forEach(p => lines.push(`${p.emoji} ${p.name}`));
    return { lines, newArea, newSpecies };
  }

  function maybeLevelUpOverlay() {
    if (!pendingLevelUp) return;
    const p = pendingLevelUp;
    pendingLevelUp = null;
    $('levelup-title').textContent = `${S.pet.name} grew to Level ${p.to}!`;
    $('levelup-sprite').innerHTML = PPSprites.svg(S.pet.species, 'happy', 96);
    const u = unlocksFor(p.from, p.to);
    $('levelup-list').innerHTML = u.lines.length
      ? u.lines.map(s => `<div class="unlock-row">${s}</div>`).join('')
      : '<div class="unlock-row">💛 Growing stronger together</div>';
    const cta = $('levelup-cta');
    cta.textContent = u.newSpecies ? 'Meet them'
      : (u.newArea ? 'Visit the room' : (u.lines.length ? 'See the shop' : 'Continue'));
    cta.dataset.dest = u.newSpecies ? 'friends'
      : (u.newArea ? 'room' : (u.lines.length ? 'shop' : 'stay'));
    cta.dataset.area = u.newArea || '';
    overlay('overlay-levelup', true);
    const sp = $('levelup-sprite');
    sp.classList.remove('bounce'); void sp.offsetWidth; sp.classList.add('bounce');
  }

  $('levelup-cta').addEventListener('click', () => {
    overlay('overlay-levelup', false);
    const cta = $('levelup-cta');
    if (cta.dataset.dest === 'stay') return;
    if (cta.dataset.dest === 'friends') { openFriends(); return; }
    petReturnTo = document.querySelector('.screen.active').id;
    renderPet();
    show('screen-pet');
    if (cta.dataset.dest === 'room' && cta.dataset.area) {
      const panel = $(`area-${cta.dataset.area}`);
      if (panel) {
        // block: 'nearest' keeps the scroll inside the strip — without it,
        // 'start' (the default) scrolls the whole DOCUMENT too, and the
        // back button can end up above the viewport.
        panel.scrollIntoView({ behavior: 'smooth', inline: 'start', block: 'nearest' });
        panel.classList.add('sparkle');
        setTimeout(() => panel.classList.remove('sparkle'), 1300);
      }
    }
  });

  function touch() {
    S.lastActiveDay = PPStore.today();
    save();
  }

  // ---------- ads (dev stubs behind one interface; real SDK drops in here) ----------
  const PPAds = {
    show(kind, cb) {
      $('ad-note').textContent = kind === 'rewarded' ? 'rewarded ad — dev stub' : 'ad break — dev stub';
      const closeBtn = $('ad-close');
      closeBtn.disabled = true;
      overlay('overlay-ad', true);
      setTimeout(() => { closeBtn.disabled = false; }, kind === 'rewarded' ? 1500 : 900);
      closeBtn.onclick = () => { overlay('overlay-ad', false); cb(true); };
    },
    maybeInterstitial(cb) {
      if (S.removeAds || S.solves === 0 || S.solves % C.INTERSTITIAL_EVERY !== 0) { cb(); return; }
      PPAds.show('interstitial', cb);
    }
  };

  // ---------- home ----------
  function renderHome() {
    $('chip-coins').textContent = `🪙 ${S.coins}`;
    $('chip-streak').textContent = `🔥 ${streak()}`;
    renderLevel();
    $('home-pet-sprite').innerHTML = PPSprites.svg(S.pet.species, mood(), 72);
    $('home-pet-name').textContent = S.pet.name;
    $('home-pet-mood').textContent = moodText();
    renderEnergy('home-energy-fill', 'home-energy-label');

    const today = PPStore.today();
    const day = S.days[today] || { slots: [false, false, false], bonus: false };
    const wrap = $('daily-slots');
    wrap.innerHTML = '';
    C.DAILY_LABELS.forEach((label, i) => {
      const done = day.slots[i];
      const locked = i > 0 && !day.slots[i - 1] && !done;
      const b = document.createElement('button');
      b.className = 'slot' + (done ? ' done' : '') + (locked ? ' locked' : '');
      b.id = `slot-${i}`;
      b.innerHTML =
        `<span>${done ? '✅' : locked ? '🔒' : '⭐'} ${label} <span class="meta">${C.DAILY_SIZES[i]}×${C.DAILY_SIZES[i]}</span></span>` +
        `<span class="reward">${done ? 'done' : '+' + C.DAILY_PAYOUTS[i] + ' 🪙'}</span>`;
      if (!done && !locked) b.addEventListener('click', () => startDaily(today, i, 'screen-home'));
      wrap.appendChild(b);
    });
    const bonusLine = $('set-bonus-line');
    if (day.bonus) {
      bonusLine.textContent = `Set bonus earned! +${C.DAILY_SET_BONUS} 🪙 ✨`;
      bonusLine.className = 'set-bonus earned';
    } else {
      bonusLine.textContent = `Finish all three → +${C.DAILY_SET_BONUS} 🪙 bonus`;
      bonusLine.className = 'set-bonus';
    }
  }
  function renderEnergy(fillId, labelId) {
    applyRegen();
    const pct = Math.round(100 * S.pet.energy / C.ENERGY_MAX);
    $(fillId).style.width = pct + '%';
    $(labelId).textContent = `Energy ${S.pet.energy}/${C.ENERGY_MAX}` +
      (S.pet.energy < C.ENERGY_MAX ? ' · resting slowly recharges it' : '');
  }

  // ---------- game ----------
  let gameCtx = null; // { kind:'daily'|'free', date, slot, returnTo }

  function startDaily(dateStr, slot, returnTo) {
    applyRegen();
    if (S.pet.energy <= 0) { pendingStart = () => startDaily(dateStr, slot, returnTo); openEnergyModal(); return; }
    const puzzle = PPDaily.get(dateStr, slot);
    if (!puzzle) { toast('Hmm, that puzzle got stuck — try again!'); return; }
    gameCtx = { kind: 'daily', date: dateStr, slot, returnTo };
    const today = PPStore.today();
    const dayName = dateStr === today ? 'Today' : dateStr;
    $('game-title').textContent = `${dayName} · ${C.DAILY_LABELS[slot]} ${puzzle.n}×${puzzle.n}`;
    beginPuzzle(puzzle);
  }
  function startFreeplay() {
    applyRegen();
    if (S.pet.energy <= 0) { pendingStart = startFreeplay; openEnergyModal(); return; }
    const puzzle = PPDaily.freeplay(S.solves);
    if (!puzzle) { toast('Hmm, that puzzle got stuck — try again!'); return; }
    gameCtx = { kind: 'free', returnTo: 'screen-home' };
    $('game-title').textContent = `Free play · ${puzzle.n}×${puzzle.n}`;
    beginPuzzle(puzzle);
  }
  function beginPuzzle(puzzle) {
    show('screen-game');
    updateGameEnergyChip();
    PPGame.start({
      puzzle,
      onMistake() {
        drainEnergy(C.ENERGY_PER_MISTAKE);
        updateGameEnergyChip();
      },
      onWin(result) { onPuzzleWin(result); }
    });
  }
  function updateGameEnergyChip() {
    $('game-energy').textContent = `⚡ ${S.pet.energy}`;
  }

  function onPuzzleWin(result) {
    let earned = 0;
    let gainedXp = 0;
    let sub = '';
    if (gameCtx.kind === 'daily') {
      const day = ensureDay(gameCtx.date);
      if (!day.slots[gameCtx.slot]) {
        day.slots[gameCtx.slot] = true;
        earned += C.DAILY_PAYOUTS[gameCtx.slot];
        gainedXp += awardXp('daily', { slot: gameCtx.slot });
        if (day.slots.every(Boolean) && !day.bonus) {
          day.bonus = true;
          earned += C.DAILY_SET_BONUS;
          gainedXp += awardXp('setBonus');
          sub = `Whole set finished — +${C.DAILY_SET_BONUS} 🪙 bonus! ${S.pet.name} is thrilled.`;
        } else if (gameCtx.slot === 0) {
          sub = `Streak safe! ${S.pet.name}'s day is made. 💛`;
        }
      }
      log('puzzle_solved', {
        kind: 'daily', date: gameCtx.date, slot: gameCtx.slot,
        ms: result.ms, mistakes: result.mistakes, hints: result.hintsUsed, coins: earned, xp: gainedXp
      });
    } else {
      earned = C.FREEPLAY_PAYOUT;
      gainedXp = awardXp('freeplay');
      log('puzzle_solved', { kind: 'free', ms: result.ms, mistakes: result.mistakes, hints: result.hintsUsed, coins: earned, xp: gainedXp });
    }
    S.coins += earned;
    S.solves++;
    touch();
    save();
    $('win-emoji').textContent = ['🎉', '🌟', '🥳', '💫'][S.solves % 4];
    $('win-title').textContent = 'Solved!';
    $('win-coins').textContent = earned > 0 ? `+${earned} 🪙` : 'Nice one!';
    $('win-sub').textContent = sub;

    const info = PPLevel.levelForXp(S.pet.xp);
    const gx = $('win-xp');
    if (gainedXp > 0) {
      gx.style.display = '';
      $('win-xp-gain').textContent = `+${gainedXp} ✦`;
      const fill = $('win-xp-fill');
      const prev = PPLevel.levelForXp(S.pet.xp - gainedXp);
      // Start the bar where it was before this solve, then animate to now.
      // A crossed threshold or the cap just reads as a full bar.
      fill.style.transition = 'none';
      fill.style.width = prev.atCap ? '100%'
        : `${Math.round(100 * Math.max(0, prev.into) / prev.needed)}%`;
      void fill.offsetWidth;
      fill.style.transition = '';
      fill.style.width = info.atCap || info.level > prev.level ? '100%'
        : `${Math.round(100 * info.into / info.needed)}%`;
    } else {
      gx.style.display = 'none';   // replayed slot: no XP, no bar
    }

    overlay('overlay-win', true);
  }

  $('win-continue').addEventListener('click', () => {
    overlay('overlay-win', false);
    PPAds.maybeInterstitial(() => {
      const dest = (gameCtx && gameCtx.returnTo) || 'screen-home';
      gameCtx = null;
      if (dest === 'screen-calendar') renderCalendar();
      renderHome();
      show(dest);
      maybeLevelUpOverlay();
    });
  });
  $('game-back').addEventListener('click', () => {
    const dest = (gameCtx && gameCtx.returnTo) || 'screen-home';
    gameCtx = null;
    renderHome();
    if (dest === 'screen-calendar') renderCalendar();
    show(dest);
  });
  $('btn-clear').addEventListener('click', () => PPGame.clear());
  $('btn-hint').addEventListener('click', () => { if (!PPGame.hint()) toast('All the stars are placed!'); });

  // ---------- energy modal ----------
  let pendingStart = null;
  function openEnergyModal() {
    $('energy-sub').textContent = `${S.pet.name} is out of energy. How about a pick-me-up?`;
    $('energy-snack').textContent = `Share a snack · ${C.ENERGY_RESTORE_COINS} 🪙`;
    overlay('overlay-energy', true);
  }
  $('energy-ad').addEventListener('click', () => {
    overlay('overlay-energy', false);
    PPAds.show('rewarded', ok => {
      if (ok) {
        restoreEnergy();
        log('energy_restore', { via: 'ad' });
        toast(`${S.pet.name} feels great! ⚡`);
        renderHome();
        if (pendingStart) { const f = pendingStart; pendingStart = null; f(); }
      }
    });
  });
  $('energy-snack').addEventListener('click', () => {
    if (S.coins < C.ENERGY_RESTORE_COINS) { toast('Not quite enough coins — try a puzzle or a short ad!'); return; }
    S.coins -= C.ENERGY_RESTORE_COINS;
    restoreEnergy();
    log('energy_restore', { via: 'coins', cost: C.ENERGY_RESTORE_COINS });
    overlay('overlay-energy', false);
    toast(`${S.pet.name} munches happily! ⚡`);
    renderHome();
    if (pendingStart) { const f = pendingStart; pendingStart = null; f(); }
  });
  $('energy-wait', ).addEventListener('click', () => {
    overlay('overlay-energy', false);
    pendingStart = null;
    toast(`${S.pet.name} curls up for a nap. Energy returns on its own. 💤`);
  });

  // ---------- calendar ----------
  let calY, calM; // displayed month
  function renderCalendar() {
    const today = PPStore.today();
    if (calY === undefined) { const t = new Date(); calY = t.getFullYear(); calM = t.getMonth(); }
    $('chip-streak-cal').textContent = `🔥 ${streak()}`;
    $('cal-month').textContent = new Date(calY, calM, 1)
      .toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    const grid = $('cal-grid');
    grid.innerHTML = '';
    ['S', 'M', 'T', 'W', 'T', 'F', 'S'].forEach(d => {
      const el = document.createElement('div');
      el.className = 'cal-dow'; el.textContent = d;
      grid.appendChild(el);
    });
    const first = new Date(calY, calM, 1);
    for (let i = 0; i < first.getDay(); i++) grid.appendChild(document.createElement('div'));
    const daysInMonth = new Date(calY, calM + 1, 0).getDate();
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = PPStore.today(new Date(calY, calM, d));
      const btn = document.createElement('button');
      const n = slotsDone(dateStr);
      btn.className = 'cal-day' + (dateStr === today ? ' today' : '') + (n === 3 ? ' full' : '');
      btn.innerHTML = `<span>${d}</span><span class="cal-dots">` +
        [0, 1, 2].map(i => `<i class="${i < n ? 'on' : ''}"></i>`).join('') + '</span>';
      const playable = dateStr <= today && dateStr >= S.createdDay;
      btn.disabled = !playable;
      if (playable) btn.addEventListener('click', () => {
        const day = S.days[dateStr];
        const next = day ? day.slots.findIndex(x => !x) : 0;
        if (next === -1) { toast('That day is complete! ✨'); return; }
        startDaily(dateStr, next, 'screen-calendar');
      });
      grid.appendChild(btn);
    }
  }
  $('btn-calendar').addEventListener('click', () => { const t = new Date(); calY = t.getFullYear(); calM = t.getMonth(); renderCalendar(); show('screen-calendar'); });
  $('cal-back').addEventListener('click', () => { renderHome(); show('screen-home'); });
  $('cal-prev').addEventListener('click', () => { calM--; if (calM < 0) { calM = 11; calY--; } renderCalendar(); });
  $('cal-next').addEventListener('click', () => { calM++; if (calM > 11) { calM = 0; calY++; } renderCalendar(); });

  // ---------- pet room ----------
  function renderLevel() {
    const lv = PPLevel.displayLevel(S.pet);
    const info = PPLevel.levelForXp(S.pet.xp);
    $('chip-level').textContent = `Lv ${lv}`;
    $('level-num').textContent = `Lv ${lv}`;
    $('level-total').textContent = `${S.pet.xp} ✦`;
    // Ratcheted above the derived level (post-retune) or at the cap: full bar.
    const pct = (info.atCap || lv > info.level) ? 100
      : Math.round(100 * info.into / info.needed);
    $('level-fill').style.width = `${pct}%`;
    $('home-level-fill').style.width = `${pct}%`;
    $('level-label').textContent = info.atCap
      ? `Level ${PPLevel.CAP} — what a journey ✦`
      : (lv > info.level ? `${S.pet.xp} ✦ and counting`
                         : `${info.into} / ${info.needed} ✦ to Lv ${info.level + 1}`);
  }
  function renderPet(bounce) {
    $('chip-coins-pet').textContent = `🪙 ${S.coins}`;
    const lvNow = PPLevel.displayLevel(S.pet);
    const strip = $('scene-strip');
    // Build one panel per UNLOCKED area; locked areas do not exist in the
    // DOM at all — no doors, no silhouettes. Main's panel is static.
    // scene-strip's scrollLeft survives this remove/re-append only because
    // no layout flush happens in between — do not insert measurements
    // (getBoundingClientRect/offsetWidth) here, or the scroll position resets.
    strip.querySelectorAll('.area:not(.area-main)').forEach(e => e.remove());
    C.AREAS.filter(a => a.id !== 'main' && a.level <= lvNow).forEach(a => {
      const panel = document.createElement('div');
      panel.className = `area area-${a.id}`;
      panel.id = `area-${a.id}`;
      const label = document.createElement('div');
      label.className = 'area-label';
      label.textContent = a.name;
      panel.appendChild(label);
      strip.appendChild(panel);
    });
    strip.querySelectorAll('.deco').forEach(e => e.remove());
    Object.keys(S.owned).forEach(id => {
      const item = C.PERMANENTS.find(p => p.id === id);
      if (!item) return;
      // Owned is never hidden: if the item's panel is missing (corrupt
      // save), it falls back to the main panel rather than vanishing.
      const host = $(`area-${item.area}`) || $('area-main');
      const spots = C.DECO_SPOTS[item.area] || {};
      const el = document.createElement('div');
      el.className = 'deco';
      el.style.cssText = spots[id] || 'left:20%; bottom:10px;';
      el.textContent = item.emoji;
      host.appendChild(el);
    });
    const spriteEl = $('pet-sprite');
    spriteEl.innerHTML = PPSprites.svg(S.pet.species, mood(), 110);
    spriteEl.onclick = () => {
      const today = PPStore.today();
      if (S.pet.petsLoggedDay !== today) {
        S.pet.petsLoggedDay = today;
        log('petted', {});   // once per day — the interaction itself stays unlimited
      }
      renderPet(true);   // still responds, still speaks — only the XP is gone
    };
    if (bounce) { spriteEl.classList.remove('bounce'); void spriteEl.offsetWidth; spriteEl.classList.add('bounce'); }
    $('pet-speech').textContent = moodText();
    $('pet-title').textContent = `${S.pet.name} the ${S.pet.species} · Lv ${lvNow}`;
    renderLevel();
    renderEnergy('pet-energy-fill', 'pet-energy-label');

    const cr = $('consumables-row');
    cr.innerHTML = '';
    C.CONSUMABLES.forEach(item => {
      const b = document.createElement('button');
      b.className = 'item-btn';
      b.id = `buy-${item.id}`;
      b.innerHTML = `<span class="em">${item.emoji}</span><span class="nm">${item.name}</span><span class="pr">${item.price} 🪙</span>`;
      b.disabled = S.coins < item.price;
      b.addEventListener('click', () => {
        S.coins -= item.price;
        applyRegen();
        S.pet.energy = Math.min(C.ENERGY_MAX, S.pet.energy + item.energy);
        touch();
        log('feed', { item: item.id, cost: item.price, energy: item.energy });
        toast(`${S.pet.name} loves it! +${item.energy} ⚡`);
        renderPet(true);
      });
      cr.appendChild(b);
    });

    const pr = $('permanents-row');
    pr.innerHTML = '';
    const unlockedAreas = C.AREAS.filter(a => a.level <= lvNow).map(a => a.id);
    // Owned is never hidden — in the shop or the room: a (corrupt-save or
    // future-config-raise) owned item whose area isn't unlocked yet still
    // gets a shop row, falling through the area-unlock filter below.
    const inUnlocked = C.PERMANENTS.filter(p => unlockedAreas.includes(p.area) || S.owned[p.id]);
    // Owned is never hidden; otherwise an item shows once its level is
    // reached (its area is unlocked by then — catalog invariant, tested).
    const visible = inUnlocked.filter(p => p.level <= lvNow || S.owned[p.id]);
    const nextLocked = inUnlocked.filter(p => p.level > lvNow && !S.owned[p.id]);
    const nextLevel = nextLocked.length ? nextLocked[0].level : null;
    const teaseInRange = nextLevel !== null && (nextLevel - lvNow) <= C.SHOP_TEASE_RANGE;
    const teased = teaseInRange ? nextLocked.filter(p => p.level === nextLevel) : [];
    const grouping = unlockedAreas.length >= 2;

    const renderRow = (item, locked) => {
      const owned = !!S.owned[item.id];
      const b = document.createElement('button');
      b.id = `shop-${item.id}`;
      if (locked) {
        b.className = 'item-btn locked';
        b.disabled = true;
        b.innerHTML = `<span class="em">${item.emoji}</span><span class="nm">${item.name}</span>` +
          `<span class="pr">Unlocks at Lv ${item.level} ✨</span>`;
      } else {
        b.className = 'item-btn' + (owned ? ' owned' : '');
        b.innerHTML = `<span class="em">${item.emoji}</span><span class="nm">${item.name}</span>` +
          `<span class="pr">${owned ? 'in room ✓' : item.price + ' 🪙'}</span>`;
        b.disabled = owned || S.coins < item.price;
        if (!owned) b.addEventListener('click', () => {
          S.coins -= item.price;
          S.owned[item.id] = true;
          touch();
          log('buy_permanent', { item: item.id, cost: item.price });
          toast(`${item.name} added to the room! ${item.emoji}`);
          renderPet(true);
        });
      }
      pr.appendChild(b);
    };

    C.AREAS.forEach(a => {
      const rows = [
        ...visible.filter(p => p.area === a.id).map(p => [p, false]),
        ...teased.filter(p => p.area === a.id).map(p => [p, true])
      ];
      if (!rows.length) return;
      if (grouping) {
        const head = document.createElement('div');
        head.className = 'shop-area-head';
        head.textContent = a.name;
        pr.appendChild(head);
      }
      rows.forEach(([item, locked]) => renderRow(item, locked));
    });

    // Anything beyond the teased tier — deeper main levels and every unbuilt
    // area — is one quiet line, not a tease. Real count, not a proxy: it must
    // go false once every catalog item is either rendered above or owned.
    const renderedIds = new Set([...visible, ...teased].map(p => p.id));
    const hiddenCount = C.PERMANENTS.filter(p => !renderedIds.has(p.id) && !S.owned[p.id]).length;
    if (hiddenCount > 0) {
      const more = document.createElement('div');
      more.className = 'shop-more';
      more.id = 'shop-more';
      more.textContent = `More to discover as ${S.pet.name} grows…`;
      pr.appendChild(more);
    }
  }
  $('btn-pet').addEventListener('click', () => {
    petReturnTo = 'screen-home';
    renderPet();
    // Reopening always starts at home; in-session scrolls persist only
    // while the screen stays open (scrollLeft otherwise survives screen
    // switches and the room can reopen on an empty, off-screen panel).
    $('scene-strip').scrollLeft = 0;
    show('screen-pet');
  });
  $('pet-back').addEventListener('click', () => {
    const dest = petReturnTo;
    petReturnTo = 'screen-home';
    if (dest === 'screen-calendar') renderCalendar(); else renderHome();
    show(dest);
  });

  // ---------- welcome cycle: hello → choose → name ----------
  // Two large cards with blurbs inline; tap selects, the CTA commits —
  // a mis-tap never decides. Lands on Home with the first-day toast.
  let selSpecies = null;

  // Queued level-up crossing, shown after the win overlay's Continue and any
  // interstitial (never stacked). In-memory only — see awardXp.
  let pendingLevelUp = null;
  // Where 'pet-back' should return to. Defaults home; the level-up CTA and
  // btn-pet set it just before navigating into the pet screen.
  let petReturnTo = 'screen-home';

  function onbStep(id) {
    document.querySelectorAll('.onboard-step').forEach(s => s.classList.remove('active'));
    $(id).classList.add('active');
  }

  function renderOnboard() {
    selSpecies = null;
    const grid = $('species-grid');
    grid.innerHTML = '';
    (C.ENABLED_SPECIES || C.SPECIES).forEach(sp => {
      const b = document.createElement('button');
      b.className = 'species-btn';
      b.id = `species-${sp}`;
      b.innerHTML = PPSprites.svg(sp, 'happy', 72) +
        `<span class="nm">${sp}</span>` +
        `<span class="blurb">${C.SPECIES_BLURBS[sp]}</span>`;
      b.addEventListener('click', () => {
        selSpecies = sp;
        grid.querySelectorAll('.species-btn').forEach(x => x.classList.remove('sel'));
        b.classList.add('sel');
        $('onb-choose-go').disabled = false;
      });
      grid.appendChild(b);
    });
    $('onb-choose-go').disabled = true;
    $('pet-name-input').value = '';
    onbStep('onb-hello');
  }

  $('onb-hello-go').addEventListener('click', () => onbStep('onb-choose'));

  $('onb-choose-go').addEventListener('click', () => {
    if (!selSpecies) return;
    $('onb-name-sprite').innerHTML = PPSprites.svg(selSpecies, 'happy', 84);
    $('pet-name-input').value = C.DEFAULT_NAMES[selSpecies];
    onbStep('onb-name');
  });

  $('onb-name-go').addEventListener('click', () => {
    if (!selSpecies) return;
    S.pet.species = selSpecies;
    S.pet.name = ($('pet-name-input').value.trim() || C.DEFAULT_NAMES[selSpecies]).slice(0, 14);
    touch();
    log('pet_chosen', { species: S.pet.species, name: S.pet.name });
    grantSpeciesUnlocks();
    renderHome();
    show('screen-home');
    toast(`Solve today's Easy puzzle to make ${S.pet.name}'s day 💛`, 4000);
  });

  // ---------- settings ----------
  $('btn-settings').addEventListener('click', () => overlay('overlay-settings', true));
  $('settings-close').addEventListener('click', () => overlay('overlay-settings', false));
  $('settings-removeads').addEventListener('click', () => {
    toast('Remove-ads arrives with the App Store build ✨');
  });
  $('settings-rename').addEventListener('click', () => {
    overlay('overlay-settings', false);
    $('rename-input').value = S.pet.name;
    overlay('overlay-rename', true);
  });
  $('rename-cancel').addEventListener('click', () => overlay('overlay-rename', false));
  $('rename-save').addEventListener('click', () => {
    const next = ($('rename-input').value.trim() || S.pet.name).slice(0, 14);
    S.pet.name = next;
    touch();
    log('pet_renamed', { name: next });
    overlay('overlay-rename', false);
    renderHome();
    if ($('screen-pet').classList.contains('active')) renderPet();
    toast(`Say hello to ${next}! 💛`);
  });

  // ---------- friends switcher: the roster grows with the level ----------
  let inviteSpecies = null;
  function openFriends() {
    inviteSpecies = null;
    $('friend-confirm').style.display = 'none';
    const list = $('friends-list');
    list.innerHTML = '';
    PPLevel.unlockedSpecies(S.pet, S.events).forEach(sp => {
      const isCurrent = sp === S.pet.species;
      const card = document.createElement('button');
      card.className = 'friend-card' + (isCurrent ? ' current' : '');
      card.id = `friend-${sp}`;
      card.innerHTML = PPSprites.svg(sp, 'happy', 56) +
        `<span class="nm">${sp}</span>` +
        (isCurrent ? '<span class="st">with you now</span>' : '');
      if (!isCurrent) card.addEventListener('click', () => {
        inviteSpecies = sp;
        $('friend-confirm-sprite').innerHTML = PPSprites.svg(sp, 'happy', 84);
        $('friend-name-input').value = C.DEFAULT_NAMES[sp];
        $('friend-confirm').style.display = '';
      });
      list.appendChild(card);
    });
    overlay('overlay-friends', true);
  }
  $('settings-friends').addEventListener('click', () => {
    overlay('overlay-settings', false);
    openFriends();
  });
  $('friends-close').addEventListener('click', () => overlay('overlay-friends', false));
  $('friend-cancel').addEventListener('click', () => {
    inviteSpecies = null;
    $('friend-confirm').style.display = 'none';
  });
  $('friend-invite').addEventListener('click', () => {
    if (!inviteSpecies) return;
    const from = S.pet.species;
    const oldName = S.pet.name;
    // Only the companion changes. Level, xp, room, coins, streak — untouched.
    S.pet.species = inviteSpecies;
    S.pet.name = ($('friend-name-input').value.trim() || oldName).slice(0, 14);
    touch();
    log('pet_changed', { from, to: S.pet.species, name: S.pet.name });
    inviteSpecies = null;
    overlay('overlay-friends', false);
    toast(`${oldName} waves happily — ${S.pet.name} is moving in! 🎉`, 3500);
    renderHome();
    if ($('screen-pet').classList.contains('active')) renderPet(true);
  });

  let resetArmed = false;
  $('settings-reset').addEventListener('click', () => {
    if (!resetArmed) {
      resetArmed = true;
      $('settings-reset').textContent = 'Tap again to erase everything';
      setTimeout(() => { resetArmed = false; $('settings-reset').textContent = 'Start over (erase data)'; }, 3000);
      return;
    }
    PPStore.reset();
    location.reload();
  });

  // ---------- free play ----------
  $('btn-freeplay').addEventListener('click', startFreeplay);

  // ---------- boot ----------
  applyRegen();
  if (S.backfillToast) {
    toast(`${S.pet.name} grew to Level ${S.backfillToast} while thinking about all the puzzles you've solved together! 💛`, 4000);
    delete S.backfillToast;
    save();
  }
  grantSpeciesUnlocks();
  if (!S.pet.species) {
    renderOnboard();
    show('screen-onboard');
  } else {
    renderHome();
    show('screen-home');
  }
  setInterval(() => {
    if ($('screen-home').classList.contains('active')) renderEnergy('home-energy-fill', 'home-energy-label');
    if ($('screen-pet').classList.contains('active')) renderEnergy('pet-energy-fill', 'pet-energy-label');
  }, 10000);

  // Test/dev hooks.
  window.PP = {
    state: () => S,
    game: window.PPGame,
    _renderHome: renderHome,
    _grant(n) { S.coins += n; save(); renderHome(); },
    _grantXp(n) {
      S.pet.xp += n;
      S.pet.levelHigh = Math.max(S.pet.levelHigh || 1, PPLevel.levelForXp(S.pet.xp).level);
      save(); renderHome();
    }
  };
})();
