---
name: god-slide
description: Cinematic WebGL slide decks in one HTML file. Use for god or cinematic slides; use automatically, in supreme mode, for any demo day, pitch deck, conference talk or keynote.
---

# God Slide

Builds a presentation where every slide is a rendered picture: real-time 3D worlds (Three.js), kinetic type, film-grade transitions, a counter that narrates, speaker notes with stage directions, all paced by the presenter one beat at a time. The output is **one self-contained, offline HTML file** that you open full screen and present. The craft comes from studying a deck called *The Last Boring Slide*; `references/storytelling.md` has the case study.

If the user wants an editable PowerPoint, Google Slides or Keynote file, or a plain everyday deck they will edit themselves, this skill is the wrong tool: use the normal slide route instead.

## Pick the mode first (say which one in your first line)

| | **normal** (default) | **supreme** |
|---|---|---|
| When | The user invokes this skill or asks for god / cinematic slides for an ordinary talk, class, lab meeting, update | **Auto-select** for a demo day, pitch deck, investor pitch, conference talk, keynote, TEDx, competition final, thesis defense, launch, or any occasion the user calls important. Also when the user says "supreme" or "premium" |
| 3D | 2–4 hero scenes are full 3D worlds; the rest are kinetic type on living backdrops | Every scene is a world (3D or a full custom shader) |
| Beats | 1–3 per scene | 2–4 per scene, choreographed camera moves |
| Transitions | fade, dip, push, portal, wash | a deliberate one per scene: portal, portal-out, wash, tear, flaps, line, daybreak, slam, fold |
| Devices | one signature device | two to four (see the craft section) |
| QA | snap every beat | snap every beat and every transition, then a timing pass |

If the occasion is unclear and it would change the mode, ask once; otherwise decide and state it.

## Step 0: get the kit

The engine, scripts, fonts and examples live in the kit folder, which sits next to this file when the skill was installed from the repo. If it isn't there, fetch it:

```bash
KIT="<this skill's base directory>"
if [ ! -f "$KIT/engine/index.js" ]; then
  KIT=/tmp/god-slide
  [ -f "$KIT/engine/index.js" ] || git clone --depth 1 https://github.com/ZelinZhu-Richard/god-slide-skill "$KIT" \
    || (mkdir -p "$KIT" && curl -sL https://codeload.github.com/ZelinZhu-Richard/god-slide-skill/tar.gz/main | tar xz -C "$KIT" --strip-components=1)
fi
[ -d "$KIT/node_modules/three" ] || npm install --prefix "$KIT" --no-audit --no-fund
```

`npm install` brings three.js, esbuild and playwright-core. Snapshots need a Chrome or Chromium binary (`/usr/bin/google-chrome` is found automatically; else set `CHROME_PATH`). If GitHub is unreachable, ask the user to attach the repo ZIP. If no browser is available, build anyway and tell the user you could not render a visual check.

## Workflow

1. **Brief.** Get the one sentence the talk is about, the audience, the length, and the occasion (which sets the mode). Any fact that could have changed since your training (figures, who holds what role, prices, records) gets looked up before it goes on a slide. Keep a source for every number.
2. **Script before code.** Write `outline.md` (the scaffold has a template). Decide the *one picture they keep* first. Then for each scene: one idea, the physical place or metaphor that carries it, what changes on each beat, a spoken headline per beat, the source or "illustration" note, the speaker notes, and the transition in. Read `references/storytelling.md` the first time you do this. In supreme mode, show the outline to the user and wait for an OK if they are present; in normal mode carry on and show it with the first draft.
3. **Scaffold.** `node $KIT/scripts/new-deck.mjs <deck-dir> --mode <normal|supreme> --title "..."`
4. **Build scene by scene.** Write one scene → `node $KIT/scripts/build.mjs <deck-dir>` → `node $KIT/scripts/snap.mjs <deck-dir> --only <id>` → look at the frames in `<deck-dir>/snaps/` → fix. Copy idioms from `$KIT/examples/nobody-remembers-your-slides/scenes/` (eight complete scenes covering every device) and recipes from `references/cookbook.md`. The API is in `references/engine-api.md`.
5. **Full QA.** `snap.mjs <deck-dir> --transitions`, then read `snaps/contact.jpg` and `snaps/report.json`. Work through `references/qa.md`. Build once more at the end: the second build embeds the scene thumbnails that the overview grid (O) and `ctx.thumb()` use.
6. **Deliver** `<deck-dir>/dist/<slug>.html`. If an artifact-publishing tool is available, publish that file as an artifact (it is a complete page) and also send the file; otherwise send the file. In the reply, give the controls in one line: → / space next, ← back, F full screen, N notes, P presenter window, O overview, A autoplay, M sound, B black. Then add one honest line on what to rehearse.

## The craft (short version; `references/storytelling.md` and `references/design-system.md` have the long one)

- **One idea per scene, one place per idea.** Turn the abstract into something physical: growth becomes a tower you look up at, a bias becomes an anchor chain, scale becomes a crowd, risk becomes weather. A scene is a world the idea lives in.
- **Beats are reveals, not bullets.** Each beat changes one thing in the same world: the camera moves, the sea rises, a number lands, the lights come on. Beat 1 is calm; the last beat lands the point.
- **Headlines are spoken sentences.** Eight words or fewer, sentence case, a full stop. Two lines at most, broken where you would pause. Display type top-left. No bullets, unless you are parodying them.
- **Numbers are things, and they are honest.** Draw quantities to scale next to something familiar (a person, a day, a building). Every number on screen gets a small source line, or the tag `illustration` if it is arithmetic or speculation. Extrapolations are labelled as extrapolations. Caveats go in the notes.
- **The counter is a second narrator.** The bottom-right number is page numbers by default. Make it mean something when you can: Fibonacci pages in a talk about growth, a live total that keeps running while you speak, the floor count of the tower being built. Bring it back to "1" for a bookend.
- **Notes are a script with stage directions.** Every beat has notes. Put performance cues in parentheses: "(Say it flatly. Wait.)", "(Press next and stop talking.)", "(Let the counter run.)".
- **Signature devices**, used with intent (normal: one; supreme: two to four): the *boring opener* that breaks (an Arial template that gets selected and deleted), the *selection box* (the presenter edits the world), the *live counter*, the *interactive split* (drag between two versions), the *callback wall* (every slide revisited as a physical object), the *bookend* (return to the dull template, changed: tilted, retyped).
- **Pictures in WebGL, words in HTML.** Backgrounds, worlds and anything that must take part in a transition are rendered. Type, labels and the selection box are HTML. A full-screen HTML background breaks transitions.
- **Legibility beats beauty.** Keep headlines off the sun and bright cloud. Use the `grad` post setting (a graduated ND filter) and the `.shadow` class over bright skies. Check every frame in the contact sheet at thumbnail size.

## The scene contract (enough to start; full API in `references/engine-api.md`)

```js
import * as THREE from 'three';
import { kit, ease } from 'god-slide';

export default {
  id: 'tower',                       // URL hash, thumbnails, ctx.thumb('tower')
  title: 'The real chart',           // overview grid and presenter window
  enter: 'portal',                   // transition into this scene
  hud: { color: '#ffffff' },         // counter style (values may be functions of state s)
  beats: [                           // dur = seconds of choreography; notes = what to say
    { dur: 4, notes: 'Calm first.' },
    { dur: 6, sfx: 'rise', notes: 'Now it grows.\n(Let it finish before you speak.)' },
  ],
  html: `
    <h1 class="display mid light tl" data-beat="0">It keeps<br>getting taller.</h1>
    <p class="source tl" style="top:320px" data-beat="0" data-delay="1">Source, Month Year</p>
    <p class="label light" id="top" data-beat="1" data-delay="2">40 hours</p>`,
  create(ctx) {                      // runs once, layer laid out (measure DOM here)
    const scene = new THREE.Scene();
    const camera = ctx.camera(36);   // aspect and the 16:9 safe frame are handled for you
    const sky = kit.sky({ preset: 'noon' });  scene.add(sky.mesh);  sky.fog(scene, 0.0004);
    const pin = ctx.pin('#top');
    const rig = kit.rig(camera, [{ pos: [120, 40, 260], look: [0, 60, 0] }, { pos: [30, 2, 40], look: [0, 200, 0], fov: 55 }]);
    return {
      scene, camera, post: { preset: 'film', grad: 0.3 },
      update(s) {                    // every frame; s.k(beat, t0, t1) is 0..1 over that slice of the beat
        rig.at(s.k(1, 0, 5, ease.smoother));
        sky.update(s.t);
        pin.at(new THREE.Vector3(0, 300, 0), camera);
      },
    };
  },
};
```

Text reveals are declarative: `data-beat` (which beat), `data-fx` (`rise` default for headings, `chars`, `fade`, `up`, `blur`, `pop`, `wipe`, `type`, `count`, `draw`, `grow`), `data-delay`, `data-dur`, `data-until` (hide again on a later beat). Layout is a 1920×1080 stage: position with `style="left:..;top:.."` or the helpers `tl`, `bl`, `tr`, `br`, `center`.

The kit (`references/engine-api.md` has signatures): `backdrop` (paper, gradient, aurora, ink, grid, stars, spotlight, halftone, solid), `sky` and `env`, `ocean`, `city` and `ground`, `terrain`, `particles` (swarm, dust, rise, stars, field, or your own positions), `globe`, `card` and `wall` (slides, photos and thumbnails as physical objects), `glare`, `rig`, `lights`, `textMesh`, `odometer`, `officeChart`, and `ctx.select()` for the selection box. Post presets are `film`, `soft`, `crisp`, `dream`, `noir` and `flat`.

## Pitfalls that cost time

- Measure DOM (`ctx.rect`) in `create()`, not lazily in `update()`: off-screen layers measure as zero.
- Keep each reveal inside its beat: `data-delay + data-dur ≤ dur`. Late reveals still finish, but the beat feels broken.
- The last beat of every scene is its thumbnail and its overview card. Make that frame good.
- Heavy shaders hurt the presenter's laptop. The engine lowers resolution under load; `?lite` forces it. Don't stack several fullscreen raymarchers.
- User photos, logos and screenshots go in `<deck-dir>/assets/` and come back with `ctx.texture('name.jpg')`. They are inlined at build time. Never hot-link.
- Chinese or Japanese text falls back to system CJK fonts (PingFang, Noto, YaHei). Give CJK headlines more line height.
- Write original visuals. Don't recreate logos, characters or other people's artwork in a scene.
