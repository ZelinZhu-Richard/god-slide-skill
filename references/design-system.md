# Design system

Everything is laid out on a **1920 × 1080 stage** (stage units ≈ pixels at 1080p). The stage is scaled to fit any window and centred; 3D worlds and backdrops fill the whole window, so wide screens get more picture, never stretched type.

## Type roles (classes in `engine/styles.css`)

| Class | Font | Use | Size |
|---|---|---|---|
| `.display` | Unbounded 300 (light, wide) | Headlines | `.big` 128 · default 96 · `.mid` 76 · `.small` 58 · `.huge` 220 |
| `.display.bold`, `.punch` | Unbounded 800 | One-word punches, big numbers | as above |
| `.text` | Geist 400 | Rare supporting sentences | 34 |
| `.label` | Geist 500 | Labels pinned to objects | 44 (34 when small) |
| `.source` | Geist 400, dim | Sources, "illustration" | 28 |
| `.tag` | Geist 400, dim | Units, small captions | 26 |
| `.mono` | Geist Mono 500 | Counters, technical labels; the HUD | — |
| `.serif`, `.serif-it` | Newsreader | Quotes, a human voice, a quiet ending | 76–128 |
| `.anton` | Anton | Poster-style condensed punches | 200–320 |
| `.jb` | JetBrains Mono 700 | Code, terminals | — |
| `.pixel` | Silkscreen | Retro and game jokes | — |
| `.arial`, `.office-*` | Arial | **Only** for parodying the default template | — |

Rules: one display style per scene; headlines in light weight (300) unless a single word is the punch; never more than two type sizes on screen at once besides the source line; numbers get `.num` (tabular figures).

Colours of type: `.light` (#fbf6ec, warm off-white) on dark or saturated worlds, `.ink` (#14161c) on light worlds, `.dim` for secondary. Avoid pure white text: it looks pasted on.

## Layout

- **Safe margins:** headline block at `left:120px; top:104px` (`.tl`). Bottom block at `left:120px; bottom:112px` (`.bl`). Keep 120 px from the left and right edges.
- **The HUD** (the counter) sits 60 units from the window's right edge and 54 from its bottom. Leave that corner clear.
- **Headline + source** pattern: headline at top 104, source line about 40 px under the headline's last line (for a two-line `.mid`, `top:316–330px`).
- **Labels pinned to 3D objects** use `ctx.pin()`; keep them short (2–4 words) and offset them from the object so they don't sit on edges.
- **Centre** only for single-statement scenes (the closing question, a quote).
- Give the picture room: text should cover less than a quarter of the frame.

## Colour

- Each scene takes its palette from its world (sunset gold, noon blue, night black with warm lights, paper cream). Don't impose a brand palette on worlds; put brand colour in one accent.
- **Selection blue** `#2b5cff` is reserved for the editor motif (selection boxes, carets, handles).
- **One red** (`--accent: #e3241b`) for a single emphasis in a talk (a disc, a thread, a marker). Use it at most twice.
- Exact colours (brand marks, the parody template) need the `flat` post preset or a `backdrop`. The filmic `film` preset shifts saturated colours.

## Motion

- Everything eases. Defaults: `ease.io3` for state changes, `ease.smoother` for camera moves, `ease.out4` for type, `ease.outBack` only for UI pops (selection handles).
- Text rises out of a mask (`rise` for headlines: line by line, 0.09 s stagger; `chars` for single words: 0.028 s per character).
- Durations: type reveals 0.7–1.2 s; camera moves 3–6 s; big transformations 4–10 s; `hold` for autoplay 3–8 s.
- Nothing moves linearly except clocks and counters. Nothing bounces except handles.
- Ambient motion (water, clouds, dust, a slow camera shake of 0.01–0.03 units) keeps a held frame alive. Every 3D scene should have some.
- One major motion at a time. If the camera moves, the type stays still.

## The film look (post settings)

Presets: `film` (default for worlds), `soft` (dreamy, more bloom), `crisp` (clean product-like), `dream` (heavy bloom and halation), `noir` (black and white, contrasty), `flat` (exact colours, no grain).

| Setting | Typical | Notes |
|---|---|---|
| `exposure` | 0.85–1.1 | Lower it for storms and night |
| `bloom`, `threshold` | 0.2–0.6, 0.8–1.2 | Emissive HDR colours (>1) bloom: windows, lamps, glowing frames |
| `halation` | 0.2–0.6 | Warm film glow around highlights; lovely at sunset, wrong on product shots |
| `grain` | 0.02–0.04 | Always some, so the picture never looks like a screenshot |
| `vignette` | 0.15–0.4 | More for dark rooms and spotlights |
| `grad` | 0.2–0.7 | Graduated ND filter: darkens the top of frame so top-left headlines read over sky |
| `contrast`, `saturation` | 1.0–1.15 | Grade lightly |
| `tint`, `lift`, `gain` | — | White balance and colour grade |
| `fade`, `fadeColor` | — | Fade a world to a colour within a beat |

## Legibility checklist

- Is the headline over the sun, bright cloud or busy texture? Move the sun (`sunAzimuth`), the camera, or add `grad`.
- Light text on a light sky? Add `.shadow` (a soft drop shadow that survives the reveal masks) or darken the world.
- At thumbnail size in `snaps/contact.jpg`, can you still read the headline? If not, it's too small or too low-contrast for the back row.

## Sound (off by default)

The presenter presses M to turn sound on. Cues: `tick`, `type`, `whoosh`, `swell`, `thud`, `chime`, `rise`, `hit`. Attach to a beat (`sfx: ['swell', { dur: 4 }]`) or fire inside a beat with `s.cue(beat, seconds, () => ctx.sfx('thud'))`. Keep sound sparse: about one cue per scene, quiet under speech.
