// 01 — Opening statement: kinetic type on a living backdrop (the normal-mode workhorse).
import { kit } from 'god-slide';

export default {
  id: 'title',
  title: 'Opening',
  hud: { color: '#f3ede2' },
  beats: [
    { dur: 3, notes: 'What you say on this beat.\n(Stage directions go in parentheses.)' },
    { dur: 3, notes: 'Second beat: one new thing appears. Never more than one.' },
  ],
  html: `
    <h1 class="display big light tl" data-beat="0">One sentence<br>this talk is about.</h1>
    <p class="source tl" style="top:420px" data-beat="0" data-delay="1">Source line for any number on screen</p>
    <p class="display mid light bl" data-beat="1" data-fx="chars">The turn.</p>
  `,
  create(ctx) {
    const bg = kit.backdrop(ctx, 'gradient', { colors: ['#0d1220', '#24304f', '#7a4a5e', '#e0a56b'] });
    return { render: bg.render };
  },
};
