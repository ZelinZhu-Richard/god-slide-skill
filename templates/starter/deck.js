// __TITLE__ — built with god-slide (__MODE__ mode).
// One file per scene in ./scenes. Build: node <kit>/scripts/build.mjs .   Check: node <kit>/scripts/snap.mjs .
import title from './scenes/01-title.js';
import hero from './scenes/02-hero.js';
import close from './scenes/03-close.js';

export default {
  title: '__TITLE__',
  mode: '__MODE__',
  counter: 'pages', // 'pages' | 'fibonacci' | 'none' | (globalBeatIndex) => string
  sound: false,     // the presenter presses M to turn sound on
  scenes: [title, hero, close],
};
