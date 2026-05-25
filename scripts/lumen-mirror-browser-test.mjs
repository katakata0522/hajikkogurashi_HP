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

function codeFor(data) {
  return `LMN-${Buffer.from(JSON.stringify(data), 'utf8').toString('base64')}`;
}

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
    await page.locator('#prop-ink').fill('1150');
    const selectedInspectorLayout = await page.evaluate(() => {
      const rightSidebar = document.querySelector('#editor-sidebar-right');
      const inkLabel = document.querySelector('#prop-ink').closest('.property-group').querySelector('label');
      return {
        overflow: rightSidebar.scrollHeight - rightSidebar.clientHeight,
        inkLabelHeight: Math.ceil(inkLabel.getBoundingClientRect().height),
        inkLabelOverflow: Math.max(0, Math.ceil(inkLabel.scrollWidth - inkLabel.clientWidth)),
      };
    });
    if (selectedInspectorLayout.overflow > 0 || selectedInspectorLayout.inkLabelHeight > 20 || selectedInspectorLayout.inkLabelOverflow > 0) {
      throw new Error(`selected inspector is clipped or wraps in a short workspace: ${JSON.stringify(selectedInspectorLayout)}`);
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

    const failures = [];
    async function runEditorScenario(name, viewport, scenario) {
      const scenarioPage = await browser.newPage({ viewport });
      const scenarioErrors = [];
      scenarioPage.on('pageerror', (error) => scenarioErrors.push(error.message));
      try {
        await scenarioPage.goto(`http://127.0.0.1:${port}/lumen-mirror/`, { waitUntil: 'networkidle' });
        await scenarioPage.click('#editor-btn');
        await scenario(scenarioPage, failures);
        if (scenarioErrors.length) failures.push(`${name}: page errors: ${scenarioErrors.join(' | ')}`);
      } finally {
        await scenarioPage.close();
      }
    }

    await runEditorScenario('custom info', { width: 1280, height: 720 }, async (scenarioPage) => {
      await scenarioPage.click('#info-chip');
      if (!(await scenarioPage.locator('#info-panel').isVisible())) failures.push('custom info: INFO panel remains hidden');
      const guide = scenarioPage.locator('#info-editor-guide');
      if (!(await guide.isVisible())) {
        failures.push('custom info: editor guide is unavailable');
      } else {
        const guideText = await guide.innerText();
        if (!guideText.includes('TEST_PLAY') || !guideText.includes('SELECT') || !guideText.includes('コード')) {
          failures.push(`custom info: editor guide does not explain the workflow: ${guideText}`);
        }
      }
    });

    await runEditorScenario('accessible editor dialogs', { width: 1280, height: 720 }, async (scenarioPage) => {
      const semantics = await scenarioPage.evaluate(() => ({
        paletteButtons: [...document.querySelectorAll('.palette-item')].every((item) => item.tagName === 'BUTTON'),
        canvasLabel: document.querySelector('#game-canvas')?.getAttribute('aria-label'),
        infoRole: document.querySelector('#info-panel')?.getAttribute('role'),
        modalRole: document.querySelector('#editor-modal')?.getAttribute('role'),
        toastLive: document.querySelector('#toast-container')?.getAttribute('aria-live'),
      }));
      if (!semantics.paletteButtons || !semantics.canvasLabel || semantics.infoRole !== 'dialog'
        || semantics.modalRole !== 'dialog' || semantics.toastLive !== 'polite') {
        failures.push(`accessible editor dialogs: missing semantics: ${JSON.stringify(semantics)}`);
      }

      await scenarioPage.click('#info-chip');
      await scenarioPage.keyboard.press('Escape');
      if (await scenarioPage.locator('#info-panel').isVisible()) {
        failures.push('accessible editor dialogs: Escape does not close INFO');
      }

      await scenarioPage.click('#editor-import-btn');
      const modalFocus = await scenarioPage.evaluate(() => document.activeElement?.id);
      if (modalFocus !== 'modal-textarea') {
        failures.push(`accessible editor dialogs: import focus starts on ${modalFocus}`);
      }
      await scenarioPage.keyboard.press('Escape');
      if (await scenarioPage.locator('#editor-modal').isVisible()) {
        failures.push('accessible editor dialogs: Escape does not close the modal');
      }
    });

    await runEditorScenario('custom test settings', { width: 1280, height: 720 }, async (scenarioPage) => {
      const canvasBox = await scenarioPage.locator('#game-canvas').boundingBox();
      const logicalPoint = (x, y) => ({
        x: canvasBox.x + (canvasBox.width * x / 600),
        y: canvasBox.y + (canvasBox.height * y / 800),
      });
      const prism = logicalPoint(520, 650);
      await scenarioPage.mouse.click(prism.x, prism.y);
      await scenarioPage.click('.color-picker-btn[data-color="#ff003c"]');
      await scenarioPage.locator('#prop-ink').fill('1000');
      await scenarioPage.click('#editor-test-btn');
      const from = logicalPoint(50, 400);
      const to = logicalPoint(530, 400);
      await scenarioPage.mouse.move(from.x, from.y);
      await scenarioPage.mouse.down();
      await scenarioPage.mouse.move(to.x, to.y);
      await scenarioPage.mouse.up();
      const stability = await scenarioPage.locator('#stability-value').innerText();
      if (stability !== '52.0%') failures.push(`custom test settings: expected 52.0% ink, got ${stability}`);
      await scenarioPage.click('#editor-back-btn');
      await scenarioPage.mouse.click(prism.x, prism.y);
      const returnedColor = await scenarioPage.locator('.color-picker-btn.active').getAttribute('data-color');
      if (returnedColor !== '#ff003c') failures.push(`custom test settings: prism color returned as ${returnedColor}`);
    });

    await runEditorScenario('custom emit', { width: 1280, height: 720 }, async (scenarioPage) => {
      await scenarioPage.click('#editor-test-btn');
      await scenarioPage.click('#editor-test-btn');
      if (!(await scenarioPage.locator('#editor-test-btn').isDisabled())) {
        failures.push('custom emit: EMIT does not enter emitting state');
      }
    });

    await runEditorScenario('invalid import', { width: 1280, height: 720 }, async (scenarioPage) => {
      const invalidCode = codeFor({
        v: 2,
        ink: 500,
        emitter: { x: 80, y: 150, angle: 0 },
        prism: { x: 520, y: 650, radius: 20, color: null },
        blocks: 'not-an-array',
      });
      await scenarioPage.click('#editor-import-btn');
      await scenarioPage.locator('#modal-textarea').fill(invalidCode);
      await scenarioPage.click('#modal-action-btn');
      if (!(await scenarioPage.locator('#modal-error').isVisible())) {
        failures.push('invalid import: malformed stage code is not rejected in the modal');
      }
    });

    await runEditorScenario('legacy import', { width: 1280, height: 720 }, async (scenarioPage) => {
      const legacyCode = codeFor({
        v: 2,
        ink: 1000,
        emitter: { x: 80, y: 150, angle: 0 },
        prism: { x: 520, y: 650, radius: 20, color: '#ff003c' },
        blackholes: [], portals: [], blocks: [], colorFilters: [],
      });
      await scenarioPage.click('#editor-import-btn');
      await scenarioPage.locator('#modal-textarea').fill(legacyCode);
      await scenarioPage.click('#modal-action-btn');
      const canvasBox = await scenarioPage.locator('#game-canvas').boundingBox();
      await scenarioPage.mouse.click(
        canvasBox.x + (canvasBox.width * 520 / 600),
        canvasBox.y + (canvasBox.height * 650 / 800),
      );
      const settings = await scenarioPage.evaluate(() => ({
        ink: document.querySelector('#prop-ink-val').textContent,
        color: document.querySelector('.color-picker-btn.active')?.dataset.color,
      }));
      if (settings.ink !== '1000' || settings.color !== '#ff003c') {
        failures.push(`legacy import: settings were not preserved: ${JSON.stringify(settings)}`);
      }
    });

    await runEditorScenario('creator safety controls', { width: 1280, height: 720 }, async (scenarioPage) => {
      if (await scenarioPage.locator('#editor-undo-btn').count() === 0
        || await scenarioPage.locator('#editor-stage-preview').count() === 0) {
        failures.push('creator safety controls: undo and preview controls are unavailable');
        return;
      }
      await scenarioPage.click('.palette-item[data-type="block"]');
      const canvasBox = await scenarioPage.locator('#game-canvas').boundingBox();
      await scenarioPage.mouse.click(canvasBox.x + canvasBox.width * 0.5, canvasBox.y + canvasBox.height * 0.45);
      let preview = await scenarioPage.locator('#editor-stage-preview').innerText();
      if (!preview.includes('BLOCK 1')) failures.push(`creator safety controls: placement is not summarized: ${preview}`);
      await scenarioPage.click('#editor-clear-btn');
      if (!(await scenarioPage.locator('#editor-modal').isVisible())) {
        failures.push('creator safety controls: CLEAR_ALL has no confirmation');
        return;
      }
      await scenarioPage.click('#modal-action-btn');
      preview = await scenarioPage.locator('#editor-stage-preview').innerText();
      if (!preview.includes('BLOCK 0')) failures.push(`creator safety controls: clear did not update preview: ${preview}`);
      await scenarioPage.click('#editor-undo-btn');
      preview = await scenarioPage.locator('#editor-stage-preview').innerText();
      if (!preview.includes('BLOCK 1')) failures.push(`creator safety controls: undo did not restore placement: ${preview}`);
      await scenarioPage.click('#editor-redo-btn');
      preview = await scenarioPage.locator('#editor-stage-preview').innerText();
      if (!preview.includes('BLOCK 0')) failures.push(`creator safety controls: redo did not reapply clear: ${preview}`);
    });

    await runEditorScenario('draft restore and named share', { width: 1280, height: 720 }, async (scenarioPage) => {
      if (await scenarioPage.locator('#prop-title').count() === 0
        || await scenarioPage.locator('#editor-share-status').count() === 0) {
        failures.push('draft restore and named share: title or workflow status is unavailable');
        return;
      }
      await scenarioPage.locator('#prop-title').fill('NEON_ROUTE');
      await scenarioPage.locator('#prop-title').blur();
      await scenarioPage.reload({ waitUntil: 'networkidle' });
      await scenarioPage.click('#editor-btn');
      const restoredTitle = await scenarioPage.locator('#prop-title').inputValue();
      if (restoredTitle !== 'NEON_ROUTE') failures.push(`draft restore and named share: draft title restored as ${restoredTitle}`);

      const alignedCode = codeFor({
        v: 4,
        title: 'NEON_ROUTE',
        inkCapacity: 500,
        emitter: { x: 80, y: 150, angle: 0 },
        prism: { x: 520, y: 150, radius: 20, targetColor: null },
        blackholes: [], portals: [], blocks: [], colorFilters: [],
      });
      await scenarioPage.click('#editor-import-btn');
      await scenarioPage.locator('#modal-textarea').fill(alignedCode);
      await scenarioPage.click('#modal-action-btn');
      const statusBefore = await scenarioPage.locator('#editor-share-status').innerText();
      if (!statusBefore.includes('TEST_REQUIRED')) failures.push(`draft restore and named share: initial status is ${statusBefore}`);
      await scenarioPage.click('#editor-test-btn');
      await scenarioPage.click('#editor-test-btn');
      await scenarioPage.waitForSelector('#overlay:not(.hidden)');
      await scenarioPage.click('#next-btn');
      const statusAfter = await scenarioPage.locator('#editor-share-status').innerText();
      if (!statusAfter.includes('READY_TO_SHARE')) failures.push(`draft restore and named share: cleared status is ${statusAfter}`);
      await scenarioPage.click('#editor-export-btn');
      const shareText = await scenarioPage.locator('#modal-textarea').inputValue();
      if (!shareText.includes('NEON_ROUTE') || !shareText.includes('LMN-')) {
        failures.push(`draft restore and named share: export lacks readable share detail: ${shareText}`);
      }
      await scenarioPage.click('#modal-cancel-btn');
      await scenarioPage.locator('#prop-title').fill('NEON_ROUTE_2');
      await scenarioPage.locator('#prop-title').blur();
      const invalidatedStatus = await scenarioPage.locator('#editor-share-status').innerText();
      if (!invalidatedStatus.includes('TEST_REQUIRED') || !(await scenarioPage.locator('#editor-export-btn').isDisabled())) {
        failures.push(`draft restore and named share: edits do not invalidate clear verification: ${invalidatedStatus}`);
      }
    });

    for (const viewport of [
      { name: 'tablet', width: 1024, height: 768 },
      { name: 'phone', width: 390, height: 844 },
    ]) {
      await runEditorScenario(`${viewport.name} editor`, viewport, async (scenarioPage) => {
        const visibility = await scenarioPage.evaluate(() => {
          const visible = (selector) => {
            const element = document.querySelector(selector);
            const rect = element.getBoundingClientRect();
            return getComputedStyle(element).display !== 'none' && rect.width > 0 && rect.height > 0;
          };
          return {
            palette: visible('#editor-sidebar-left'),
            inspector: visible('#editor-sidebar-right'),
            importButton: visible('#editor-import-btn'),
          };
        });
        if (!visibility.palette || !visibility.inspector || !visibility.importButton) {
          failures.push(`${viewport.name} editor: editing controls are unavailable: ${JSON.stringify(visibility)}`);
        }
        if (viewport.name === 'phone') {
          await scenarioPage.click('#info-chip');
          const infoScroll = await scenarioPage.evaluate(() => {
            const panel = document.querySelector('#info-panel');
            const style = getComputedStyle(panel);
            return {
              needsScroll: panel.scrollHeight > panel.clientHeight,
              touchAction: style.touchAction,
            };
          });
          if (infoScroll.needsScroll && infoScroll.touchAction === 'none') {
            failures.push(`phone editor: INFO cannot be touch-scrolled: ${JSON.stringify(infoScroll)}`);
          }
        }
      });
    }

    if (failures.length) throw new Error(`editor regression failures:\n- ${failures.join('\n- ')}`);
  } finally {
    await browser.close();
  }
} finally {
  await new Promise((resolveClose) => server.close(resolveClose));
}
