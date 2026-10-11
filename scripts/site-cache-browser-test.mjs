import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
import { pageAssets } from './site-config.mjs';
import { validateVersionedAssets, verifyLiveVersionedAssets } from './test-support/versioned-assets.mjs';

const root = resolve(import.meta.dirname,'..');
const read = file => readFileSync(resolve(root,file));
const html = read('index.html').toString();
const specs = pageAssets('index.html');
const refs = validateVersionedAssets(html,read,specs,'https://site.invalid/');
const oldHtml = refs.reduce((text,{file,digest})=>text.replace(`/${file}?v=${digest}`,`/${file}?v=20261009`),html);
const oldCss = 'body{margin:0}.hero-copy{width:590px}.site-header{height:66px}';
let published = false;
const requests = [];
const server = createServer((req,res) => {
  const url = new URL(req.url,'http://127.0.0.1');
  requests.push({url:url.pathname+url.search,published});
  if(url.pathname==='/blank.html') {res.writeHead(200,{'content-type':'text/html','cache-control':'no-store'});res.end('<!doctype html><title>Between visits</title>');return;}
  if(['/', '/index.html'].includes(url.pathname)) {res.writeHead(200,{'content-type':'text/html','cache-control':'no-cache'});res.end(published?html:oldHtml);return;}
  const ref = refs.find(ref=>url.pathname===`/${ref.file}`);
  if(!ref) {res.writeHead(404);res.end();return;}
  res.writeHead(200,{'content-type':ref.file.endsWith('.css')?'text/css':'text/javascript','cache-control':'max-age=604800'});
  res.end(url.search===`?v=${ref.digest}` ? read(ref.file) : ref.file.endsWith('.css') ? oldCss : 'window.__oldSiteScript=true');
});
await new Promise(done=>server.listen(0,'127.0.0.1',done));
const origin=`http://127.0.0.1:${server.address().port}`;
let browser;
try {
  browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH || chromium.executablePath()});
  const page=await browser.newPage({viewport:{width:390,height:844},reducedMotion:'reduce'});
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto(origin,{waitUntil:'networkidle'});
  assert.equal(await page.locator('.hero-copy').evaluate(element=>element.getBoundingClientRect().width),590);
  assert.equal(await page.evaluate(()=>window.__oldSiteScript),true);
  await page.evaluate(()=>{localStorage.setItem('kanjislicer_best','123');localStorage.setItem('kanjislicer_discovered','["火山"]');});
  // Keep the same browser/context, HTTP cache and local storage across visits.
  await page.goto(origin+'/blank.html');published=true;
  await page.goto(origin,{waitUntil:'networkidle'});
  assert.equal(await page.locator('.hero-copy').evaluate(element=>element.getBoundingClientRect().width),350);
  assert.equal(await page.evaluate(()=>window.__oldSiteScript),undefined);
  assert.equal(await page.evaluate(()=>localStorage.getItem('kanjislicer_best')),'123');
  assert.equal(await page.evaluate(()=>localStorage.getItem('kanjislicer_discovered')),'["火山"]');
  await page.locator('.menu-toggle').click();
  assert.equal(await page.locator('main').evaluate(element=>element.inert),true);
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('main').evaluate(element=>element.inert),false);
  for(const {file,digest} of refs) {
    assert.ok(requests.some(req=>req.published && req.url===`/${file}?v=${digest}`),`${file}: fresh URL requested`);
    assert.equal(requests.some(req=>req.published && req.url===`/${file}?v=20261009`),false);
  }
  const stillCached=await page.evaluate(async()=> (await fetch('/assets/css/home-v2.css?v=20261009')).text());
  assert.equal(stillCached,oldCss,'the old response remains cached, so clearing cache cannot mask failure');
  assert.equal(requests.some(req=>req.published && req.url==='/assets/css/home-v2.css?v=20261009'),false);
  assert.deepEqual(errors,[]);
  const response=await fetch(origin);
  await verifyLiveVersionedAssets(response,await response.text(),read,specs);
  console.log('site returning-visitor cache regression passed (old cache retained; fresh assets, menu and saved game data verified)');
}finally{await browser?.close();await new Promise(done=>server.close(done));}
