import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { startStaticSiteServer } from './test-support/static-site-server.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const root = resolve(import.meta.dirname, '..');
const site = await startStaticSiteServer(root);

// Exercise the real first-interaction audio path; a passing test must actually call the injected constructor.
const cases = [
  { slug: 'blackhole-sweeper', selector: '#start-btn' },
  { slug: 'girigiri-brake', selector: '#start-btn' },
  { slug: 'kage-mane-dojo', selector: '#startButton', waitMs: 1200 },
  { slug: 'kanji-slicer', selector: '#game-canvas', canvasTap: true },
  { slug: 'lumen-mirror', selector: '#start-btn' },
  { slug: 'mikiri-issen', selector: '#startButton' },
  { slug: 'sorting-factory', selector: '#start-btn' },
  { slug: 'stealth-slacker', selector: '#start-btn' },
  { slug: 'wall-jumper', selector: '#start-btn' },
];

let browser;
try {
  browser = await chromium.launch({
    headless: true,
    executablePath: process.env.CHROME_PATH || chromium.executablePath(),
  });

  const failures = [];

  for (const testCase of cases) {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const pageErrors = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));

    await page.addInitScript(() => {
      window.__AUDIO_CONTEXT_CONSTRUCTOR_CALLS__ = 0;
      class ThrowingAudioContext {
        constructor() {
          window.__AUDIO_CONTEXT_CONSTRUCTOR_CALLS__ += 1;
          throw new DOMException('simulated AudioContext constructor failure', 'NotAllowedError');
        }
      }
      Object.defineProperties(window, {
        AudioContext: { value: ThrowingAudioContext, configurable: true },
        webkitAudioContext: { value: ThrowingAudioContext, configurable: true },
      });
    });

    try {
      await page.goto(`${site.origin}/${testCase.slug}/`, { waitUntil: 'networkidle', timeout: 20_000 });
      const target = page.locator(testCase.selector);
      await target.waitFor({ state: 'visible', timeout: 5_000 });

      if (testCase.canvasTap) {
        const box = await target.boundingBox();
        if (!box) throw new Error(`${testCase.slug}: audio trigger canvas has no bounding box`);
        await page.mouse.click(box.x + box.width / 2, box.y + Math.min(80, box.height / 4));
      } else {
        await target.click();
      }

      await page.waitForTimeout(testCase.waitMs ?? 350);
      const constructorCalls = await page.evaluate(() => window.__AUDIO_CONTEXT_CONSTRUCTOR_CALLS__ ?? 0);

      if (constructorCalls === 0) {
        failures.push(`${testCase.slug}: start interaction did not exercise AudioContext construction`);
      }
      if (pageErrors.length) {
        failures.push(`${testCase.slug}: AudioContext constructor failure escaped to pageerror: ${pageErrors.join(' | ')}`);
      }
    } catch (error) {
      failures.push(`${testCase.slug}: audio fallback scenario failed: ${error.message}`);
    } finally {
      await page.close();
    }
  }

  if (failures.length) {
    throw new Error(`minigame AudioContext constructor resilience failed:\n- ${failures.join('\n- ')}`);
  }

  console.log(`minigame AudioContext constructor resilience passed (${cases.length} games)`);
} finally {
  if (browser) await browser.close();
  await site.close();
}
