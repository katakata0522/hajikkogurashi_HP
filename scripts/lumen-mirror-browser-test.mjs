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

  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 520 } });
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));

    await page.goto(`http://127.0.0.1:${port}/lumen-mirror/`, { waitUntil: 'networkidle' });
    await page.click('#editor-btn');

    const layout = await page.evaluate(() => {
      const controls = document.querySelector('#editor-controls');
      const rightSidebar = document.querySelector('#editor-sidebar-right');
      const testPlay = document.querySelector('#editor-test-btn');
      const controlsRect = controls.getBoundingClientRect();
      const testPlayRect = testPlay.getBoundingClientRect();

      return {
        footerOverflow: controls.scrollWidth - controls.clientWidth,
        testPlayOutside: Math.max(0, Math.ceil(testPlayRect.right - controlsRect.right)),
        rightOverflow: rightSidebar.scrollHeight - rightSidebar.clientHeight,
      };
    });

    if (errors.length) throw new Error(`editor page errors: ${errors.join(' | ')}`);
    if (layout.footerOverflow > 0 || layout.testPlayOutside > 0 || layout.rightOverflow > 0) {
      throw new Error(`editor controls or inspector are clipped: ${JSON.stringify(layout)}`);
    }

    await page.setViewportSize({ width: 1280, height: 480 });
    await page.reload({ waitUntil: 'networkidle' });
    await page.click('#editor-btn');
    const canvas = await page.locator('#game-canvas').boundingBox();
    await page.mouse.click(canvas.x + (canvas.width * 80 / 600), canvas.y + (canvas.height * 150 / 800));
    const selectedInspectorOverflow = await page.evaluate(() => {
      const rightSidebar = document.querySelector('#editor-sidebar-right');
      return rightSidebar.scrollHeight - rightSidebar.clientHeight;
    });
    if (selectedInspectorOverflow > 0) {
      throw new Error(`selected inspector is clipped in a short workspace: ${selectedInspectorOverflow}px`);
    }

    await page.setViewportSize({ width: 1150, height: 800 });
    await page.reload({ waitUntil: 'networkidle' });
    await page.click('#editor-btn');
    const desktopBoundary = await page.evaluate(() => {
      const rightSidebar = document.querySelector('#editor-sidebar-right').getBoundingClientRect();
      const controls = document.querySelector('#editor-controls');
      return {
        rightOutside: Math.max(0, Math.ceil(rightSidebar.right - window.innerWidth)),
        footerOverflow: controls.scrollWidth - controls.clientWidth,
      };
    });
    if (desktopBoundary.rightOutside > 0 || desktopBoundary.footerOverflow > 0) {
      throw new Error(`desktop breakpoint clips the editor: ${JSON.stringify(desktopBoundary)}`);
    }
  } finally {
    await browser.close();
  }
} finally {
  await new Promise((resolveClose) => server.close(resolveClose));
}
