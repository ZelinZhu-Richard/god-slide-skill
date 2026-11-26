# Storytelling: how a god-slide talk is built

Read this before writing `outline.md`. The engine makes anything look expensive; this file is what makes a deck worth remembering.

## Contents
1. The method in seven rules
2. Finding the place for an idea (abstract to physical)
3. Designing beats
4. Writing headlines
5. Numbers and honesty
6. The counter
7. Signature devices, and when to use them
8. Structures: pitch / demo day, research talk, keynote, class or lab update
9. Speaker notes
10. Case study: *The Last Boring Slide*

---

## 1. The method in seven rules

1. **Find the one sentence.** Everything in the talk serves one line the audience could repeat at dinner. Write it at the top of `outline.md`. If you can't write it, you are not ready to make slides.
2. **Decide the one picture they keep.** Before any scene exists, choose the single image people will describe afterwards. Spend the most craft there.
3. **One idea per scene.** A scene that holds two ideas is two scenes.
4. **Every idea gets a place.** An abstract claim becomes a physical situation the viewer can stand in (section 2).
5. **Beats change the world, not the slide.** The same place transforms: weather, scale, light, camera, a number landing.
6. **Spectacle earns trust only with honesty.** Big visuals make claims feel bigger, so the sourcing has to be stricter, not looser (section 5).
7. **End on a question or a choice, not a summary.** The last scene hands the idea to the audience.

## 2. Finding the place for an idea

Ask: *if this idea were a physical situation, where would I be standing, and what would I see change?* Prefer situations with a human scale reference (a person, a boat, a room, a day) so size reads instantly.

| Abstract idea | Place that carries it |
|---|---|
| Exponential growth | A tower whose floors double; dominoes each 1.5× the last until one dwarfs a city; a calendar where each day is drawn at the size of what happens in it |
| Anchoring / sticking to old forecasts | A boat chained to the sea floor while the sea keeps rising |
| A system improving itself | A picture that contains the next version of itself; gears where the small wheel drives the big one |
| Many agents working in parallel | A city whose windows light up one by one; a swarm of points that grows from one to a million |
| Intelligence or understanding | How far a lantern lights the dark field around it |
| A small error at scale | An arrow one degree off: harmless at ten metres, wrong by thousands of kilometres at the Moon |
| Attention, memory, overload | Four lit slots and ninety cards falling past them |
| Two futures from one decision | A split screen of the same place, built two ways, with a draggable divider |
| Where we are on a curve | Looking up at a wall that is "the rest of the curve"; standing on the flat part |
| Cost or effort | A pile, a queue, a tower of hours, a stack of paper next to a person |
| Risk and uncertainty | Weather: calm sea, then storm; fog that hides the far end |
| Market size | A globe with lights for every customer; a stadium filling seat by seat |
| Speed | A counter that keeps running while you talk |

Rules of thumb: metaphors from the physical world beat diagrams; one metaphor per scene; reuse a world across beats instead of cutting to a new one; and a world you return to later (a callback) hits twice as hard.

## 3. Designing beats

A beat is a reveal that the presenter triggers. Inside it, motion is choreographed on the beat's timeline (`dur` seconds).

- **Beat 1 sets the scene calmly.** Establish the place and the headline. Let it breathe (`dur` 3–5 s).
- **Middle beats change one thing each.** Scale up, add the number, turn on the lights, move the camera.
- **The last beat lands the point** and holds. It is also the scene's thumbnail.
- **2–4 beats per scene.** Five or more usually means two scenes.
- **Long moves are camera moves.** Big changes feel cinematic when the camera travels (crane up the tower, pull back from the boat) rather than when objects fly around.
- **Pause points.** If the presenter must stop talking while something happens, say so in the notes and give it time (`dur` 6–14 s).

## 4. Writing headlines

- Eight words or fewer. Sentence case. A full stop at the end. ("Let go." "Select all." "Make them look up.")
- Write what you would say out loud, not a label ("Doubling every 3.6 months.", not "Growth rate").
- Two lines at most; break the line where the voice pauses.
- One headline per beat at most. Swap headlines with `data-until` (out) and `data-delay` (in).
- Supporting lines are small and sparse: a source, a label pinned to an object, a unit.

## 5. Numbers and honesty

- **Look up anything current.** Figures, records, prices, who holds what job: search before you put it on screen, and keep the source.
- **Every on-screen number has a source line** in `.source` style, for example `METR, November 2026`, or the tag `illustration` when it is arithmetic, a model run or speculation.
- **Say what kind of number it is.** A measurement, a model run, a trend continued and your speculation are four different things. Draw extrapolations differently (dashed, ghosted, labelled "trend continued, not a measurement").
- **Error bars go in the notes** so the presenter can answer questions honestly.
- **Draw to scale.** If one floor is an hour, then 100 hours is 100 floors. Never exaggerate the geometry for effect; the honest version is usually dramatic enough.
- **Prefer arithmetic the audience can check** ("300 people × 20 minutes = 100 hours").

## 6. The counter

The small number in the bottom-right corner is read subconsciously all talk long. Use it:

- **Plain page numbers** (default `counter: 'pages'`): fine for most talks.
- **Growing pages** (`counter: 'fibonacci'`): in a talk about acceleration, the page number itself explodes (1, 2, 3, 5, 8 … 10^80, ∞). Return it to "1" on the final scene ("You are here").
- **A live quantity** via a scene's `page(s)` function or per-beat `page`: floors built, years of thinking done since the slide opened, money spent, people reached.
- **Style it per scene**: grey Arial while parodying a template, monospace afterwards. The change of font is part of the story.

## 7. Signature devices

| Device | What it is | Use when | Cost |
|---|---|---|---|
| **Boring opener** | Start as the dullest template (Arial, bullets, grey page number). Then the editor selection box selects everything and the slide is deleted, retyped or remade | You want the room to relax, then sit up. Works once per talk, at the start | Low |
| **Selection box** | The blue frame with handles from slide editors. The presenter "edits" the world: selects a word, a chart, the Sun | Recurring motif about control, choice, editing or design | Low |
| **Live counter** | A number that keeps running while the presenter talks (odometer digits) | Rates, scale, time passing | Low |
| **Interactive split** | Two versions of the same place with a draggable divider | Comparisons, futures, before/after, ours vs theirs | Medium |
| **Callback wall** | All earlier slides (real thumbnails) stacked as an object in a world | Near the end: "everything I showed you" | Medium |
| **Bookend** | Return to the opener's dull template, changed: page "1" again, a question typed into a text box, the slide tilting by one degree | The final scene | Low |
| **Growing counter** | Page numbers that grow exponentially | Talks about growth or acceleration | Free |

Normal mode uses one device. Supreme mode uses two to four. The showcase example uses all of them because it is a demonstration, not a model talk length.

## 8. Structures

**Pitch / demo day (3–6 minutes, supreme).** Hook (the boring opener or a vivid place for the problem) → the problem as a place → the insight as one physical metaphor → the product as the "edit" (selection-box moment, live demo capture as a card) → traction as a physical quantity to scale, with sources → why now (counter or curve) → team (one picture each, cards) → the ask, ending on one question or one number. Keep it under 10 scenes.

**Research talk (10–20 minutes, normal or supreme).** The question (a place where the problem is felt) → why it is hard → the setup as a world (data or brain or market drawn physically) → the result drawn to scale with the error bars said aloud → what it does not show (honest limitations get their own beat) → what it means → the next question. Put citations on screen in `.source` lines.

**Keynote / idea talk (15–25 minutes, supreme).** The *Last Boring Slide* arc: boring opener → the real measurement → the mechanism → scale → stakes → it is not decided → callback ("you are here") → bookend question.

**Class presentation or lab update (5–10 minutes, normal).** One sentence → three scenes of evidence, each one place → one implication → the question you want help with.

## 9. Speaker notes

- Every beat has notes. Write them as the spoken script, in short sentences.
- Stage directions go in parentheses on their own line: "(Say it flatly. Let the slide be boring.)", "(Press next and stop talking.)", "(Let the counter run while you talk.)", "(Leave it up.)".
- Put the honest caveats and error bars here, ready for questions.
- Note what you could ask the room, and how to handle the interactive moment ("You can drag the line if someone asks.").

## 10. Case study: *The Last Boring Slide*

A talk about AI progress, built as a real-time WebGL film in one HTML file (Three.js, embedded fonts, procedural sound). What each scene does, described in our words:

| # | Scene | Place / metaphor | Beats | Devices and craft |
|---|---|---|---|---|
| 1 | The Future of AI | A deliberately dull Arial title slide, then an agenda of generic bullets, then a dull chart | 3 | Boring opener; grey Arial page numbers; the notes tell the presenter to read the bullets flatly and then stop talking. The selection box appears and the slide is remade into a bold poster ("Better.") with a red disc |
| 2 | The real chart | A white tower rising through clouds; each level is a measured time horizon; the line leaves the slide | 4 | Data to scale on a linear axis; the extrapolated part is dashed and called "only the trend continued"; error bars in the notes; page numbers start following Fibonacci |
| 3 | Anchor | A paper boat on a calm sea, chained to the bottom; the sea rises; "Let go." | 3 | A psychological bias as a physical trap; the same world changes across beats |
| 4 | The loop | A picture containing the next version of itself; a fan with one blade in 26 lit; two gears | 4 | Recursion drawn literally; specific percentages made countable (blades) |
| 5 | A country of them | One figure, then thousands, then a planet of lights; a counter of years of thinking since the slide opened | 4 | The swarm reveal (one → many) and the live counter, labelled "illustration" |
| 6 | Thirty steps | Dominoes each 1.5× the last, from a centimetre to taller than any building | 3 | Exponential growth with a familiar scale reference |
| 7 | 2027 | A wall calendar where each day is resized by how much happens in it | 4 | Time drawn as size; a callout box for key dates; source and its caveats on screen |
| 8 | How far you can see | A lantern lighting a pool in the dark; brighter lanterns; then sunrise | 3 | Intelligence as visible radius; labels pinned in 3D ("You", "Einstein") |
| 9 | Select all | Robots, then factories building factories, then the Sun; "Select all." with the selection box around a star | 3 | The selection box returns at cosmic scale; speculation explicitly labelled |
| 10 | Aim | A target in a room; one degree off; then the error at the Moon and the stars | 4 | A small error at scale, pure geometry |
| 11 | Two aims | The same bay built by the same power, aimed two ways; a draggable divider | 3 | Interactive split; "it is not decided yet" |
| 12 | You are here | The whole talk stacked as a wall rising into the sky; the camera rides down to the bottom | 2 | Callback wall with real slide thumbnails; the counter returns to "1" |
| 13 | Any questions? | Back to the dull template; "What do you want?" typed into a text box; the slide tilts by one degree | 3 | Bookend; the tilt quietly echoes the one-degree aiming error |

What to learn from it: every scene is one idea in one place; the presenter controls beats but motion inside a beat is choreographed; type is sparse and spoken; numbers are sourced on screen and caveated in the notes; the corner counter tells its own story; the dull template at both ends frames the whole talk as an act of editing.
