#!/usr/bin/env node
// Render every beat of a built deck in headless Chrome: screenshots, a contact sheet,
// scene thumbnails (for the overview grid and ctx.thumb), and a list of console errors.
//
//   node scripts/snap.mjs <deck-dir> [--html dist/x.html] [--only id[,id]] [--frames] [--transitions] [--no-thumbs] [--w 1920 --h 1080]
//
// Writes <deck-dir>/snaps/NN-id-bK.jpg, <deck-dir>/snaps/contact.jpg, <deck-dir>/.thumbs/thumb-id.jpg
// Exit code 1 if the page logged errors.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const SKILL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const flag = (n) => args.includes('--' + n);
const opt = (n, d = null) => { const i = args.indexOf('--' + n); return i >= 0 ? args[i + 1] : d; };
const VALUE_OPTS = ['--html', '--only', '--w', '--h'];
const positional = args.filter((a, i) => !a.startsWith('--') && !VALUE_OPTS.includes(args[i - 1]));
const deckDir = path.resolve(positional[0] || '.');
const W = +opt('w', 1920), H = +opt('h', 1080);

async function loadPlaywright() {
  const req = createRequire(path.join(SKILL, 'package.json'));
  for (const name of ['playwright-core', 'playwright']) {
    try { return req(name); } catch { /* next */ }
    try { return await import(name); } catch { /* next */ }
  }
  for (const p of ['/opt/npm-tools/node_modules/playwright', '/usr/lib/node_modules/playwright', '/usr/local/lib/node_modules/playwright']) {
    try { return createRequire(p + '/package.json')(p); } catch { /* next */ }
  }
  console.error('Playwright not found. Run: npm install --prefix ' + SKILL + ' playwright-core');
  process.exit(1);
}
function findChrome() {
  const c = [process.env.CHROME_PATH, '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', 'C:/Program Files/Google/Chrome/Application/chrome.exe'];
  return c.find((p) => p && fs.existsSync(p)) || null;
}

const pw = await loadPlaywright();
const chromium = pw.chromium || (pw.default && pw.default.chromium);
let html = opt('html');
if (!html) {
  const dist = path.join(deckDir, 'dist');
  html = fs.existsSync(dist) ? fs.readdirSync(dist).filter((f) => f.endsWith('.html')).map((f) => path.join(dist, f))[0] : null;
}
if (!html || !fs.existsSync(html)) { console.error('No built HTML found. Run build.mjs first (or pass --html).'); process.exit(1); }
html = path.resolve(html);

const exe = findChrome();
const browser = await chromium.launch({
  headless: true,
  ...(exe ? { executablePath: exe } : {}),
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl', '--disable-gpu-sandbox', '--no-sandbox', '--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
const problems = [];
page.on('console', (m) => {
  const t = m.text();
  if (/GPU stall due to ReadPixels|GL Driver Message|Automatic fallback to software WebGL/.test(t)) return;
  if (m.type() === 'error' || (m.type() === 'warning' && /god-slide|WebGL|THREE/i.test(t))) problems.push(`[${m.type()}] ${t}`);
});
page.on('pageerror', (e) => problems.push('[pageerror] ' + (e.stack || e.message)));
page.setDefaultTimeout(180000);

const url = pathToFileURL(html).href + `?headless&w=${W}&h=${H}`;
const t0 = Date.now();
await page.goto(url);
await page.waitForFunction(() => window.ready === true || document.querySelector('.gs-fatal'), null, { timeout: 180000 });
if (await page.$('.gs-fatal')) { console.error('WebGL 2 unavailable in this browser.'); await browser.close(); process.exit(1); }
const scenes = await page.evaluate(() => window.__deck.list());
const only = opt('only') ? opt('only').split(',') : null;
const outDir = path.join(deckDir, 'snaps');
const thumbDir = path.join(deckDir, '.thumbs');
fs.mkdirSync(outDir, { recursive: true });
if (!flag('keep')) for (const f of fs.readdirSync(outDir)) if (f.endsWith('.jpg')) fs.unlinkSync(path.join(outDir, f));
const fracs = flag('frames') ? [0.35, 0.7, 1] : [1];
const shots = [];

for (let si = 0; si < scenes.length; si++) {
  const sc = scenes[si];
  if (only && !only.includes(sc.id)) continue;
  for (let b = 0; b < sc.beats; b++) {
    for (const frac of fracs) {
      const ts = Date.now();
      await page.evaluate(([id, beat, f]) => window.__deck.snap(id, beat, { frac: f }), [sc.id, b, frac]);
      const name = `${String(si + 1).padStart(2, '0')}-${sc.id}-b${b + 1}${frac < 1 ? '-' + Math.round(frac * 100) : ''}.jpg`;
      const buf = await page.screenshot({ type: 'jpeg', quality: 88 });
      fs.writeFileSync(path.join(outDir, name), buf);
      shots.push({ file: name, buf, label: `${si + 1}.${b + 1} ${sc.id}${frac < 1 ? ' @' + Math.round(frac * 100) + '%' : ''}`, scene: sc.id, beat: b, last: b === sc.beats - 1 && frac === 1 });
      process.stdout.write(`  ${name}  ${((Date.now() - ts) / 1000).toFixed(1)}s\n`);
    }
  }
}

if (flag('transitions')) {
  for (let si = 1; si < scenes.length; si++) {
    const sc = scenes[si];
    if (only && !only.includes(sc.id)) continue;
    for (const p of [0.25, 0.5, 0.75]) {
      await page.evaluate(([id, p]) => window.__deck.snapTransition(id, p), [sc.id, p]);
      const name = `${String(si + 1).padStart(2, '0')}-${sc.id}-t${Math.round(p * 100)}.jpg`;
      const buf = await page.screenshot({ type: 'jpeg', quality: 85 });
      fs.writeFileSync(path.join(outDir, name), buf);
      shots.push({ file: name, buf, label: `${scenes[si - 1].id} > ${sc.id} (${sc.enter}) ${Math.round(p * 100)}%`, scene: sc.id, beat: -1, last: false });
      process.stdout.write(`  ${name}\n`);
    }
    await page.evaluate(() => window.__deck.endSnapTransition());
  }
}

// Use the browser itself as the image resizer (no native deps).
async function resize(buf, w, h, q = 0.82) {
  const d = await page.evaluate(async ([b64, w, h, q]) => {
    const img = new Image(); img.src = 'data:image/jpeg;base64,' + b64; await img.decode();
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    c.getContext('2d').drawImage(img, 0, 0, w, h);
    return c.toDataURL('image/jpeg', q);
  }, [buf.toString('base64'), w, h, q]);
  return Buffer.from(d.split(',')[1], 'base64');
}

if (!flag('no-thumbs')) {
  fs.mkdirSync(thumbDir, { recursive: true });
  for (const s of shots.filter((x) => x.last)) fs.writeFileSync(path.join(thumbDir, `thumb-${s.scene}.jpg`), await resize(s.buf, 800, 450));
}

// contact sheet
if (shots.length) {
  const cols = Math.min(4, shots.length), cw = 480, ch = 270, lh = 28;
  const rows = Math.ceil(shots.length / cols);
  const d = await page.evaluate(async ([items, cols, cw, ch, lh, rows]) => {
    const c = document.createElement('canvas'); c.width = cols * cw; c.height = rows * (ch + lh);
    const g = c.getContext('2d'); g.fillStyle = '#111'; g.fillRect(0, 0, c.width, c.height);
    g.font = '500 16px "Geist Mono", monospace';
    for (let i = 0; i < items.length; i++) {
      const img = new Image(); img.src = 'data:image/jpeg;base64,' + items[i].b64; await img.decode();
      const x = (i % cols) * cw, y = Math.floor(i / cols) * (ch + lh);
      g.fillStyle = '#ddd'; g.fillText(items[i].label, x + 8, y + 19);
      g.drawImage(img, x, y + lh, cw - 4, ch - 4);
    }
    return c.toDataURL('image/jpeg', 0.86);
  }, [shots.map((s) => ({ b64: s.buf.toString('base64'), label: s.label })), cols, cw, ch, lh, rows]);
  fs.writeFileSync(path.join(outDir, 'contact.jpg'), Buffer.from(d.split(',')[1], 'base64'));
}

await browser.close();
const report = { html, scenes: scenes.map((s) => ({ id: s.id, title: s.title, beats: s.beats, missingNotes: s.notes.map((n, i) => (!n ? i + 1 : 0)).filter(Boolean) })), shots: shots.map((s) => s.file), problems, seconds: (Date.now() - t0) / 1000 };
fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(report, null, 2));
console.log(`\n${shots.length} frames -> ${path.relative(process.cwd(), outDir)}/  contact.jpg  (${report.seconds.toFixed(0)}s)`);
const missing = report.scenes.filter((s) => s.missingNotes.length);
if (missing.length) console.log('beats without speaker notes: ' + missing.map((s) => `${s.id}[${s.missingNotes.join(',')}]`).join(' '));
if (problems.length) { console.log('\nCONSOLE PROBLEMS:\n' + problems.join('\n')); process.exitCode = 1; }
else console.log('no console errors');
