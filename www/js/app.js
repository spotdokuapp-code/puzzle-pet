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
    const m = mood();
    if (m === 'missing') return `${S.pet.name} missed you — so glad you're back! ✨`;
    if (m === 'happy') return `${S.pet.name} is having a great day!`;
    return `${S.pet.name} is happily pottering about.`;
  }
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
    let sub = '';
    if (gameCtx.kind === 'daily') {
      const day = ensureDay(gameCtx.date);
      if (!day.slots[gameCtx.slot]) {
        day.slots[gameCtx.slot] = true;
        earned += C.DAILY_PAYOUTS[gameCtx.slot];
        if (day.slots.every(Boolean) && !day.bonus) {
          day.bonus = true;
          earned += C.DAILY_SET_BONUS;
          sub = `Whole set finished — +${C.DAILY_SET_BONUS} 🪙 bonus! ${S.pet.name} is thrilled.`;
        } else if (gameCtx.slot === 0) {
          sub = `Streak safe! ${S.pet.name}'s day is made. 💛`;
        }
      }
      log('puzzle_solved', {
        kind: 'daily', date: gameCtx.date, slot: gameCtx.slot,
        ms: result.ms, mistakes: result.mistakes, hints: result.hintsUsed, coins: earned
      });
    } else {
      earned = C.FREEPLAY_PAYOUT;
      log('puzzle_solved', { kind: 'free', ms: result.ms, mistakes: result.mistakes, hints: result.hintsUsed, coins: earned });
    }
    S.coins += earned;
    S.solves++;
    touch();
    save();
    $('win-emoji').textContent = ['🎉', '🌟', '🥳', '💫'][S.solves % 4];
    $('win-title').textContent = 'Solved!';
    $('win-coins').textContent = earned > 0 ? `+${earned} 🪙` : 'Nice one!';
    $('win-sub').textContent = sub;
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
  const DECO_SPOTS = {
    ball:   'left:12%; bottom:12px;',
    plant:  'right:10%; bottom:14px;',
    lamp:   'left:7%;  top:34%;',
    rug:    'right:26%; bottom:6px;',
    poster: 'right:8%; top:12%;'
  };
  function renderPet(bounce) {
    $('chip-coins-pet').textContent = `🪙 ${S.coins}`;
    const scene = $('scene');
    scene.querySelectorAll('.deco').forEach(e => e.remove());
    Object.keys(S.owned).forEach(id => {
      const item = C.PERMANENTS.find(p => p.id === id);
      if (!item) return;
      const el = document.createElement('div');
      el.className = 'deco';
      el.style.cssText = DECO_SPOTS[id] || 'left:20%; bottom:10px;';
      el.textContent = item.emoji;
      scene.appendChild(el);
    });
    const spriteEl = $('pet-sprite');
    spriteEl.innerHTML = PPSprites.svg(S.pet.species, mood(), 110);
    if (bounce) { spriteEl.classList.remove('bounce'); void spriteEl.offsetWidth; spriteEl.classList.add('bounce'); }
    $('pet-speech').textContent = moodText();
    $('pet-title').textContent = `${S.pet.name} the ${S.pet.species}`;
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
    C.PERMANENTS.forEach(item => {
      const owned = !!S.owned[item.id];
      const b = document.createElement('button');
      b.className = 'item-btn' + (owned ? ' owned' : '');
      b.id = `shop-${item.id}`;
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
      pr.appendChild(b);
    });
  }
  $('btn-pet').addEventListener('click', () => { renderPet(); show('screen-pet'); });
  $('pet-back').addEventListener('click', () => { renderHome(); show('screen-home'); });

  // ---------- onboarding / rename ----------
  let selSpecies = null;
  function renderOnboard() {
    selSpecies = S.pet.species || null;
    const grid = $('species-grid');
    grid.innerHTML = '';
    C.SPECIES.forEach(sp => {
      const b = document.createElement('button');
      b.className = 'species-btn' + (sp === selSpecies ? ' sel' : '');
      b.id = `species-${sp}`;
      b.innerHTML = PPSprites.svg(sp, 'happy', 62) + `<span class="nm">${sp}</span>`;
      b.addEventListener('click', () => {
        selSpecies = sp;
        grid.querySelectorAll('.species-btn').forEach(x => x.classList.remove('sel'));
        b.classList.add('sel');
        const inp = $('pet-name-input');
        if (!inp.value.trim()) inp.value = C.DEFAULT_NAMES[sp];
        $('onboard-go').disabled = false;
      });
      grid.appendChild(b);
    });
    $('pet-name-input').value = S.pet.name || '';
    $('onboard-go').disabled = !selSpecies;
    $('onboard-go').textContent = S.pet.species ? 'Save' : "Let's go!";
  }
  $('onboard-go').addEventListener('click', () => {
    if (!selSpecies) return;
    const isNew = !S.pet.species;
    S.pet.species = selSpecies;
    S.pet.name = ($('pet-name-input').value.trim() || C.DEFAULT_NAMES[selSpecies]).slice(0, 14);
    touch();
    log(isNew ? 'pet_chosen' : 'pet_renamed', { species: selSpecies, name: S.pet.name });
    if (isNew) toast(`${S.pet.name} can't wait to watch you solve! 💛`);
    renderHome();
    show('screen-home');
  });

  // ---------- settings ----------
  $('btn-settings').addEventListener('click', () => overlay('overlay-settings', true));
  $('settings-close').addEventListener('click', () => overlay('overlay-settings', false));
  $('settings-removeads').addEventListener('click', () => {
    toast('Remove-ads arrives with the App Store build ✨');
  });
  $('settings-rename').addEventListener('click', () => {
    overlay('overlay-settings', false);
    renderOnboard();
    show('screen-onboard');
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
    _grant(n) { S.coins += n; save(); renderHome(); }
  };
})();
