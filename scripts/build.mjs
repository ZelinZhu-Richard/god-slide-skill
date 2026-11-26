#!/usr/bin/env node
// Build a deck folder into ONE self-contained HTML file (fonts, three.js, images inlined).
//
//   node scripts/build.mjs <deck-dir> [--out file.html] [--dev]
//
// <deck-dir>/deck.js       default-exports the deck config ({ title, scenes, counter, ... })
// <deck-dir>/deck.css      optional extra CSS
// <deck-dir>/assets/*      optional images/media, available as ctx.texture('name.jpg') / ctx.asset()
// <deck-dir>/.thumbs/*     scene thumbnails written by snap.mjs (embedded automatically)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const SKILL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const flag = (n) => args.includes('--' + n);
const opt = (n) => { const i = args.indexOf('--' + n); return i >= 0 ? args[i + 1] : null; };
const deckDir = path.resolve(args.find((a) => !a.startsWith('--') && args[args.indexOf(a) - 1] !== '--out') || '.');

async function loadEsbuild() {
  const tries = [
    () => import('esbuild'),
    () => import(pathToFileURL(path.join(SKILL, 'node_modules/esbuild/lib/main.js')).href),
    () => createRequire(path.join(SKILL, 'package.json'))('esbuild'),
  ];
  for (const t of tries) { try { const m = await t(); return m.default || m; } catch { /* next */ } }
  console.error('esbuild not found. Run: npm install --prefix ' + SKILL);
  process.exit(1);
}

const MIME = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.gif': 'image/gif', '.svg': 'image/svg+xml', '.mp4': 'video/mp4', '.webm': 'video/webm', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.json': 'application/json', '.woff2': 'font/woff2' };
const dataURL = (file) => `data:${MIME[path.extname(file).toLowerCase()] || 'application/octet-stream'};base64,${fs.readFileSync(file).toString('base64')}`;

const FONTS = [
  // [file, family, weight range, style, trigger regex (null = always)]
  ['unbounded.woff2', 'Unbounded', '200 900', 'normal', null],
  ['geist.woff2', 'Geist', '100 900', 'normal', null],
  ['geist-mono.woff2', 'Geist Mono', '100 900', 'normal', null],
  ['newsreader.woff2', 'Newsreader', '200 800', 'normal', /\bserif\b|Newsreader/],
  ['newsreader-italic.woff2', 'Newsreader', '200 800', 'italic', /serif-it|serifIt|Newsreader/],
  ['anton.woff2', 'Anton', '400', 'normal', /\banton\b|Anton/i],
  ['jetbrains-mono.woff2', 'JetBrains Mono', '100 800', 'normal', /\bjb\b|JetBrains/],
  ['silkscreen.woff2', 'Silkscreen', '400', 'normal', /\bpixel\b|Silkscreen/],
];

function readAll(dir, exts) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory() && !['node_modules', 'dist', 'snaps', '.thumbs', 'assets'].includes(e.name)) out.push(...readAll(p, exts));
    else if (e.isFile() && exts.includes(path.extname(e.name))) out.push(p);
  }
  return out;
}

export async function build(dir = deckDir, { out = opt('out'), dev = flag('dev'), quiet = false } = {}) {
  const entry = path.join(dir, 'deck.js');
  if (!fs.existsSync(entry)) { console.error('No deck.js in ' + dir); process.exit(1); }
  const esbuild = await loadEsbuild();
  const stub = `import config from ${JSON.stringify(entry)};\nimport { createDeck } from 'god-slide';\ncreateDeck(config).catch((e) => console.error(e));\n`;
  const result = await esbuild.build({
    stdin: { contents: stub, resolveDir: dir, sourcefile: 'gs-entry.js', loader: 'js' },
    bundle: true,
    write: false,
    format: 'iife',
    target: ['es2020'],
    minify: !dev,
    legalComments: 'none',
    alias: { 'god-slide': path.join(SKILL, 'engine/index.js') },
    nodePaths: [path.join(SKILL, 'node_modules'), path.join(dir, 'node_modules')],
    loader: { '.glsl': 'text', '.frag': 'text', '.vert': 'text', '.txt': 'text', '.html': 'text', '.css': 'text' },
    logLevel: 'silent',
    define: { 'process.env.NODE_ENV': '"production"' },
  }).catch((e) => { console.error(e.message); process.exit(1); });
  let js = result.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
  const banner = '/* Built with god-slide. Includes three.js (MIT License, Copyright © 2010-2026 three.js authors). Fonts: SIL Open Font License 1.1. */\n';

  // fonts actually used
  const sources = readAll(dir, ['.js', '.css', '.html', '.mjs']).map((f) => fs.readFileSync(f, 'utf8')).join('\n');
  const fontCSS = FONTS.filter(([, , , , re]) => !re || re.test(sources)).map(([file, fam, w, st]) =>
    `@font-face{font-family:"${fam}";src:url(${dataURL(path.join(SKILL, 'fonts', file))}) format("woff2");font-weight:${w};font-style:${st};font-display:block}`).join('\n');

  const css = fs.readFileSync(path.join(SKILL, 'engine/styles.css'), 'utf8') + (fs.existsSync(path.join(dir, 'deck.css')) ? '\n' + fs.readFileSync(path.join(dir, 'deck.css'), 'utf8') : '');

  const assets = {};
  const addDir = (d, prefix = '') => {
    if (!fs.existsSync(d)) return;
    for (const f of fs.readdirSync(d)) {
      const p = path.join(d, f);
      if (fs.statSync(p).isDirectory()) addDir(p, prefix + f + '/');
      else if (MIME[path.extname(f).toLowerCase()]) assets[prefix + f] = dataURL(p);
    }
  };
  addDir(path.join(dir, 'assets'));
  addDir(path.join(dir, '.thumbs'));

  const title = (/title\s*:\s*(['"`])(.+?)\1/.exec(fs.readFileSync(entry, 'utf8')) || [])[2] || path.basename(dir);
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${title.replace(/</g, '&lt;')}</title>
<style>${fontCSS}
${css}</style></head>
<body class="gs"><canvas id="gs-canvas" aria-label="The presentation"></canvas><div id="gs-dom"></div><div id="gs-ui"></div>
<script>window.__GS_ASSETS=${JSON.stringify(assets)};</script>
<script>${banner}${js}</script>
</body></html>`;
  const slug = path.basename(dir).replace(/[^\w-]+/g, '-').toLowerCase() || 'deck';
  const file = out ? path.resolve(out) : path.join(dir, 'dist', slug + '.html');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, html);
  if (!quiet) {
    const kb = (n) => (n / 1024).toFixed(0) + ' KB';
    const assetBytes = Object.values(assets).reduce((a, v) => a + v.length, 0);
    console.log(`built ${path.relative(process.cwd(), file)}  ${kb(html.length)}  (js ${kb(js.length)}, fonts ${kb(fontCSS.length)}, assets ${kb(assetBytes)} in ${Object.keys(assets).length} files)`);
  }
  return file;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) build();
