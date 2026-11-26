// 01 — The boring opener. It looks like every talk the room has sat through.
// Then the editor's selection box appears, selects everything, deletes it, and types.
import { ease } from 'god-slide';

export default {
  id: 'office',
  title: 'How to give a great presentation',
  bg: '#ffffff',
  // The counter starts as a grey Arial page number and turns into the deck's own voice.
  hud: {
    font: (s) => (s.beat < 2 || s.at(2) < 2.0 ? 'arial' : 'mono'),
    color: (s) => (s.beat < 2 || s.at(2) < 2.0 ? '#7f7f7f' : '#14161c'),
    alpha: 0.9,
  },
  beats: [
    { dur: 0.5, page: '1', notes: 'Hello. Today: how to give a great presentation.\n(Say it flatly. Let the slide be boring. Wait one beat too long.)' },
    { dur: 1.2, page: '2', notes: 'Here is the agenda. Introduction. Know your audience...\n(Read two bullets out loud, slowly. Then press next and stop talking.)' },
    { dur: 4.6, page: '3', sfx: 'tick', notes: '(Do not speak until the cursor blinks.)\nSelect all. Delete. Start again.' },
  ],
  html: `
    <div class="office-bg"></div>
    <h1 class="office-title" data-beat="0" data-fx="none" data-until="1" data-out-dur="0.01">How to Give a Great Presentation</h1>
    <p class="office-sub" data-beat="0" data-fx="none" data-until="1" data-out-dur="0.01">Tips and best practices</p>
    <div class="group" id="agenda" data-beat="1" data-fx="none" data-until="2" data-out-delay="1.0" data-out-dur="0.2">
      <h2 class="office-h" id="agenda-h">Agenda</h2>
      <ul class="office-ul" id="bullets">
        <li>Introduction</li><li>Know your audience</li><li>Use clear bullet points</li><li>Next steps</li><li>Questions</li>
      </ul>
    </div>
    <p class="display bold ink" id="again" style="left:132px;top:410px;font-size:176px;line-height:1.1;white-space:nowrap"
       data-beat="2" data-fx="type" data-delay="2.0" data-speed="0.075" data-caret="keep">Start again.</p>
  `,
  create(ctx) {
    // The layer is laid out (invisibly) while create() runs, so measure here.
    const h = ctx.rect('#agenda-h'), u = ctx.rect('#bullets'), a = ctx.rect('#again');
    const all = { x: h.x - 28, y: h.y - 22, w: Math.max(h.w, u.w) + 56, h: u.y + u.h - h.y + 30 };
    const field = { x: a.x - 26, y: a.y - 8, w: a.w + 52, h: a.h + 16 };
    const box = ctx.select();
    return {
      update(s) {
        // 0.0-0.5s select all · 1.0s delete · 1.3-1.9s become a text box · 2.0s type · 3.8s let go
        box.tween(all, field, s.k(2, 1.3, 1.9, ease.io4));
        box.show(s.k(2, 0, 0.5, ease.linear) * (1 - s.k(2, 3.8, 4.4)));
        s.cue(2, 1.0, () => ctx.sfx('thud', { gain: 0.25 }));
      },
    };
  },
};
