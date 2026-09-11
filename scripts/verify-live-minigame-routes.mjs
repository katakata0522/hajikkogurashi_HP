import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { extractPublishedSlugs } from './test-support/published-minigames.mjs';

const root = resolve(import.meta.dirname, '..');
const baseUrl = new URL(process.argv[2] || 'https://hajikkoroom.xsrv.jp/');
const expectedSha = process.argv[3] || process.env.GITHUB_SHA || 'unknown';
const catalog = readFileSync(resolve(root, 'minigames.html'), 'utf8');
const published = extractPublishedSlugs(catalog);

if (!published.length) {
  throw new Error('no published minigames found in minigames.html');
}

async function verifyRoute(slug) {
  const url = new URL(`${slug}/`, baseUrl);
  let lastError;

  for (let attempt = 1; attempt <= 4; attempt += 1) {
    url.searchParams.set('deploy_check', `${expectedSha}-${attempt}`);
    try {
      const response = await fetch(url, {
        redirect: 'follow',
        cache: 'no-store',
        signal: AbortSignal.timeout(10_000),
        headers: { 'user-agent': 'corner-neighbor-deploy-verifier/1.0' },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const contentType = response.headers.get('content-type') || '';
      if (!contentType.toLowerCase().includes('text/html')) {
        throw new Error(`unexpected content-type: ${contentType || '(missing)'}`);
      }

      const body = await response.text();
      const title = body.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/\s+/g, ' ').trim() || '';
      if (!title) {
        throw new Error('HTML title is missing or empty');
      }
      if (!/<body\b/i.test(body)) {
        throw new Error('HTML body element is missing');
      }

      console.log(`live route verified: ${slug} -> ${response.status} (${title})`);
      return;
    } catch (error) {
      lastError = error;
      if (attempt < 4) {
        await new Promise((resolveDelay) => setTimeout(resolveDelay, attempt * 1500));
      }
    }
  }

  throw new Error(`${slug}: ${lastError?.message || 'unknown live-route failure'}`);
}

const failures = [];
for (const slug of published) {
  try {
    await verifyRoute(slug);
  } catch (error) {
    failures.push(error.message);
  }
}

if (failures.length) {
  throw new Error(`live minigame route verification failed:\n- ${failures.join('\n- ')}`);
}

console.log(`all published live minigame routes verified (${published.length} games)`);
