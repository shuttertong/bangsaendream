// Auras from the wardrobe (bubbles, hearts, sparkles, the legendary one): a little cloud of
// sprites that drifts around a person. One Points object per person, positions updated on the
// CPU (a few dozen particles each, nothing to notice). Works for the kid and for other players.
import * as THREE from 'three';
import { byId } from '../shared/wardrobe.js';

const AURA = {
  bubbles: { n: 18, size: 0.14, rise: 0.35, radius: 0.5, additive: false, sprite: 'ring' },
  hearts: { n: 16, size: 0.16, rise: 0.4, radius: 0.45, additive: false, sprite: 'heart' },
  sparkle: { n: 26, size: 0.12, rise: 0.5, radius: 0.5, additive: true, sprite: 'star' },
  legend: { n: 40, size: 0.18, rise: 0.6, radius: 0.65, additive: true, sprite: 'star' },
};
const sprites = {};
function sprite(kind) {
  if (sprites[kind]) return sprites[kind];
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 5; ctx.translate(32, 32);
  if (kind === 'ring') { ctx.beginPath(); ctx.arc(0, 0, 24, 0, 7); ctx.stroke(); ctx.globalAlpha = 0.25; ctx.beginPath(); ctx.arc(0, 0, 22, 0, 7); ctx.fill(); ctx.globalAlpha = 1; ctx.beginPath(); ctx.arc(-9, -9, 5, 0, 7); ctx.fill(); }
  else if (kind === 'heart') { ctx.beginPath(); ctx.moveTo(0, 22); ctx.bezierCurveTo(-34, -4, -14, -30, 0, -12); ctx.bezierCurveTo(14, -30, 34, -4, 0, 22); ctx.fill(); }
  else { ctx.beginPath(); for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2 - Math.PI / 2, r = i % 2 ? 10 : 26; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); } ctx.closePath(); ctx.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return (sprites[kind] = t);
}

export function createAuras(scene) {
  const live = new Map();   // key → { pts, cfg, phase[], get }
  function set(key, id, get) {
    remove(key);
    const cfg = AURA[id]; if (!cfg) return;
    const geo = new THREE.BufferGeometry(), pos = new Float32Array(cfg.n * 3), colors = new Float32Array(cfg.n * 3);
    const base = new THREE.Color(byId[id]?.c?.[0] || '#ffffff'), tint = new THREE.Color();
    for (let i = 0; i < cfg.n; i++) tint.copy(base).lerp(new THREE.Color('#ffffff'), Math.random() * 0.5).toArray(colors, i * 3);
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const mat = new THREE.PointsMaterial({ size: cfg.size, map: sprite(cfg.sprite), vertexColors: true, transparent: true, depthWrite: false, opacity: 0.9, blending: cfg.additive ? THREE.AdditiveBlending : THREE.NormalBlending, sizeAttenuation: true });
    const pts = new THREE.Points(geo, mat); pts.frustumCulled = false; pts.renderOrder = 5;
    scene.add(pts);
    live.set(key, { pts, cfg, get, phase: Array.from({ length: cfg.n }, () => Math.random() * 1000) });
  }
  function remove(key) { const a = live.get(key); if (!a) return; scene.remove(a.pts); a.pts.geometry.dispose(); a.pts.material.dispose(); live.delete(key); }
  const v = new THREE.Vector3();
  function update(time) {
    for (const a of live.values()) {
      const c = a.get(v); if (!c) { a.pts.visible = false; continue; }
      a.pts.visible = true;
      const p = a.pts.geometry.attributes.position, { n, rise, radius } = a.cfg;
      for (let i = 0; i < n; i++) {
        const ph = a.phase[i], t = time * 0.5 + ph, h = ((time * rise + ph) % 1.6), r = radius * (0.7 + 0.3 * Math.sin(ph + time));
        p.setXYZ(i, c.x + Math.cos(t) * r, c.y + h, c.z + Math.sin(t) * r);
      }
      p.needsUpdate = true;
    }
  }
  return { set, remove, update, has: key => live.has(key) };
}
