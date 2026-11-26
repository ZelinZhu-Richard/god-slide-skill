// Physical cards in 3D: slides, photos, papers, screenshots. Rounded corners, a thin paper
// edge, a soft contact shadow. ctx.thumb('scene-id') gives a texture of any earlier scene,
// so a final "you are here" scene can stack the whole talk as a wall.
//
//   const c = kit.card({ map: ctx.thumb('tower'), w: 16, h: 9 });
//   scene.add(c.group);
//   const w = kit.wall(ctx, ['open','tower','boat'], { w: 16, gap: 1.2 });
import * as THREE from 'three';

const alphaCache = {};
function roundedAlpha(aspect, radius) {
  const key = aspect.toFixed(3) + ':' + radius;
  if (alphaCache[key]) return alphaCache[key];
  const W = 512, H = Math.max(8, Math.round(512 / aspect));
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
  g.fillStyle = '#fff';
  const r = radius * W;
  g.beginPath();
  if (g.roundRect) g.roundRect(0, 0, W, H, r); else g.rect(0, 0, W, H);
  g.fill();
  const t = new THREE.CanvasTexture(c);
  return (alphaCache[key] = t);
}

let shadowTex = null;
function contactShadow() {
  if (shadowTex) return shadowTex;
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(64, 64, 8, 64, 64, 64);
  grd.addColorStop(0, 'rgba(0,0,0,.55)'); grd.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 128, 128);
  return (shadowTex = new THREE.CanvasTexture(c));
}

export function card({ map = null, w = 16, h = 9, radius = 0.012, color = '#ffffff', roughness = 0.85, border = 0, shadow = false, emissive = 0, lit = true } = {}) {
  const group = new THREE.Group();
  const matOpts = { map, color, alphaMap: roundedAlpha(w / h, radius), alphaTest: 0.5, side: THREE.DoubleSide };
  const mat = lit ? new THREE.MeshStandardMaterial({ ...matOpts, roughness, metalness: 0, emissive: emissive ? new THREE.Color(1, 1, 1) : 0x000000, emissiveMap: emissive ? map : null, emissiveIntensity: emissive })
    : new THREE.MeshBasicMaterial(matOpts);
  const face = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  face.castShadow = true; face.receiveShadow = true;
  group.add(face);
  if (border > 0) {
    const back = new THREE.Mesh(new THREE.PlaneGeometry(w + border * 2, h + border * 2), new THREE.MeshStandardMaterial({ color: '#f4f2ee', roughness: 0.8, alphaMap: roundedAlpha((w + border * 2) / (h + border * 2), radius), alphaTest: 0.5, side: THREE.DoubleSide }));
    back.position.z = -0.01; back.castShadow = true;
    group.add(back);
  }
  if (shadow) {
    const sh = new THREE.Mesh(new THREE.PlaneGeometry(w * 1.25, h * 0.5), new THREE.MeshBasicMaterial({ map: contactShadow(), transparent: true, depthWrite: false }));
    sh.rotation.x = -Math.PI / 2; sh.position.set(0, -h / 2 + 0.01, 0.2);
    group.add(sh);
  }
  return { group, face, material: mat, w, h };
}

/** Stack scene thumbnails as a vertical wall (bottom = first scene) or a grid. */
export function wall(ctx, ids, { w = 16, gap = 1.2, cols = 1, tilt = 0, border = 0.25, emissive = 0.55 } = {}) {
  const h = (w * 9) / 16;
  const group = new THREE.Group();
  const cards = ids.map((id, i) => {
    const c = card({ map: typeof id === 'string' ? ctx.thumb(id) : id, w, h, border, emissive });
    const col = i % cols, row = Math.floor(i / cols);
    c.group.position.set((col - (cols - 1) / 2) * (w + gap), row * (h + gap) + h / 2, 0);
    c.group.rotation.x = tilt;
    group.add(c.group);
    return c;
  });
  return { group, cards, w, h };
}
