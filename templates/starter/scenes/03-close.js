// 03 — The close: one question, typed into an editor text box.
import { kit, ease } from 'god-slide';

export default {
  id: 'close',
  title: 'The question',
  enter: 'dip',
  hud: { color: '#14161c' },
  beats: [
    { dur: 1, notes: 'Pause. Let the room read it.' },
    { dur: 3, notes: '(Press next and look at the screen, not at the room.)' },
  ],
  html: `
    <h1 class="display mid ink center" style="top:380px" data-beat="0">The last line.</h1>
    <p class="display small ink center" style="top:540px"><span id="q" data-beat="1" data-fx="type" data-delay="0.6" data-caret="keep">What will you do with it?</span></p>
  `,
  create(ctx) {
    const bg = kit.backdrop(ctx, 'paper', { colors: ['#f3efe6', '#e2d9c6'] });
    const r = ctx.rect('#q');
    const box = ctx.select();
    box.rect(r.x - 24, r.y - 8, r.w + 48, r.h + 16);
    return {
      update(s) { box.show(s.k(1, 0, 0.5, ease.linear)); },
      render: bg.render,
    };
  },
};
