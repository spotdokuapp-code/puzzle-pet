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

test('full core loop', async ({ page }) => {
  await page.goto('/');

  // --- Onboarding: welcome → meet → name → arrive ---
  await expect(page.locator('#screen-onboard')).toHaveClass(/active/);
  await expect(page.locator('#onb-welcome')).toHaveClass(/active/);
  await page.click('#onb-welcome-go');

  // Tapping previews only; a separate button commits, because species is permanent.
  await expect(page.locator('#onb-choose')).toHaveClass(/active/);
  await expect(page.locator('#onb-choose-go')).toBeDisabled();
  await page.click('#species-fox');
  await expect(page.locator('#onb-blurb')).not.toHaveText('');
  await page.click('#species-cat');            // browsing is safe
  await page.click('#species-fox');            // and reversible
  await expect(page.locator('#onb-choose-go')).toBeEnabled();
  await page.click('#onb-choose-go');

  await expect(page.locator('#onb-name')).toHaveClass(/active/);
  await expect(page.locator('#pet-name-input')).toHaveValue('Maple');
  await page.fill('#pet-name-input', 'Pip');
  await page.click('#onb-name-go');

  await expect(page.locator('#onb-arrive')).toHaveClass(/active/);
  await expect(page.locator('#onb-speech')).toContainText('Pip');
  await page.click('#onb-arrive-go');

  await expect(page.locator('#screen-home')).toHaveClass(/active/);
  await expect(page.locator('#home-pet-name')).toHaveText('Pip');

  // --- Daily slots: medium locked until easy done ---
  await expect(page.locator('#slot-1')).toHaveClass(/locked/);

  // --- Solve easy (slot 0): streak + coins ---
  await page.click('#slot-0');
  await expect(page.locator('#screen-game')).toHaveClass(/active/);
  await expect(page.locator('.cell')).toHaveCount(25);
  await autosolve(page);
  await expect(page.locator('#win-coins')).toHaveText('+10 🪙');
  await continueWin(page);
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

test('bond rises from solving, petting, and visiting', async ({ page }) => {
  await page.goto('/');

  // Onboard quickly.
  await page.click('#onb-welcome-go');
  await page.click('#species-dino');
  await page.click('#onb-choose-go');
  await page.click('#onb-name-go');
  await page.click('#onb-arrive-go');

  // The daily visit is claimed once onboarding completes.
  const afterVisit = await page.evaluate(() => window.PP.state().bond.xp);
  expect(afterVisit).toBeGreaterThan(0);

  // Solving the easy opener adds XP.
  await page.click('#slot-0');
  await autosolve(page);
  await continueWin(page);
  const afterSolve = await page.evaluate(() => window.PP.state().bond.xp);
  expect(afterSolve).toBeGreaterThan(afterVisit);

  // Petting is free but capped per day.
  await page.click('#btn-pet');
  await expect(page.locator('#pet-bond')).toBeVisible();
  const cap = await page.evaluate(() => window.PPConfig.BOND_XP.petCapPerDay);
  for (let i = 0; i < cap + 3; i++) await page.click('#pet-sprite');
  const afterPets = await page.evaluate(() => window.PP.state().bond.xp);
  const perPet = await page.evaluate(() => window.PPConfig.BOND_XP.pet);
  expect(afterPets).toBe(afterSolve + cap * perPet);

  // XP only ever goes up, and the meter reflects the level.
  await page.evaluate(() => window.PP._grantXp(1000));
  await page.click('#pet-back');
  await page.click('#btn-pet');
  const level = await page.evaluate(() => window.PP.state().bond.level);
  expect(level).toBeGreaterThan(1);
  await expect(page.locator('#bond-level')).toHaveText(`Lv ${level}`);
});

test('a v1 save migrates to v2 with a backfilled bond level', async ({ page }) => {
  await page.goto('/');

  // Seed a v1 save with real history, then reload so load() migrates it.
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem('puzzlepet.v1', JSON.stringify({
      version: 1,
      createdDay: '2026-06-01',
      coins: 137,
      pet: { species: 'fox', name: 'Pip', energy: 80, energyTs: Date.now() },
      lastActiveDay: '2026-06-20',
      days: { '2026-06-20': { slots: [true, true, false], bonus: false } },
      owned: { ball: true, plant: true },
      solves: 4,
      removeAds: false,
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

  // Straight to home — a migrated player is never re-onboarded.
  await expect(page.locator('#screen-home')).toHaveClass(/active/);
  await expect(page.locator('#home-pet-name')).toHaveText('Pip');

  const s = await page.evaluate(() => window.PP.state());
  expect(s.version).toBe(2);

  // Backfill credited the logged solves and the feed.
  const cfg = await page.evaluate(() => window.PPConfig.BOND_XP);
  const backfilled = cfg.dailySolve[0] + cfg.dailySolve[1] + cfg.dailySolve[2] + cfg.feed.cake;
  expect(s.bond.xp).toBeGreaterThanOrEqual(backfilled);   // plus today's visit
  expect(s.bond.level).toBeGreaterThan(1);

  // Nothing the player already had was disturbed.
  expect(s.coins).toBe(137);
  expect(s.owned.ball).toBe(true);
  expect(s.owned.plant).toBe(true);
  expect(s.days['2026-06-20'].slots).toEqual([true, true, false]);

  // Migration runs exactly once — a reload must not re-award the backfill.
  const xpAfterFirst = s.bond.xp;
  await page.reload();
  const xpAfterSecond = await page.evaluate(() => window.PP.state().bond.xp);
  expect(xpAfterSecond).toBe(xpAfterFirst);
});
