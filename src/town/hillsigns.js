// Road signs on the Khao Sam Muk hill roads, on poles (kit) with painted faces from one canvas
// atlas (one extra mesh): ระวังลิง (the macaque warning, the hill's trademark), a curve arrow,
// chevron boards on the outside of the sharp bends, a 30 km/h limit where the road climbs onto the
// hill, and a convex mirror at the tightest hairpins. Faces are drawn by canvas code (no images).
import * as THREE from 'three';
import { HILL, outside } from './hillgeom.js';
import { rng } from './layout.js';
import { t, onLang } from '../shared/i18n.js';

export const SIGNS = {
  monkeyEvery: 190,          // m of hill road between ระวังลิง signs (alternating directions)
  chevron: { sharp: 0.5, count: 3, gap: 5 },
  mirror: { sharp: 0.7 },
  poleH: 2.1, size: 0.62, off: 0.9,
  yellow: '#f6c928', black: '#2a2623', red: '#d8322a', white: '#f6f3ea', pole: '#8d9aa3',
  tiles: ['monkey', 'curve', 'chevron', 'limit'], atlas: 128,
};
const col = h => new THREE.Color(h);

function drawTile(ctx, kind, x, y, S) {
  const g = SIGNS, c = x + S / 2, mid = y + S / 2;
  ctx.save(); ctx.translate(c, mid);
  const diamond = (fill) => { ctx.fillStyle = fill; ctx.beginPath(); ctx.moveTo(0, -S * 0.5); ctx.lineTo(S * 0.5, 0); ctx.lineTo(0, S * 0.5); ctx.lineTo(-S * 0.5, 0); ctx.closePath(); ctx.fill(); ctx.strokeStyle = g.black; ctx.lineWidth = S * 0.04; ctx.beginPath(); ctx.moveTo(0, -S * 0.43); ctx.lineTo(S * 0.43, 0); ctx.lineTo(0, S * 0.43); ctx.lineTo(-S * 0.43, 0); ctx.closePath(); ctx.stroke(); };
  if (kind === 'monkey') {
    diamond(g.yellow); ctx.fillStyle = g.black;
    ctx.beginPath(); ctx.ellipse(-S * 0.02, S * 0.08, S * 0.13, S * 0.17, 0.3, 0, 7); ctx.fill();                       // body
    ctx.beginPath(); ctx.arc(S * 0.05, -S * 0.12, S * 0.095, 0, 7); ctx.fill();                                         // head
    ctx.beginPath(); ctx.arc(S * 0.14, -S * 0.15, S * 0.04, 0, 7); ctx.arc(-S * 0.04, -S * 0.15, S * 0.04, 0, 7); ctx.fill();   // ears
    ctx.lineWidth = S * 0.05; ctx.lineCap = 'round'; ctx.strokeStyle = g.black;
    ctx.beginPath(); ctx.moveTo(-S * 0.1, S * 0.22); ctx.bezierCurveTo(-S * 0.3, S * 0.3, -S * 0.32, S * 0.0, -S * 0.2, -S * 0.08); ctx.stroke();   // tail
    ctx.beginPath(); ctx.moveTo(S * 0.08, 0); ctx.lineTo(S * 0.2, S * 0.12); ctx.moveTo(-S * 0.1, S * 0.2); ctx.lineTo(-S * 0.05, S * 0.34); ctx.moveTo(S * 0.04, S * 0.22); ctx.lineTo(S * 0.1, S * 0.34); ctx.stroke();
    ctx.fillStyle = g.yellow; ctx.beginPath(); ctx.arc(S * 0.08, -S * 0.13, S * 0.016, 0, 7); ctx.arc(S * 0.01, -S * 0.13, S * 0.016, 0, 7); ctx.fill();   // eyes
  } else if (kind === 'curve') {
    diamond(g.yellow); ctx.strokeStyle = g.black; ctx.lineWidth = S * 0.07; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(-S * 0.1, S * 0.3); ctx.lineTo(-S * 0.1, S * 0.05); ctx.quadraticCurveTo(-S * 0.1, -S * 0.2, S * 0.15, -S * 0.2); ctx.stroke();
    ctx.fillStyle = g.black; ctx.beginPath(); ctx.moveTo(S * 0.28, -S * 0.2); ctx.lineTo(S * 0.1, -S * 0.32); ctx.lineTo(S * 0.1, -S * 0.08); ctx.closePath(); ctx.fill();
  } else if (kind === 'chevron') {
    ctx.fillStyle = g.black; ctx.fillRect(-S * 0.5, -S * 0.5, S, S); ctx.fillStyle = g.yellow; ctx.fillRect(-S * 0.45, -S * 0.45, S * 0.9, S * 0.9);
    ctx.strokeStyle = g.black; ctx.lineWidth = S * 0.12; ctx.lineCap = 'butt'; ctx.lineJoin = 'miter';
    ctx.beginPath(); ctx.moveTo(-S * 0.22, -S * 0.26); ctx.lineTo(S * 0.2, 0); ctx.lineTo(-S * 0.22, S * 0.26); ctx.stroke();
  } else {                                                                                                              // speed limit 30
    ctx.fillStyle = g.red; ctx.beginPath(); ctx.arc(0, 0, S * 0.5, 0, 7); ctx.fill();
    ctx.fillStyle = g.white; ctx.beginPath(); ctx.arc(0, 0, S * 0.37, 0, 7); ctx.fill();
    ctx.fillStyle = g.black; ctx.font = `700 ${S * 0.42}px Kanit, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('30', 0, S * 0.02);
  }
  ctx.restore();
}

/** roads: hillSamples(); scene gets the sign faces; returns { solids, counts }. */
export function buildHillSigns(kit, scene, map, layout, roads) {
  const G = SIGNS, r = rng(8801), { roadIdx } = layout, solids = [], faces = [], counts = { monkey: 0, curve: 0, chevron: 0, limit: 0, mirror: 0 };
  const ground = (x, z) => Math.max(map.heightAt(x, z), map.sea);
  const tile = k => G.tiles.indexOf(k);

  // one sign: pole at the road side (driver's left = −1, right = +1), face toward the oncoming traffic of direction `dir`
  function sign(road, hw, p, side, kind, facing = -1, size = G.size, yaw = null, mirror = false) {
    const x = p.x + p.nx * side * (hw + G.off), z = p.z + p.nz * side * (hw + G.off);
    if (roadIdx.clearance(x, z, 4) < 0.5) return false;
    const y = ground(x, z), top = y + G.poleH;
    kit.rod('metal', new THREE.Vector3(x, y, z), new THREE.Vector3(x, top, z), 0.03, col(G.pole));
    // the face turns toward oncoming drivers: it looks back along the direction of travel
    const ry = yaw ?? Math.atan2(p.dx * facing, p.dz * facing);
    faces.push({ kind, mirror, m: new THREE.Matrix4().compose(new THREE.Vector3(x - Math.sin(ry) * 0.03, top + size * 0.3, z - Math.cos(ry) * 0.03), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), ry), new THREE.Vector3(size, size, 1)) });
    solids.push({ x, z, r: 0.12, top });
    counts[kind]++;
    return true;
  }

  for (const { road, hw, s: S } of roads) {
    if (!['residential', 'unclassified', 'secondary', 'tertiary'].includes(road.k)) continue;
    let sinceMonkey = G.monkeyEvery * 0.5, flip = 1, wasHill = false, chev = null;
    for (let i = 2; i < S.length - 2; i++) {
      const p = S[i];
      if (!p.hill) { wasHill = false; continue; }
      sinceMonkey += 1;
      if (!wasHill) { wasHill = true; sign(road, hw, p, -1, 'limit'); }                  // 30 km/h where the road climbs onto the hill
      // ระวังลิง: alternate directions along the hill road, on the driver's left
      if (sinceMonkey >= G.monkeyEvery && Math.abs(p.turn) < 0.15 && !p.fall[0] && sign(road, hw, p, flip > 0 ? -1 : 1, 'monkey', -flip)) { sinceMonkey = 0; flip = -flip; }
      // sharp bend: a chevron run on the outside, a curve arrow before it, a mirror at the tightest
      const sharp = Math.abs(p.turn);
      if (sharp > G.chevron.sharp && !(chev && i - chev < G.chevron.gap * 6)) {
        chev = i; const out = outside(p);
        for (let c = 0; c < G.chevron.count; c++) { const q = S[Math.min(S.length - 1, i + c * G.chevron.gap - G.chevron.gap)]; if (q?.hill) sign(road, hw, q, out, 'chevron', 1, G.size * 0.9, Math.atan2(-q.nx * out, -q.nz * out), out > 0); }   // faces the road, arrow along the way the road goes
        const before = S[Math.max(0, i - 24)]; if (before?.hill) sign(road, hw, before, -1, 'curve', -1, G.size, null, p.turn > 0);   // the arrow bends the way the road does
        if (sharp > G.mirror.sharp) { const q = S[i]; const x = q.x + q.nx * out * (hw + 1.0), z = q.z + q.nz * out * (hw + 1.0), y = ground(x, z);
          if (roadIdx.clearance(x, z, 4) > 0.5) { kit.rod('metal', new THREE.Vector3(x, y, z), new THREE.Vector3(x, y + 2.2, z), 0.03, col(G.pole));
            kit.add('wall', new THREE.CylinderGeometry(0.34, 0.34, 0.04, 20).rotateX(Math.PI / 2), new THREE.Matrix4().makeRotationY(Math.atan2(-q.nx * out, -q.nz * out)).setPosition(x, y + 2.55, z), col('#e8742a'));
            kit.add('lit', new THREE.CylinderGeometry(0.29, 0.29, 0.05, 20).rotateX(Math.PI / 2), new THREE.Matrix4().makeRotationY(Math.atan2(-q.nx * out, -q.nz * out)).setPosition(x + (-q.nx * out) * 0.0, y + 2.55, z + 0), col('#cfe0e4'));
            solids.push({ x, z, r: 0.12, top: y + 2.2 }); counts.mirror++; } }
      }
    }
  }
  if (!faces.length) return { solids, counts };

  // faces: one canvas atlas, one mesh
  const S = G.atlas, canvas = document.createElement('canvas'); canvas.width = S * G.tiles.length; canvas.height = S;
  const tex = new THREE.CanvasTexture(canvas); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const redraw = () => { const ctx = canvas.getContext('2d'); ctx.clearRect(0, 0, canvas.width, canvas.height); G.tiles.forEach((k, i) => drawTile(ctx, k, i * S, 0, S)); tex.needsUpdate = true; };
  redraw(); document.fonts?.ready.then(redraw); onLang(redraw);
  const pos = [], uv = [], idx = [];
  faces.forEach(({ kind, m, mirror }, n) => {
    const q = [[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5]], u0 = tile(kind) / G.tiles.length, du = 1 / G.tiles.length, v = new THREE.Vector3();
    q.forEach(([x, y]) => { v.set(x, y, 0).applyMatrix4(m); pos.push(v.x, v.y, v.z); uv.push(u0 + ((mirror ? -x : x) + 0.5) * du, y + 0.5); });
    idx.push(n * 4, n * 4 + 1, n * 4 + 2, n * 4, n * 4 + 2, n * 4 + 3);
  });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.setIndex(idx); geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ map: tex, alphaTest: 0.4, side: THREE.DoubleSide }));
  mesh.castShadow = false; mesh.receiveShadow = true; scene.add(mesh);
  return { solids, counts, mesh };
}
