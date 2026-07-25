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

  // --- Onboarding ---
  await expect(page.locator('#screen-onboard')).toHaveClass(/active/);
  await page.click('#species-fox');
  await expect(page.locator('#pet-name-input')).toHaveValue('Maple');
  await page.fill('#pet-name-input', 'Pip');
  await page.click('#onboard-go');
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
