# QA checklist

Run `node $KIT/scripts/snap.mjs <deck> --transitions` (supreme mode) or without `--transitions` (normal mode), then open `snaps/contact.jpg`, look closely at any frame that worries you, and read `snaps/report.json`.

## Must pass
- [ ] **No console errors** (`snap.mjs` exits with code 0 and prints "no console errors").
- [ ] **Every beat has notes** (`report.json` → `missingNotes` is empty for every scene).
- [ ] **Every number on screen has a source line or an `illustration` tag**, and any number that could have changed since your training was looked up this session.
- [ ] **Headlines read at thumbnail size** in the contact sheet: contrast, size, nothing over the sun.
- [ ] **Nothing important in the bottom-right corner** (the counter lives there) or outside the 120 px side margins.
- [ ] **The last beat of each scene is a good frame.** It becomes the thumbnail and the overview card.
- [ ] **Built twice**: the second build embeds thumbnails (`build ... assets ... in N files` shows them), so the overview grid (O) and `ctx.thumb()` show real slides.
- [ ] **The deliverable is one file**: `dist/<slug>.html` opens with no network (no `http` URLs in scenes; images come from `assets/`).

## Should pass
- [ ] Transitions: in `--transitions` frames the outgoing text leaves cleanly and the incoming text arrives after the picture settles (beat 0 `delay` about half the transition).
- [ ] Going back works: if a beat moves things in `update` from the timeline (`s.k`, `s.at`), it rewinds for free. Anything driven by `s.dt` accumulation (manual state) must reset in `enter()`.
- [ ] Each scene has some ambient life (water, clouds, dust, a slight camera shake) so a held frame isn't dead.
- [ ] One major motion at a time; type doesn't move while the camera flies.
- [ ] Mode matches the occasion: supreme for demo days, pitches, conference talks and keynotes; normal otherwise.
- [ ] Devices used deliberately (normal: one; supreme: two to four), each with a reason in the outline.
- [ ] Notes include stage directions where the presenter must pause, stay silent or interact.
- [ ] Timing: the sum of `hold`s plus `dur`s roughly matches the talk length (autoplay with A to rehearse).

## Performance
- [ ] Heavy scenes (ocean at full size, 200k particles, several post passes) have been looked at with `--frames`; avoid stacking several fullscreen raymarching shaders.
- [ ] The file size is reasonable (base engine ~1 MB; photos add their size). Compress large photos to JPEG ~85% at 1920 px wide before putting them in `assets/`.
- [ ] Suggest presenting in Chrome with hardware acceleration on; `?lite` exists for weak laptops.

## Before delivering
Tell the user, in a few lines: the mode and why, how to present (open the file in Chrome, F for full screen, P for the presenter window), and what they should rehearse (interactive moments, silences, the live counter).
