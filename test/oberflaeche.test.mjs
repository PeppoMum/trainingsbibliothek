// Oberfläche im Browser (Vorschau ohne Firebase): alle Seiten bei allen Breiten hell und dunkel,
// dazu die wichtigsten Abläufe. Läuft vor jedem Hochladen.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const WURZEL = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');
const TYP = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.pdf': 'application/pdf', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json' };
let server, adresse, browser, daten;

before(async () => {
  daten = JSON.parse(await readFile(path.join(WURZEL, 'daten', 'vorschlaege.json'), 'utf8'));
  server = http.createServer(async (req, res) => {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (p === '/') p = '/index.html';
    // Vorschau erzwingen: ohne Firebase-Zugang, Daten aus daten/vorschlaege.json
    if (p === '/firebase-config.js') { res.writeHead(200, { 'content-type': 'text/javascript' }); return res.end("export const FIREBASE_CONFIG = { apiKey: '' }; export const ADMIN_HASHES = [];"); }
    if (p === '/stand/stand.json') { res.writeHead(404); return res.end(); }
    const datei = path.join(WURZEL, path.normalize(p));
    if (!datei.startsWith(WURZEL)) { res.writeHead(403); return res.end(); }
    try { const d = await readFile(datei); res.writeHead(200, { 'content-type': TYP[path.extname(datei)] || 'application/octet-stream' }); res.end(d); }
    catch { res.writeHead(404); res.end(); }
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  adresse = `http://127.0.0.1:${server.address().port}/`;
  browser = await chromium.launch();
});
after(async () => { await browser?.close(); server?.close(); });

async function seiteOeffnen(breite, dunkel = false) {
  const ctx = await browser.newContext({ viewport: { width: breite, height: breite <= 760 ? 844 : 900 }, colorScheme: dunkel ? 'dark' : 'light' });
  const page = await ctx.newPage();
  const fehler = [];
  page.on('pageerror', e => fehler.push(e.message));
  page.on('dialog', d => d.accept());
  await page.goto(adresse);
  await page.waitForSelector('.kachel');
  return { ctx, page, fehler };
}
const geh = async (page, hash) => { await page.evaluate(h => { location.hash = h; }, hash); await page.waitForTimeout(150); };

test('alle Seiten: keine Fehler, nichts ragt seitlich heraus', async () => {
  const k = daten.uebungen.find(u => u.varianten.length > 1);
  const e = daten.einheiten[daten.einheiten.length - 1];
  const ym = e.datum.slice(0, 7);
  const routen = ['#/', '#/suche?q=rondo', '#/gruppe/Taktik', '#/liste/schwerpunkt/Zusammenspiel', '#/liste/alle/alle', `#/uebung/${k.id}`,
    '#/einheiten/liste', `#/einheiten/monat/${ym}`, `#/einheit/${e.id}`, `#/einheit/${e.id}/ganz`, '#/merkliste', '#/listen', '#/filter',
    '#/pruefen', '#/pruefen/offen/offen', `#/pruefen/karte/${k.id}/offen`, `#/bearbeiten/${k.id}`, `#/bearbeiten/${k.id}/text/0`,
    `#/bearbeiten/${k.id}/zusammenlegen`, `#/einheit/${e.id}/bearbeiten`, '#/papierkorb'];
  for (const breite of [360, 390, 820, 1180, 1440]) {
    for (const dunkel of [false, true]) {
      const { ctx, page, fehler } = await seiteOeffnen(breite, dunkel);
      for (const r of routen) {
        await geh(page, r);
        const info = await page.evaluate(() => ({ ueber: document.documentElement.scrollWidth - window.innerWidth, h1: document.querySelector('h1')?.textContent || '' }));
        assert.ok(info.ueber <= 0, `${r} bei ${breite} px ragt ${info.ueber} px heraus`);
        assert.ok(info.h1 && info.h1 !== 'Nicht gefunden', `${r} bei ${breite} px: Überschrift „${info.h1}“`);
      }
      assert.deepEqual(fehler, [], `Fehler bei ${breite} px`);
      await ctx.close();
    }
  }
});

test('Suche beim Tippen, Zurück an dieselbe Stelle', async () => {
  const { ctx, page, fehler } = await seiteOeffnen(390);
  await page.click('[data-suchfeld]');
  await page.keyboard.type('rondo', { delay: 30 });
  await page.waitForTimeout(200);
  assert.equal(await page.evaluate(() => location.hash), '#/suche?q=rondo');
  assert.ok(await page.evaluate(() => document.activeElement?.matches('[data-suchfeld]')), 'Suchfeld behält den Fokus');
  assert.ok(await page.locator('#unter .ukarte').count() > 0);
  await geh(page, '#/liste/alle/alle');
  await page.evaluate(() => window.scrollTo(0, 2500)); await page.waitForTimeout(150);
  await page.locator('.ukarte a').nth(30).click(); await page.waitForTimeout(150);
  assert.equal(await page.evaluate(() => window.scrollY), 0, 'neue Seite beginnt oben');
  await page.click('[data-zurueck]'); await page.waitForTimeout(300);
  assert.ok(Math.abs(await page.evaluate(() => window.scrollY) - 2500) < 5, 'Zurück an dieselbe Stelle');
  await geh(page, '#/suche?q=' + encodeURIComponent('4+1'));
  assert.equal(await page.inputValue('[data-suchfeld]'), '4+1');
  assert.deepEqual(fehler, []);
  await ctx.close();
});

test('Skizze groß: Zurück und Esc schließen', async () => {
  const k = daten.uebungen.find(u => u.varianten.some(v => (v.skizzen || []).length));
  const { ctx, page } = await seiteOeffnen(390);
  await geh(page, `#/uebung/${k.id}`);
  await page.click('.skizze');
  assert.ok(await page.isVisible('#vollbild'));
  await page.goBack(); await page.waitForTimeout(150);
  assert.ok(!(await page.isVisible('#vollbild')));
  assert.equal(await page.evaluate(() => location.hash), `#/uebung/${k.id}`);
  await page.click('.skizze'); await page.keyboard.press('Escape');
  assert.ok(!(await page.isVisible('#vollbild')));
  await ctx.close();
});

test('Merkliste und Filter bleiben nach dem Neuladen', async () => {
  const k = daten.uebungen[0];
  const { ctx, page } = await seiteOeffnen(390);
  await geh(page, `#/uebung/${k.id}`);
  await page.click('[data-merken]');
  await geh(page, '#/filter');
  await page.click('details[data-fkey="form"] summary');
  await page.click('[data-filter="form|Spielform"]');
  await page.reload(); await page.waitForSelector('h1');
  await geh(page, '#/merkliste');
  assert.equal(await page.locator('.merkliste .ukarte').count(), 1);
  await geh(page, '#/');
  assert.ok(await page.isVisible('[data-filter-weg]'), 'Filter-Hinweis sichtbar');
  await ctx.close();
});

test('Prüfen: angesehen und weiter, Haken bleiben beim Neuzeichnen', async () => {
  const { ctx, page } = await seiteOeffnen(390);
  await geh(page, '#/pruefen/offen/offen');
  await page.locator('.ukarte a').first().click(); await page.waitForTimeout(150);
  const vorher = await page.evaluate(() => location.hash);
  await page.click('[data-weiter$="|1"]'); await page.waitForTimeout(200);
  assert.notEqual(await page.evaluate(() => location.hash), vorher);
  await geh(page, '#/pruefen');
  assert.match(await page.locator('.abkopf .unter').first().textContent(), /^1 von/);
  await ctx.close();
});
