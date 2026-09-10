import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { extname, join, resolve } from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const root = resolve(import.meta.dirname, '..');
const mimeTypes = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
]);

function serveFile(req, res) {
  const url = new URL(req.url, 'http://127.0.0.1');
  let filePath = join(root, decodeURIComponent(url.pathname));
  if (url.pathname.endsWith('/')) filePath = join(filePath, 'index.html');

  if (!filePath.startsWith(root) || !existsSync(filePath) || !statSync(filePath).isFile()) {
    res.writeHead(404);
    res.end('Not found');
    return;
  }

  res.writeHead(200, { 'content-type': mimeTypes.get(extname(filePath)) ?? 'application/octet-stream' });
  createReadStream(filePath).pipe(res);
}

const server = createServer(serveFile);
await new Promise((resolveListen) => server.listen(0, '127.0.0.1', resolveListen));
const { port } = server.address();

try {
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  });

  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));

  await page.addInitScript(() => {
    Object.defineProperties(Storage.prototype, {
      getItem: {
        value() { throw new Error('blocked getItem'); },
        configurable: true,
      },
      setItem: {
        value() { throw new Error('blocked setItem'); },
        configurable: true,
      },
      removeItem: {
        value() { throw new Error('blocked removeItem'); },
        configurable: true,
      },
      clear: {
        value() { throw new Error('blocked clear'); },
        configurable: true,
      },
    });
  });

  await page.goto(`http://127.0.0.1:${port}/lumen-mirror/`, { waitUntil: 'networkidle' });

  const startup = await page.evaluate(() => ({
    guard: window.__CORNER_NEIGHBOR_STORAGE_GUARD__ === true,
    titleVisible: !document.querySelector('#start-screen')?.classList.contains('hidden'),
    editorButton: Boolean(document.querySelector('#editor-btn')),
  }));
  if (!startup.guard || !startup.titleVisible || !startup.editorButton || errors.length) {
    throw new Error(`blocked-storage startup failed: ${JSON.stringify({ startup, errors })}`);
  }

  await page.click('#editor-btn');
  await page.waitForTimeout(200);

  const editor = await page.evaluate(() => ({
    editorControlsVisible: !document.querySelector('#editor-controls')?.classList.contains('hidden'),
    editorLeftVisible: !document.querySelector('#editor-sidebar-left')?.classList.contains('hidden'),
    draftStatus: document.querySelector('#draft-status')?.textContent?.trim() || '',
  }));
  if (!editor.editorControlsVisible || !editor.editorLeftVisible || errors.length) {
    throw new Error(`blocked-storage editor entry failed: ${JSON.stringify({ editor, errors })}`);
  }

  await browser.close();
  console.log('lumen blocked-storage browser test passed');
} finally {
  server.close();
}
