// 08 — The bookend. Back to the dull template, page 1 again. A text box types the real
// question, and after a while the whole slide tilts by one degree: it was a picture all along.
import { ease } from 'god-slide';

export default {
  id: 'questions',
  title: 'Any questions?',
  enter: 'portal-out',
  bg: '#ffffff', // the page itself is WebGL, so transitions can carry it
  hud: { font: 'arial', color: '#7f7f7f', alpha: 0.9 },
  beats: [
    { dur: 0.6, page: '1', notes: 'Any questions?\n(Back to the boring template. Let people think it is over.)' },
    { dur: 3.2, page: '1', sfx: 'tick', notes: '(Press next and look at the screen, not at the room.)' },
    { dur: 10, page: '1', notes: 'Leave it up. Before your next talk, answer this one first.\n(After a few seconds the slide tilts by one degree.)' },
  ],
  html: `
    <div class="office-bg" id="void" style="background:#0d0f13;opacity:0"></div>
    <div class="group" id="sheet">
      <div class="office-bg"></div>
      <h1 class="office-title" style="top:380px" data-beat="0" data-fx="none">Any questions?</h1>
      <p class="arial" style="left:0;right:0;top:540px;text-align:center;font-size:60px;color:#000">
        <span id="ask" data-beat="1" data-fx="type" data-delay="0.9" data-speed="0.065" data-caret="keep">What will they remember?</span></p>
    </div>
  `,
  create(ctx) {
    const sheet = ctx.$('#sheet'), voidEl = ctx.$('#void');
    const a = ctx.rect('#ask'); // measured while the layer is laid out (create time)
    const box = ctx.select();
    box.rect(a.x - 26, a.y - 8, a.w + 52, a.h + 16); // a text box around the line to be typed
    return {
      update(s) {
        box.show(s.k(1, 0, 0.6, ease.linear));
        // one degree, slowly: the slide becomes an object
        const k = s.k(2, 3, 7, ease.io3);
        sheet.style.transform = `rotate(${k}deg) scale(${1 - 0.06 * k})`;
        sheet.style.boxShadow = k > 0 ? `0 ${30 * k}px ${80 * k}px rgba(0,0,0,${0.5 * k})` : '';
        voidEl.style.opacity = Math.min(1, k * 4); // the room behind the slide
      },
    };
  },
};
