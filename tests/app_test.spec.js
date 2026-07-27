// Puzzle Pet — end-to-end flow: onboarding, daily set, economy, energy,
// calendar back-fill, pet room, persistence. Keep this green.
const { test, expect } = require('@playwright/test');

async function continueWin(page) {
  await expect(page.locator('#overlay-win')).toHaveClass(/show/);
  await page.click('#win-continue');
  // Interstitial stub may appear between puzzles (every 3rd solve).
  const ad = page.locator('#overlay-ad');
  if (await ad.evaluate(el => el.classList.contains('show'))) {
    await expect(page.locator('#ad-close')).toBeEnabled({ timeout: 5000 });
    await page.click('#ad-close');
  }
}

async function autosolve(page) {
  await page.evaluate(() => window.PP.game._autosolve());
}

async function onboard(page, species = 'dog', name) {
  await page.goto('/');
  await page.click('#onb-hello-go');
  await page.click(`#species-${species}`);
  await page.click('#onb-choose-go');
  if (name) await page.fill('#pet-name-input', name);
  await page.click('#onb-name-go');
  await expect(page.locator('#screen-home')).toHaveClass(/active/);
}

test('full core loop', async ({ page }) => {
  await page.goto('/');

  // --- Welcome cycle: hello → choose → name ---
  await expect(page.locator('#screen-onboard')).toHaveClass(/active/);
  await expect(page.locator('#onb-hello')).toHaveClass(/active/);
  await page.click('#onb-hello-go');

  // Tapping selects only; a separate button commits, because species is permanent.
  await expect(page.locator('#onb-choose')).toHaveClass(/active/);
  await expect(page.locator('#onb-choose-go')).toBeDisabled();
  const speciesShown = await page.locator('.species-btn').count();
  expect(speciesShown).toBe(2);
  await page.click('#species-dog');
  await page.click('#species-cat');            // browsing is safe
  await page.click('#species-dog');            // and reversible
  await expect(page.locator('#onb-choose-go')).toBeEnabled();
  await page.click('#onb-choose-go');

  await expect(page.locator('#onb-name')).toHaveClass(/active/);
  await expect(page.locator('#pet-name-input')).toHaveValue('Biscuit');
  await page.fill('#pet-name-input', 'Pip');
  await page.click('#onb-name-go');

  await expect(page.locator('#screen-home')).toHaveClass(/active/);
  await expect(page.locator('#home-pet-name')).toHaveText('Pip');
  await expect(page.locator('#toast')).toHaveClass(/show/);
  await expect(page.locator('#toast')).toContainText("make Pip's day");

  // --- Daily slots: medium locked until easy done ---
  await expect(page.locator('#slot-1')).toHaveClass(/locked/);

  // --- Solve easy (slot 0): streak + coins ---
  await page.click('#slot-0');
  await expect(page.locator('#screen-game')).toHaveClass(/active/);
  await expect(page.locator('.cell')).toHaveCount(25);
  await autosolve(page);
  await expect(page.locator('#win-coins')).toHaveText('+10 🪙');
  await continueWin(page);
  // No threshold crossed by this lone easy solve — overlay must stay hidden.
  await expect(page.locator('#overlay-levelup')).not.toHaveClass(/show/);
  await expect(page.locator('#chip-coins')).toHaveText('🪙 10');
  await expect(page.locator('#chip-streak')).toHaveText('🔥 1');
  await expect(page.locator('#slot-0')).toHaveClass(/done/);
  await expect(page.locator('#slot-1')).not.toHaveClass(/locked/);

  // --- Medium (slot 1): a conflicting placement drains pet energy ---
  await page.click('#slot-1');
  await expect(page.locator('.cell')).toHaveCount(49);
  const c0 = page.locator('.cell').nth(0);
  const c1 = page.locator('.cell').nth(1);
  await c0.click(); await c0.click();       // empty → mark → piece
  await c1.click(); await c1.click();       // adjacent piece = conflict = mistake
  await expect(page.locator('#game-energy')).toHaveText('⚡ 90');
  await expect(page.locator('.cell.error')).toHaveCount(2);
  await page.click('#btn-clear');
  await autosolve(page);
  await continueWin(page);
  await expect(page.locator('#chip-coins')).toHaveText('🪙 30');

  // --- Hard (slot 2): completes the set → bonus; 3rd solve → interstitial handled ---
  await page.click('#slot-2');
  await expect(page.locator('.cell')).toHaveCount(81);
  await autosolve(page);
  await expect(page.locator('#win-coins')).toHaveText('+70 🪙'); // 45 + 25 bonus
  await continueWin(page);
  await expect(page.locator('#chip-coins')).toHaveText('🪙 100');
  await expect(page.locator('#set-bonus-line')).toHaveClass(/earned/);

  // The hard solve's payout plus set bonus (10+20+35+15=80) crosses L2
  // (threshold 60); dismiss the queued overlay before continuing.
  await expect(page.locator('#overlay-levelup')).toHaveClass(/show/);
  await expect(page.locator('#levelup-title')).toContainText('Level 2');
  await page.click('#levelup-cta');
  await expect(page.locator('#screen-pet')).toHaveClass(/active/);
  await page.click('#pet-back');
  await expect(page.locator('#screen-home')).toHaveClass(/active/);

  // --- Calendar back-fill: play yesterday, still pays, extends streak ---
  await page.click('#btn-calendar');
  await expect(page.locator('#screen-calendar')).toHaveClass(/active/);
  const yesterday = await page.evaluate(() => {
    const d = new Date(); d.setDate(d.getDate() - 1);
    return d.getDate();
  });
  const sameMonth = await page.evaluate(() => new Date().getDate() !== 1);
  if (sameMonth) {
    await page.evaluate(() => {
      // Pretend the app was installed yesterday so back-fill is allowed.
      const s = window.PP.state();
      const d = new Date(); d.setDate(d.getDate() - 1);
      const p = x => String(x).padStart(2, '0');
      s.createdDay = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
    });
    await page.click('#cal-back');     // leave and re-enter to re-render
    await page.click('#btn-calendar');
    await page.locator('.cal-day', { hasText: String(yesterday) }).first().click();
    await expect(page.locator('#screen-game')).toHaveClass(/active/);
    await autosolve(page);
    await continueWin(page);
    await expect(page.locator('#screen-calendar')).toHaveClass(/active/);
    await expect(page.locator('#chip-streak-cal')).toHaveText('🔥 2'); // back-fill restored the chain
    await page.click('#cal-back');
    await expect(page.locator('#chip-coins')).toHaveText('🪙 110');
  } else {
    await page.click('#cal-back');
  }
  const coinsNow = sameMonth ? 110 : 100;

  // --- Pet room: snack restores energy, permanent lands in the scene ---
  await page.click('#btn-pet');
  await expect(page.locator('#screen-pet')).toHaveClass(/active/);
  await expect(page.locator('#pet-title')).toContainText('Pip');
  await page.click('#buy-berry');   // 10 coins, +25 energy (capped at 100)
  await page.click('#shop-ball');   // 80 coins
  await expect(page.locator('.deco')).toHaveCount(1);
  await expect(page.locator('#chip-coins-pet')).toHaveText(`🪙 ${coinsNow - 90}`);
  await page.click('#pet-back');

  // --- Event log captured everything (retroactive-grant principle) ---
  const events = await page.evaluate(() => window.PP.state().events.map(e => e.type));
  expect(events).toContain('pet_chosen');
  expect(events.filter(e => e === 'puzzle_solved').length).toBeGreaterThanOrEqual(3);
  expect(events).toContain('feed');
  expect(events).toContain('buy_permanent');

  // --- Persistence across reload ---
  await page.reload();
  await expect(page.locator('#screen-home')).toHaveClass(/active/);
  await expect(page.locator('#home-pet-name')).toHaveText('Pip');
  await expect(page.locator('#chip-coins')).toHaveText(`🪙 ${coinsNow - 90}`);
  await expect(page.locator('#slot-2')).toHaveClass(/done/);
});

test('daily puzzles are deterministic for a given date', async ({ page }) => {
  await page.goto('/');
  const [a, b] = await page.evaluate(() => {
    const p1 = PPGen.generate(7, 'daily:2026-07-25:1#x');
    const p2 = PPGen.generate(7, 'daily:2026-07-25:1#x');
    return [JSON.stringify(p1), JSON.stringify(p2)];
  });
  expect(a).toBe(b);
});

test('xp comes from solving only, and levels ratchet up', async ({ page }) => {
  await onboard(page, 'cat');

  // No visit XP in v2: a fresh pet starts at exactly zero.
  expect(await page.evaluate(() => window.PP.state().pet.xp)).toBe(0);

  // Petting responds but grants nothing.
  await page.click('#btn-pet');
  await page.click('#pet-sprite');
  await page.click('#pet-sprite');
  expect(await page.evaluate(() => window.PP.state().pet.xp)).toBe(0);
  const events = await page.evaluate(() => window.PP.state().events.map(e => e.type));
  expect(events).toContain('petted');
  await page.click('#pet-back');

  // Solving the easy opener grants exactly XP_PAYOUTS[0], shown on the win overlay.
  await page.click('#slot-0');
  await autosolve(page);
  const perEasy = await page.evaluate(() => window.PPConfig.XP_PAYOUTS[0]);
  await expect(page.locator('#win-xp-gain')).toHaveText(`+${perEasy} ✦`);
  await continueWin(page);
  expect(await page.evaluate(() => window.PP.state().pet.xp)).toBe(perEasy);

  // Pet-screen level label reflects the solve exactly: into/needed toward Lv 2.
  const l2 = await page.evaluate(() => window.PPConfig.LEVEL_XP[0]);
  await page.click('#btn-pet');
  await expect(page.locator('#level-label')).toHaveText(`${perEasy} / ${l2} ✦ to Lv 2`);
  await page.click('#pet-back');

  // One XP short of L2, then one real solve crosses it: level_up logged, chip updates.
  await page.evaluate(xp => window.PP._grantXp(xp), l2 - perEasy - 1);
  await page.click('#slot-1');   // medium, worth more than 1 XP
  await autosolve(page);
  await continueWin(page);

  // Crossing L2 queues the level-up overlay; it appears after Continue
  // (and any interstitial), never stacked. L2's unlocks are main items.
  await expect(page.locator('#overlay-levelup')).toHaveClass(/show/);
  await expect(page.locator('#levelup-title')).toContainText('Level 2');
  await expect(page.locator('#levelup-list')).toContainText('Cozy lamp');
  await expect(page.locator('#levelup-list')).toContainText('Warm rug');
  await expect(page.locator('#levelup-cta')).toHaveText('See the shop');
  await page.click('#levelup-cta');
  await expect(page.locator('#screen-pet')).toHaveClass(/active/);
  await page.click('#pet-back');

  const s = await page.evaluate(() => window.PP.state());
  expect(s.pet.levelHigh).toBeGreaterThanOrEqual(2);
  expect(s.events.map(e => e.type)).toContain('level_up');
  await expect(page.locator('#chip-level')).toHaveText(`Lv ${s.pet.levelHigh}`);
});

test('a v1 save migrates to v3 with xp backfilled at the new values', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem('puzzlepet.v1', JSON.stringify({
      version: 1, createdDay: '2026-06-01', coins: 137,
      pet: { species: 'fox', name: 'Pip', energy: 80, energyTs: Date.now() },
      lastActiveDay: '2026-06-20',
      days: { '2026-06-20': { slots: [true, true, false], bonus: false } },
      owned: { ball: true, plant: true }, solves: 4, removeAds: false,
      events: [
        { type: 'pet_chosen', species: 'fox', name: 'Pip' },
        { type: 'puzzle_solved', kind: 'daily', slot: 0 },
        { type: 'puzzle_solved', kind: 'daily', slot: 1 },
        { type: 'puzzle_solved', kind: 'daily', slot: 2 },
        { type: 'feed', item: 'cake' }
      ]
    }));
  });
  await page.reload();

  // The migration toast (shown for 4s on boot) announces the level reached
  // from history — asserted immediately after reload, well within that window.
  await expect(page.locator('#toast')).toHaveClass(/show/);
  await expect(page.locator('#toast')).toContainText('Level 2');

  // Straight to home — a migrated player is never re-onboarded, and a fox
  // chosen before the roster shrank keeps their fox.
  await expect(page.locator('#screen-home')).toHaveClass(/active/);
  await expect(page.locator('#home-pet-name')).toHaveText('Pip');

  const s = await page.evaluate(() => window.PP.state());
  const cfg = await page.evaluate(() => window.PPConfig);
  const exact = cfg.XP_PAYOUTS[0] + cfg.XP_PAYOUTS[1] + cfg.XP_PAYOUTS[2]; // feed = 0, no bonus day
  expect(s.version).toBe(3);
  expect(s.pet.xp).toBe(exact);
  expect(s.pet.levelHigh).toBe(2);            // 65 >= LEVEL_XP[0] (60)
  expect(s.coins).toBe(137);
  expect(s.owned.ball).toBe(true);
  expect(s.days['2026-06-20'].slots).toEqual([true, true, false]);
  expect(s.events.map(e => e.type)).toContain('xp_backfill');

  // Exactly once: a reload must not re-award.
  await page.reload();
  expect(await page.evaluate(() => window.PP.state().pet.xp)).toBe(exact);
  const backfills = await page.evaluate(() =>
    window.PP.state().events.filter(e => e.type === 'xp_backfill').length);
  expect(backfills).toBe(1);
});

test('a v2 (bond) save migrates to v3, drops bond, and counts bonus days', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem('puzzlepet.v2', JSON.stringify({
      version: 2, createdDay: '2026-07-01', coins: 55,
      pet: { species: 'dino', name: 'Pebble', energy: 60, energyTs: Date.now() },
      bond: { xp: 31, level: 2, visitDay: '2026-07-20', pets: 5, petsDay: '2026-07-20' },
      room: { wallpaper: 'plain', flooring: 'plain' },
      lastActiveDay: '2026-07-20',
      days: { '2026-07-20': { slots: [true, true, true], bonus: true } },
      owned: {}, solves: 3, removeAds: false,
      events: [
        { type: 'pet_chosen', species: 'dino', name: 'Pebble' },
        { type: 'puzzle_solved', kind: 'daily', slot: 0 },
        { type: 'puzzle_solved', kind: 'daily', slot: 1 },
        { type: 'puzzle_solved', kind: 'daily', slot: 2 },
        { type: 'bond_visit', xp: 3 },
        { type: 'bond_pet', xp: 1 }
      ]
    }));
  });
  await page.reload();

  const s = await page.evaluate(() => window.PP.state());
  const cfg = await page.evaluate(() => window.PPConfig);
  const exact = cfg.XP_PAYOUTS[0] + cfg.XP_PAYOUTS[1] + cfg.XP_PAYOUTS[2] + cfg.XP_SET_BONUS;
  expect(s.version).toBe(3);
  expect(s.pet.xp).toBe(exact);               // old bond xp is NOT converted; history is replayed
  expect(s.bond).toBeUndefined();
  expect(s.coins).toBe(55);
  expect(s.pet.name).toBe('Pebble');
  const backfills = await page.evaluate(() =>
    window.PP.state().events.filter(e => e.type === 'xp_backfill').length);
  expect(backfills).toBe(1);

  // Exactly once: a second reload must not re-migrate or re-award.
  await page.reload();
  expect(await page.evaluate(() => window.PP.state().pet.xp)).toBe(exact);
  const backfillsAfterReload = await page.evaluate(() =>
    window.PP.state().events.filter(e => e.type === 'xp_backfill').length);
  expect(backfillsAfterReload).toBe(1);
});

test('the shop gates by level: visible tier, one teased tier, quiet collapse', async ({ page }) => {
  await onboard(page, 'dog');

  await page.click('#btn-pet');
  // Lv 1: ball + plant purchasable; lamp + rug teased as the next tier;
  // nothing deeper visible; the collapse line present; no non-main item.
  await expect(page.locator('#shop-ball')).toBeVisible();
  await expect(page.locator('#shop-plant')).toBeVisible();
  await expect(page.locator('#shop-lamp')).toHaveClass(/locked/);
  await expect(page.locator('#shop-lamp')).toBeDisabled();
  await expect(page.locator('#shop-lamp .pr')).toHaveText('Unlocks at Lv 2 ✨');
  await expect(page.locator('#shop-bowl')).toHaveCount(0);      // deeper main tier: hidden
  await expect(page.locator('#shop-cushion')).toHaveCount(0);   // unbuilt area: hidden
  await expect(page.locator('#shop-more')).toContainText('More to discover');

  // Level up to 3: bowl + poster join the shop; the tease moves to Lv 4.
  await page.evaluate(() => window.PP._grantXp(window.PPConfig.LEVEL_XP[1]));  // 150 → Lv 3
  await page.click('#pet-back');
  await page.click('#btn-pet');
  await expect(page.locator('#shop-bowl')).toBeVisible();
  await expect(page.locator('#shop-bowl')).not.toHaveClass(/locked/);
  await expect(page.locator('#shop-shelf .pr')).toHaveText('Unlocks at Lv 4 ✨');

  // Buy something newly unlocked and see it land in the room.
  // _grant only re-renders the home screen; force a pet-screen re-render
  // (same pattern as the XP grant above) so the buy button reflects the
  // new balance.
  await page.evaluate(() => window.PP._grant(200));
  await page.click('#pet-back');
  await page.click('#btn-pet');
  await page.click('#shop-bowl');
  await expect(page.locator('.deco')).toHaveCount(1);
  await expect(page.locator('#shop-bowl .pr')).toHaveText('in room ✓');
});

test('an owned item in a still-locked area keeps its shop row', async ({ page }) => {
  await onboard(page, 'dog');

  // koi (pond, unlocks at Lv 20) owned at Lv 1 — a corrupt-save or
  // future-config-raise scenario. Owned is never hidden: it must still
  // show a shop row, not vanish because its area isn't unlocked yet.
  await page.evaluate(() => { window.PP.state().owned.koi = true; });
  await page.click('#btn-pet');
  await expect(page.locator('#shop-koi')).toHaveCount(1);
  await expect(page.locator('#shop-koi .pr')).toHaveText('in room ✓');
});

test('crossing an area level headlines the area and visits the room', async ({ page }) => {
  await onboard(page, 'cat');

  // Sit one easy-solve below the L4→L5 threshold. L5 unlocks the nook area
  // (plus its two level-5 items): the overlay must headline the area, not
  // just list items, and the CTA must offer to visit the room.
  const perEasy = await page.evaluate(() => window.PPConfig.XP_PAYOUTS[0]);
  const l5 = await page.evaluate(() => window.PPConfig.LEVEL_XP[3]);
  await page.evaluate(xp => window.PP._grantXp(xp), l5 - perEasy);

  await page.click('#slot-0');
  await autosolve(page);
  await continueWin(page);

  await expect(page.locator('#overlay-levelup')).toHaveClass(/show/);
  await expect(page.locator('#levelup-title')).toContainText('Level 5');
  await expect(page.locator('#levelup-list')).toContainText('🏡 Window nook');
  await expect(page.locator('#levelup-list')).toContainText('Window cushion');
  await expect(page.locator('#levelup-list')).toContainText('String lights');
  await expect(page.locator('#levelup-cta')).toHaveText('Visit the room');
  await page.click('#levelup-cta');
  await expect(page.locator('#overlay-levelup')).not.toHaveClass(/show/);
  await expect(page.locator('#screen-pet')).toHaveClass(/active/);
  await expect(page.locator('#area-nook')).toHaveCount(1);

  // The CTA actually scrolled the strip to the new area (smooth scroll —
  // poll until the animation lands rather than asserting immediately).
  await expect.poll(() =>
    page.evaluate(() => document.getElementById('scene-strip').scrollLeft)
  ).toBeGreaterThan(0);

  // pet-back returns to wherever the room was entered from — here, home.
  await page.click('#pet-back');
  await expect(page.locator('#screen-home')).toHaveClass(/active/);
});

test('a crossing with nothing new falls back warmly', async ({ page }) => {
  await onboard(page, 'cat');

  // Pre-own the L6 unlock (toychest is the only thing that unlocks at L6,
  // and the nook area is already open by then), so this crossing is
  // genuinely empty — the overlay must fall back to the quiet placeholder
  // row instead of rendering nothing.
  await page.evaluate(() => { const s = window.PP.state(); s.owned.toychest = true; });

  const perEasy = await page.evaluate(() => window.PPConfig.XP_PAYOUTS[0]);
  const l6 = await page.evaluate(() => window.PPConfig.LEVEL_XP[4]);
  await page.evaluate(xp => window.PP._grantXp(xp), l6 - perEasy);

  await page.click('#slot-0');
  await autosolve(page);
  await continueWin(page);

  await expect(page.locator('#overlay-levelup')).toHaveClass(/show/);
  await expect(page.locator('#levelup-title')).toContainText('Level 6');
  await expect(page.locator('#levelup-list')).toContainText('Growing stronger together');
  await expect(page.locator('#levelup-cta')).toHaveText('Continue');
  await page.click('#levelup-cta');
  await expect(page.locator('#overlay-levelup')).not.toHaveClass(/show/);
  await expect(page.locator('#screen-home')).toHaveClass(/active/);   // dest 'stay': no navigation
});

test('areas unlock as panels, decor lands in its area, shop groups', async ({ page }) => {
  await onboard(page, 'cat');

  // Lv 1: only the main panel exists — locked areas are absent, not teased.
  await page.click('#btn-pet');
  await expect(page.locator('.area')).toHaveCount(1);
  await expect(page.locator('#area-nook')).toHaveCount(0);
  await expect(page.locator('.shop-area-head')).toHaveCount(0);   // one area → no headers

  // Reach Lv 5: the nook panel appears with its label; shop grows headers.
  await page.evaluate(() => window.PP._grantXp(window.PPConfig.LEVEL_XP[3]));  // 430 → Lv 5
  await page.click('#pet-back');
  await page.click('#btn-pet');
  await expect(page.locator('#area-nook')).toHaveCount(1);
  await expect(page.locator('#area-nook .area-label')).toHaveText('Window nook');
  await expect(page.locator('#area-garden')).toHaveCount(0);      // still locked, still absent
  await expect(page.locator('.shop-area-head')).toHaveCount(2);   // Home + Window nook

  // Buy a nook item: the decor lands in the nook panel, not main.
  await page.evaluate(() => window.PP._grant(400));
  await page.click('#pet-back');
  await page.click('#btn-pet');
  await page.click('#shop-cushion');
  await expect(page.locator('#area-nook .deco')).toHaveCount(1);
  await expect(page.locator('#area-main .deco')).toHaveCount(0);

  // The pet-room title carries the level.
  await expect(page.locator('#pet-title')).toContainText('· Lv 5');
});

test('late game: every area and every catalog item is in the room by Lv 30', async ({ page }) => {
  await onboard(page, 'cat');

  await page.evaluate(() => window.PP._grantXp(window.PPConfig.LEVEL_XP[28]));  // L30
  await page.click('#btn-pet');

  await expect(page.locator('.area')).toHaveCount(5);
  await expect(page.locator('.shop-area-head')).toHaveCount(5);
  await expect(page.locator('#permanents-row .item-btn')).toHaveCount(37);
  await expect(page.locator('#shop-more')).toHaveCount(0);
  await expect(page.locator('#pet-title')).toContainText('· Lv 30');
});

test('a friend unlocks at 12, moves in, and nothing else changes', async ({ page }) => {
  await onboard(page, 'cat', 'Mochi');

  // One easy-solve below L12: the crossing leads with the friend.
  const l12 = await page.evaluate(() => window.PPConfig.LEVEL_XP[10]);
  const perEasy = await page.evaluate(() => window.PPConfig.XP_PAYOUTS[0]);
  await page.evaluate(xp => window.PP._grantXp(xp), l12 - perEasy);
  await page.click('#slot-0');
  await autosolve(page);
  await continueWin(page);
  await expect(page.locator('#overlay-levelup')).toHaveClass(/show/);
  await expect(page.locator('#levelup-list .unlock-row').first())
    .toContainText('Clover the bunny would love to move in!');
  await expect(page.locator('#levelup-cta')).toHaveText('Meet them');
  await page.click('#levelup-cta');
  await expect(page.locator('#overlay-friends')).toHaveClass(/show/);
  await expect(page.locator('#friend-bunny')).toBeVisible();
  await expect(page.locator('#friend-alien')).toHaveCount(0);   // locked: absent, not teased

  // Invite Clover; everything but the companion is untouched.
  const before = await page.evaluate(() => {
    const s = window.PP.state();
    return { xp: s.pet.xp, coins: s.coins, owned: Object.keys(s.owned).length, solves: s.solves };
  });
  await page.click('#friend-bunny');
  await expect(page.locator('#friend-name-input')).toHaveValue('Clover');
  await page.click('#friend-invite');
  await expect(page.locator('#toast')).toContainText('Mochi waves happily — Clover is moving in!');
  const after = await page.evaluate(() => {
    const s = window.PP.state();
    return { xp: s.pet.xp, coins: s.coins, owned: Object.keys(s.owned).length,
             solves: s.solves, species: s.pet.species, name: s.pet.name,
             events: s.events.map(e => e.type) };
  });
  expect(after.xp).toBe(before.xp);
  expect(after.coins).toBe(before.coins);
  expect(after.owned).toBe(before.owned);
  expect(after.solves).toBe(before.solves);
  expect(after.species).toBe('bunny');
  expect(after.name).toBe('Clover');
  expect(after.events).toContain('species_unlocked');
  expect(after.events).toContain('pet_changed');
  await expect(page.locator('#home-pet-name')).toHaveText('Clover');
});

test('a save already past milestones gets quiet retroactive unlocks', async ({ page }) => {
  await onboard(page, 'dog');
  await page.evaluate(() => window.PP._grantXp(window.PPConfig.LEVEL_XP[22]));  // L24
  await page.reload();
  const s = await page.evaluate(() => window.PP.state());
  const granted = s.events.filter(e => e.type === 'species_unlocked').map(e => e.species).sort();
  expect(granted).toEqual(['bunny', 'dino', 'fox']);   // not alien (L30)
  // Idempotent: a second reload adds nothing.
  await page.reload();
  const again = await page.evaluate(() =>
    window.PP.state().events.filter(e => e.type === 'species_unlocked').length);
  expect(again).toBe(3);
  // The roster shows them; the alien stays absent.
  await page.evaluate(() => window.PP._renderHome());
  await page.click('#btn-settings');
  await page.click('#settings-friends');
  await expect(page.locator('.friend-card')).toHaveCount(5);
  await expect(page.locator('#friend-alien')).toHaveCount(0);
});
