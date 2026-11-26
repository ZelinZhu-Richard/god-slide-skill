#!/usr/bin/env node
// Scaffold a new deck from templates/starter.
//
//   node scripts/new-deck.mjs <dir> [--mode normal|supreme] [--title "Talk title"]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SKILL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf('--' + n); return i >= 0 ? args[i + 1] : d; };
const dir = args.find((a, i) => !a.startsWith('--') && !['--mode', '--title'].includes(args[i - 1]));
if (!dir) { console.error('usage: node scripts/new-deck.mjs <dir> [--mode normal|supreme] [--title "..."]'); process.exit(1); }
const target = path.resolve(dir);
if (fs.existsSync(path.join(target, 'deck.js'))) { console.error(target + ' already has a deck.js'); process.exit(1); }
const mode = opt('mode', 'normal');
const title = opt('title', path.basename(target).replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()));

function copy(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, e.name), d = path.join(dst, e.name);
    if (e.isDirectory()) copy(s, d);
    else fs.writeFileSync(d, fs.readFileSync(s, 'utf8').replaceAll('__TITLE__', title.replace(/'/g, "\\'")).replaceAll('__MODE__', mode));
  }
}
copy(path.join(SKILL, 'templates/starter'), target);
console.log(`new ${mode} deck: ${target}
  1. fill in outline.md (one sentence, one picture, scene table)
  2. edit scenes/*.js  (patterns: ${path.join(SKILL, 'examples/nobody-remembers-your-slides/scenes')})
  3. node ${path.join(SKILL, 'scripts/build.mjs')} ${dir}
  4. node ${path.join(SKILL, 'scripts/snap.mjs')} ${dir} --transitions   then look at snaps/contact.jpg
  5. build again (embeds thumbnails), deliver dist/*.html`);
