import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
import { sitePages } from './site-config.mjs';
import { startStaticSiteServer } from './test-support/static-site-server.mjs';

const root = resolve(import.meta.dirname,'..');
const screenshots = process.env.SITE_SCREENSHOT_DIR ? resolve(process.env.SITE_SCREENSHOT_DIR) : null;
if (screenshots) mkdirSync(screenshots,{recursive:true});
const site = await startStaticSiteServer(root);
const browser = await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH || chromium.executablePath()});
const failures = [];
let views = 0;
const dimensions = [320,375,390,768,1024,1440];
async function visit(page,url) {
  const response = await page.goto(site.origin+url,{waitUntil:'networkidle'});
  assert.equal(response.status(),200);
  await page.evaluate(() => document.fonts.ready);
}
try {
  for (const width of dimensions) {
    const context = await browser.newContext({viewport:{width,height:width<600?844:1000},isMobile:width<600,hasTouch:width<600,reducedMotion:'reduce'});
    const page = await context.newPage();
    page.setDefaultTimeout(5000);page.setDefaultNavigationTimeout(10000);
    const errors = [];
    page.on('pageerror',error => errors.push(error.message));
    page.on('response',response => { if(response.url().startsWith(site.origin) && response.status()>=400) errors.push(`${response.status()} ${response.url()}`); });
    // Remote fonts are optional, and not a prerequisite for navigation or local rendering.
    await page.route('https://fonts.googleapis.com/**',route => route.abort());
    for (const route of ['/',...sitePages.filter(name => name!=='index.html').map(name => '/'+name)]) {
      try {
        console.log(`checking ${width}px ${route}`);await visit(page,route);views++;
        const layout = await page.evaluate(() => {
          const header = document.querySelector('.site-header');
          const hero = document.querySelector('.hero-copy');
          return {width:innerWidth,scroll:document.documentElement.scrollWidth,header:header.getBoundingClientRect().toJSON(),hero:hero?.getBoundingClientRect().toJSON(),h1:document.querySelectorAll('h1').length};
        });
        assert.ok(layout.scroll<=width+1,`${route} ${width}: horizontal overflow ${layout.scroll}`);
        assert.equal(layout.h1,1,`${route}: one H1`);
        assert.ok(layout.header.height>=60 && layout.header.height<=85,`${route}: header height ${layout.header.height}`);
        if (layout.hero) assert.ok(layout.hero.right<=width+1,`hero column clipped: ${layout.hero.right}`);
        if (width<861) {
          await page.locator('.menu-toggle').click();
          await page.waitForFunction(() => document.querySelector('.mobile-menu').contains(document.activeElement)).catch(error=>{throw new Error('opening menu focus: '+error.message);});
          assert.equal(await page.locator('main').evaluate(element => element.inert),true);
          assert.equal(await page.locator('.mobile-menu').evaluate(element => element.inert),false);
          await page.locator('.mobile-menu a').last().focus();await page.keyboard.press('Tab');
          assert.equal(await page.evaluate(() => document.activeElement.className),'menu-toggle');
          await page.keyboard.press('Shift+Tab');
          assert.equal(await page.evaluate(() => document.activeElement === document.querySelector('.mobile-menu a:last-of-type')),true);
          await page.keyboard.press('Escape');
          assert.equal(await page.locator('.menu-toggle').getAttribute('aria-expanded'),'false');
          assert.equal(await page.evaluate(() => document.activeElement.className),'menu-toggle');
          assert.equal(await page.locator('main').evaluate(element => element.inert),false);
          if(route==='/') {
            await page.locator('.menu-toggle').click();
            if(screenshots && width===390) await page.screenshot({path:resolve(screenshots,'menu-390.png')});
            await page.locator('.mobile-menu a[href="#about"]').click();
            await page.waitForFunction(() => location.hash==='#about').catch(error=>{throw new Error('about anchor navigation: '+error.message);});
            assert.equal(await page.evaluate(() => document.activeElement.id),'about');
            assert.ok(await page.locator('#about').evaluate(element => element.getBoundingClientRect().top)>=60,'anchor must clear the fixed header');
          } else {
            const current = await page.locator('.mobile-menu a[aria-current="page"]').count();
            if(['aboutus','portfolio','minigames','news','members'].some(name => route===`/${name}.html`)) assert.equal(current,1);
          }
        }
        if(screenshots && [1440,390].includes(width) && ['/', '/aboutus.html','/portfolio.html','/members.html','/minigames.html'].includes(route)) {
          await page.goto(site.origin+route);await page.evaluate(()=>document.fonts.ready);
          const name=route==='/'?'home':route.slice(1,-5);
          await page.screenshot({path:resolve(screenshots,`${name}-${width}.png`)});
          if(route==='/') await page.screenshot({path:resolve(screenshots,`home-full-${width}.png`),fullPage:true});
        }
      } catch(error) {console.error(`${width}px ${route}: ${error.message}`);failures.push(`${width}px ${route}: ${error.message}`);}
    }
    if(errors.length) failures.push(`${width}px browser errors: ${errors.join(' | ')}`);
    await context.close();
  }
  const page = await browser.newPage({viewport:{width:390,height:320},reducedMotion:'reduce'});
  await visit(page,'/');
  await page.locator('.menu-toggle').focus();
  await page.evaluate(()=>window.scrollTo(0,500));
  const originalScroll=await page.evaluate(()=>scrollY);
  await page.locator('.menu-toggle').focus();await page.keyboard.press('Enter');
  await page.locator('.mobile-menu a[href="#contact"]').scrollIntoViewIfNeeded();
  assert.ok(await page.locator('.mobile-menu a[href="#contact"]').isVisible(),'contact reachable in short viewport');
  await page.keyboard.press('Escape');
  assert.equal(await page.evaluate(()=>scrollY),originalScroll,'close restores scroll exactly');
  await page.locator('.menu-toggle').click();await page.setViewportSize({width:1024,height:768});
  assert.equal(await page.locator('.menu-toggle').getAttribute('aria-expanded'),'false');
  assert.equal(await page.evaluate(()=>document.activeElement.className),'brand');
  assert.equal(await page.locator('main').evaluate(element=>element.inert),false);
  await page.close();
  const journey = await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce'});
  await journey.route('https://fonts.googleapis.com/**',route=>route.abort());
  await visit(journey,'/');
  await journey.locator('.line-link[href="/portfolio.html"]').click();
  await journey.waitForURL(site.origin+'/portfolio.html');
  await journey.locator('.menu-toggle').click();
  await journey.locator('.mobile-menu a[href="/members.html"]').click();
  await journey.waitForURL(site.origin+'/members.html');
  assert.equal(await journey.locator('.member-card').count(),7,'all existing member profiles remain available');
  await journey.locator('.menu-toggle').click();
  await journey.locator('.mobile-menu a[href="/minigames.html"]').click();
  await journey.waitForURL(site.origin+'/minigames.html');
  assert.ok(await journey.locator('a[href="/kanji-slicer/"]').count()>0,'game catalog destination retained');
  await journey.close();
  const noJs=await browser.newPage({javaScriptEnabled:false,viewport:{width:390,height:844}});
  await visit(noJs,'/');assert.ok(await noJs.locator('h1').isVisible());assert.equal(await noJs.locator('a[href="/portfolio.html"]').count(),1);await noJs.close();
  assert.deepEqual(failures,[]);
  console.log(`site browser regression passed (${views} views; focus, menu, anchors, resize, short viewport, no-JS content)`);
}finally{await browser.close();await site.close();}
