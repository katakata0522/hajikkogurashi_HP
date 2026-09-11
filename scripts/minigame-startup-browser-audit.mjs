import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { extractPublishedSlugs } from './test-support/published-minigames.mjs';
import { startStaticSiteServer } from './test-support/static-site-server.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const root = resolve(import.meta.dirname, '..');
const catalog = readFileSync(resolve(root, 'minigames.html'), 'utf8');
const published = extractPublishedSlugs(catalog);

if (!published.length) {
  throw new Error('no published minigames found in minigames.html');
}

const site = await startStaticSiteServer(root);
let browser;
try {
  browser = await chromium.launch({
    headless: true,
    executablePath: process.env.CHROME_PATH || chromium.executablePath(),
  });

  const failures = [];

  for (const slug of published) {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const pageErrors = [];
    const consoleErrors = [];
    const localHttpErrors = [];
    const requestFailures = [];

    page.on('pageerror', (error) => pageErrors.push(error.message));
    page.on('console', (message) => {
      if (message.type() !== 'error') return;
      const text = message.text();
      if (text.includes('Failed to load resource')) return;
      consoleErrors.push(text);
    });
    page.on('response', (response) => {
      const url = response.url();
      if (url.startsWith(site.origin) && response.status() >= 400) {
        localHttpErrors.push(`${response.status()} ${url.slice(site.origin.length)}`);
      }
    });
    page.on('requestfailed', (request) => {
      const url = request.url();
      if (url.startsWith(site.origin)) {
        requestFailures.push(`${request.failure()?.errorText ?? 'request failed'} ${url.slice(site.origin.length)}`);
      }
    });

    try {
      const response = await page.goto(`${site.origin}/${slug}/`, {
        waitUntil: 'domcontentloaded',
        timeout: 20_000,
      });
      await page.waitForTimeout(700);

      if (!response || !response.ok()) {
        failures.push(`${slug}: document response ${response?.status() ?? 'missing'}`);
      }

      const visibleState = await page.evaluate(() => ({
        title: document.title.trim(),
        bodyTextLength: document.body?.innerText?.trim().length ?? 0,
        hasBody: Boolean(document.body),
      }));

      if (!visibleState.hasBody || visibleState.bodyTextLength === 0 || visibleState.title.length === 0) {
        failures.push(`${slug}: startup document is not meaningfully rendered (${JSON.stringify(visibleState)})`);
      }
      if (pageErrors.length) failures.push(`${slug}: pageerror: ${pageErrors.join(' | ')}`);
      if (consoleErrors.length) failures.push(`${slug}: console.error: ${consoleErrors.join(' | ')}`);
      if (localHttpErrors.length) failures.push(`${slug}: same-origin HTTP error: ${localHttpErrors.join(' | ')}`);
      if (requestFailures.length) failures.push(`${slug}: same-origin request failure: ${requestFailures.join(' | ')}`);
    } catch (error) {
      failures.push(`${slug}: startup audit exception: ${error.message}`);
    } finally {
      await page.close();
    }
  }

  if (failures.length) {
    throw new Error(`published minigame startup audit failed:\n- ${failures.join('\n- ')}`);
  }

  console.log(`published minigame startup browser audit passed (${published.length} games: ${published.join(', ')})`);
} finally {
  if (browser) await browser.close();
  await site.close();
}
