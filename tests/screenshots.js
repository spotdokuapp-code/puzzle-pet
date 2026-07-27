// Dev utility: capture screenshots of each screen for visual review.
const { chromium } = require('@playwright/test');

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.PP_CHROMIUM || undefined });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto('http://localhost:8123/');
  const shot = name => page.screenshot({ path: `shots/${name}.png` });

  await shot('1-onboard');
  await page.click('#onb-hello-go');
  await page.click('#species-cat');
  await page.click('#onb-choose-go');
  await page.click('#onb-name-go');
  await shot('2-home');

  await page.click('#slot-0');
  await page.evaluate(() => {
    // Half-solve for a lively board: 2 correct stars + a few marks.
    const d = window.PP.game._debug();
    d.cells[0 * d.puzzle.n + d.puzzle.solution[0]] = 2;
    d.cells[2 * d.puzzle.n + d.puzzle.solution[2]] = 2;
    d.cells[3] = 1; d.cells[7] = 1;
  });
  await page.locator('.cell').nth(24).click(); // trigger render via a real tap
  await shot('3-game');
  await page.evaluate(() => window.PP.game._autosolve());
  await shot('4-win');
  await page.click('#win-continue');

  await page.click('#btn-calendar');
  await shot('5-calendar');
  await page.click('#cal-back');

  await page.evaluate(() => window.PP._grant(500));
  await page.click('#btn-pet');
  await page.click('#shop-ball');
  await page.click('#shop-plant');
  await shot('6-pet-room');

  await browser.close();
})();
