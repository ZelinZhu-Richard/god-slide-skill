// Nobody Remembers Your Slides — the god-slide showcase deck (supreme mode).
// A seven-minute talk about presenting that uses every device it describes:
// the boring opener, the selection box, one place per idea, numbers as objects,
// a live counter, an interactive split, the callback wall and the bookend.
//
// Build:  node ../../scripts/build.mjs .      Check: node ../../scripts/snap.mjs . --transitions
import office from './scenes/01-office.js';
import four from './scenes/02-four.js';
import place from './scenes/03-place.js';
import size from './scenes/04-size.js';
import audience from './scenes/05-audience.js';
import split from './scenes/06-split.js';
import wall from './scenes/07-wall.js';
import questions from './scenes/08-questions.js';

export default {
  title: 'Nobody Remembers Your Slides',
  mode: 'supreme',
  counter: 'pages',
  sound: false, // the presenter presses M to turn sound on
  scenes: [office, four, place, size, audience, split, wall, questions],
};
