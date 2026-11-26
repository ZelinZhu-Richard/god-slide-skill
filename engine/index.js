// god-slide engine. Decks import from 'god-slide' (aliased to this file by scripts/build.mjs).
import { backdrop } from './kit/backdrop.js';
import { sky, env, SKY_PRESETS, SKY_GLSL } from './kit/sky.js';
import { ocean } from './kit/ocean.js';
import { city, ground } from './kit/city.js';
import { terrain } from './kit/terrain.js';
import { particles } from './kit/particles.js';
import { globe } from './kit/globe.js';
import { card, wall } from './kit/cards.js';
import { rig, lights } from './kit/rig.js';
import { textMesh, textTexture, textCanvas, odometer } from './kit/text.js';
import { officeChart } from './kit/office.js';
import { createSelect } from './kit/select.js';
import { glare } from './kit/glare.js';

export { createDeck } from './core/deck.js';
export { ease, clamp, lerp, mix, remap, smoothstep, damp, rng, fmt, fib, TAU } from './core/ease.js';
export { LIB, HASH, NOISE, COLOR } from './core/glsl.js';
export { TRANSITIONS } from './fx/transitions.js';
export { POST_PRESETS } from './fx/post.js';
export { SKY_PRESETS, SKY_GLSL };

export const kit = {
  backdrop, sky, env, ocean, city, ground, terrain, particles, globe, card, wall, rig, lights,
  textMesh, textTexture, textCanvas, odometer, officeChart, glare, select: createSelect,
};
