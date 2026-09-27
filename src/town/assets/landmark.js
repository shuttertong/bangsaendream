// The Bang Saen welcome sign: a great black-and-gold scroll curving up like a smile, on
// two white pedestals above a flight of round steps, on the roundabout island at the south
// end of the beach (วงเวียนบางแสน / วงเวียนโลมา) with leaping dolphins, a giant shell,
// sandstone rocks, hedges and a red-and-white kerb. Built at (x, y, z) facing ry.
// Returns the textured sign face (a Mesh) and solid circles for collision.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { t } from '../../shared/i18n.js';

const col = h => new THREE.Color(h);
export const SIGN = {
  W: 15, H: 2.6, Hend: 1.9, base: 3.3, rise: 3.0, bow: 1.4,   // scroll: width, face height (middle / ends), bottom edge height, end rise, forward bow
  island: 16, steps: 4, gold: '#d8ac48', white: '#f4f1ea', black: '#1c1a18',
};

/** Point on the scroll's bottom edge at u ∈ [-1, 1], its "up" across the band, and the face height there. */
function band(u) {
  const S = SIGN, p = new THREE.Vector3(u * S.W / 2, S.base + u * u * S.rise, -u * u * S.bow);
  const dy = 2 * u * S.rise / (S.W / 2);                          // slope of the bottom edge
  const up = new THREE.Vector3(-dy, 1, 0).normalize();
  return { p, up, h: S.H + (S.Hend - S.H) * u * u };
}

function signTexture() {
  const c = document.createElement('canvas');
  c.width = 2048; c.height = 360;
  const g = c.getContext('2d');
  g.fillStyle = SIGN.black; g.fillRect(0, 0, c.width, c.height);
  g.strokeStyle = SIGN.gold; g.lineWidth = 10; g.strokeRect(24, 22, c.width - 48, c.height - 44);
  g.lineWidth = 3; g.strokeRect(44, 40, c.width - 88, c.height - 80);
  g.fillStyle = SIGN.gold; g.textAlign = 'center';
  g.font = '600 92px Kanit, sans-serif'; g.fillText(t('signWelcome1'), 1024, 150);
  g.font = '600 80px Kanit, sans-serif'; g.fillText(t('signWelcome2'), 1024, 238);
  g.font = '600 58px Kanit, sans-serif'; g.fillText(t('signWelcomeEn'), 1024, 312);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/** Leaping dolphin, 1 unit ≈ 1 m, nose low at −x, arching over to the flukes at +x. */
let dolphinGeo = null;
function dolphinGeometry() {
  if (dolphinGeo) return dolphinGeo;
  const N = 28, R = 14, spine = k => { const a = -1.0 + 2.0 * k; return new THREE.Vector2(Math.sin(a) * 2.2, Math.cos(a) * 1.3 - 1.0); };
  const rad = k => k < 0.07 ? 0.05 + k * 0.9                         // beak
    : k < 0.2 ? 0.11 + ((k - 0.07) / 0.13) ** 0.6 * 0.31               // melon (rounded forehead)
    : k < 0.38 ? 0.42 + (k - 0.2) * 0.3
    : Math.max(0.07, 0.47 - (k - 0.38) * 0.73);                        // taper to the tail stock
  const pos = [], idx = [];
  for (let i = 0; i <= N; i++) {
    const k = i / N, p = spine(k), d = spine(Math.min(1, k + 0.01)).sub(spine(Math.max(0, k - 0.01))).normalize(), n = new THREE.Vector2(-d.y, d.x);
    for (let j = 0; j < R; j++) {
      const th = (j / R) * Math.PI * 2, r0 = rad(k);
      pos.push(p.x + n.x * Math.cos(th) * r0, p.y + n.y * Math.cos(th) * r0, Math.sin(th) * r0 * 0.85);
    }
  }
  for (let i = 0; i < N; i++) for (let j = 0; j < R; j++) {
    const a = i * R + j, b = i * R + (j + 1) % R, c = a + R, d = b + R;
    idx.push(a, c, b, b, c, d);
  }
  const body = new THREE.BufferGeometry();
  body.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  body.setIndex(idx);
  body.computeVertexNormals();
  const fin = pts => {                                               // flat fin, both sides
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([...pts[0], ...pts[1], ...pts[2], ...pts[0], ...pts[2], ...pts[1]], 3));
    g.computeVertexNormals();
    return g;
  };
  const at = (k, up) => { const p = spine(k), d = spine(k + 0.01).sub(spine(k - 0.01)).normalize(); return [p, d, new THREE.Vector2(-d.y, d.x).multiplyScalar(up)]; };
  const parts = [body.toNonIndexed()];
  { const [p, d, n] = at(0.48, 0.44); const b = p.clone().add(n);        // dorsal fin, swept back
    parts.push(fin([[b.x - d.x * 0.3, b.y - d.y * 0.3, 0], [b.x + d.x * 0.35, b.y + d.y * 0.35, 0], [b.x + d.x * 0.5 + n.x * 0.55, b.y + d.y * 0.5 + n.y * 0.55, 0]])); }
  { const [p, d, n] = at(0.3, -0.25); for (const sd of [-1, 1]) {        // flippers
    const b = p.clone().add(n);
    parts.push(fin([[b.x - d.x * 0.15, b.y - d.y * 0.15, sd * 0.3], [b.x + d.x * 0.25, b.y + d.y * 0.25, sd * 0.3], [b.x + d.x * 0.45 - n.x * 1.4, b.y + d.y * 0.45 - n.y * 1.4, sd * 0.75]])); } }
  { const p = spine(1), d = spine(1).sub(spine(0.97)).normalize(); for (const sd of [-1, 1]) {   // flukes
    parts.push(fin([[p.x - d.x * 0.1, p.y - d.y * 0.1, 0], [p.x + d.x * 0.25, p.y + d.y * 0.25, 0], [p.x + d.x * 0.45, p.y + d.y * 0.45, sd * 0.8]])); } }
  return (dolphinGeo = mergeGeometries(parts));
}

function dolphin(kit, f, u, v, w, ry, yaw, s, color) {
  const c = col(color), belly = col('#e2e6e8');
  const m = new THREE.Matrix4().compose(f.P(u, v, w), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), ry + yaw), new THREE.Vector3(s, s, s));
  kit.add('wall', dolphinGeometry(), m, (x, y, z, nx, ny) => (ny < -0.35 ? belly : c));
}

export function welcomeRoundabout(kit, map, { x, y, z, ry }) {
  const S = SIGN, f = kit.frame(x, y, z, ry), solids = [];
  const gold = col(S.gold), white = col(S.white), black = col(S.black);

  // island: red-and-white kerb ring, lawn, hedges, sandstone rocks
  const ringN = 48;
  for (let i = 0; i < ringN; i++) {
    const a = (i / ringN) * Math.PI * 2, u = Math.cos(a) * S.island, w = Math.sin(a) * S.island;
    f.box('wall', u, 0.15, w, 0.35, 0.3, (Math.PI * 2 * S.island) / ringN + 0.05, i % 2 ? col('#d8443a') : white, -a);
  }
  // lawn with mowing stripes
  kit.add('wall', new THREE.CylinderGeometry(S.island - 0.2, S.island - 0.2, 0.28, 48), new THREE.Matrix4().setPosition(f.P(0, 0.14, 0)), col('#6f9a4a'));
  for (let k = 1; k < 10; k += 2) kit.add('wall', new THREE.RingGeometry(k * 1.5, k * 1.5 + 1.5, 48).rotateX(-Math.PI / 2), new THREE.Matrix4().setPosition(f.P(0, 0.29, 0)), col('#7aa652'));
  const rock = (u, w, s, i) => {                                                     // sandstone boulder
    const g = new THREE.DodecahedronGeometry(1, 0).scale(s * (1 + (i % 3) * 0.2), s * 0.7, s * (1.1 - (i % 2) * 0.2));
    kit.add('wall', g, new THREE.Matrix4().makeRotationY(i * 1.3).setPosition(f.P(u, s * 0.35 + 0.2, w)), col(i % 2 ? '#c9a27a' : '#b88e66'));
  };
  const sand = ['#c9a27a', '#b88e66', '#d6b48a', '#bf9670'], bloom = ['#d8488a', '#f0c23a', '#e8543a', '#f08ab8', '#f4f1e8'];
  const shrub = (u, w, y, s, c) => kit.add('wall', new THREE.IcosahedronGeometry(s, 1), new THREE.Matrix4().setPosition(f.P(u, y + s * 0.8, w)), col(c));
  // terraced sandstone walls of stacked slabs either side of the steps, planted on top
  for (const side of [-1, 1]) for (const [rr, layers] of [[S.island - 1.6, 2], [S.island - 3.6, 4]]) {
    const top = 0.28 + layers * 0.26;
    for (let a = 0.62; a < 1.75; a += 0.075) {
      const ang = Math.PI / 2 - side * a, u = Math.cos(ang) * rr, w = Math.sin(ang) * rr;
      for (let l = 0; l < layers; l++) {
        const j = ((a * 97 + l * 13) % 1) - 0.5;
        f.box('wall', u + j * 0.15, 0.28 + l * 0.26 + 0.13, w, 0.95 + j * 0.3, 0.26, 0.75, col(sand[(Math.round(a * 40) + l) % 4]), -ang + Math.PI / 2 + j * 0.2);
      }
      f.box('wall', u, top + 0.3, w, 0.95, 0.55, 0.6, col(Math.round(a * 40) % 3 ? '#4f8a3a' : '#5f9a44'), -ang + Math.PI / 2);   // trimmed hedge
      if (Math.round(a * 40) % 3 === 0) shrub(u * 0.97, w * 0.97, top + 0.5, 0.42, bloom[Math.round(a * 13) % bloom.length]);
    }
  }
  // round topiaries and flowering shrubs round the back of the island
  for (let i = 0; i < 14; i++) {
    const a = -Math.PI / 2 + (i - 6.5) * 0.2, rr = S.island - 1.8, u = Math.cos(a) * rr, w = Math.sin(a) * rr;
    shrub(u, w, 0.1, i % 2 ? 0.8 : 0.55, i % 2 ? '#4f8a3a' : bloom[i % bloom.length]);
  }
  // round steps up to the sign (front, +w) and a platform behind
  for (let k = 0; k < S.steps; k++) {
    const rad = 7.2 - k * 0.8, h = 0.28 + k * 0.28;
    const g = new THREE.CylinderGeometry(rad, rad, 0.28, 32, 1, false, -Math.PI / 2, Math.PI);
    kit.add('wall', g, new THREE.Matrix4().makeRotationY(ry).setPosition(f.P(0, h - 0.14, 0.4)), col(k % 2 ? '#3c3a38' : '#46433f'));
  }
  const top = 0.28 * (S.steps + 1);
  f.box('wall', 0, top / 2, -1.2, 9, top, 3.2, col('#46433f'));

  // pedestals
  for (const u of [-2.3, 2.3]) {
    f.box('wall', u, top + 1.4, -0.9, 2.2, 2.8, 1.6, white);
    f.box('wall', u, top + 0.15, -0.9, 2.6, 0.3, 2.0, white);
    f.box('wall', u, top + 2.85, -0.9, 2.4, 0.18, 1.8, gold);
    solids.push({ u, w: -0.9, r: 1.5 });
  }

  // the scroll: textured front face + white back and rims + gold trim
  const N = 40, lift = top + 0.1 - S.base + 3.05;                    // bottom of the band's middle sits on the pedestals
  const pos = [], uv = [], idx = [], back = [];
  const worldOf = v => f.P(v.x, v.y + lift, v.z - 0.9);
  const edgeB = [], edgeT = [];
  for (let i = 0; i <= N; i++) {
    const u = -1 + (2 * i) / N, { p, up, h } = band(u);
    const b = worldOf(p), tp = worldOf(p.clone().addScaledVector(up, h));
    edgeB.push(b); edgeT.push(tp);
    pos.push(b.x, b.y, b.z, tp.x, tp.y, tp.z);
    uv.push(i / N, 0, i / N, 1);
    if (i) { const a = (i - 1) * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  }
  // back face (a little behind the front, facing back) + edges, in the kit
  const bk = (v, i) => { const { up } = band(-1 + (2 * i) / N); return v.clone().add(f.P(0, 0, -0.35).sub(f.P(0, 0, 0))).addScaledVector(up, 0); };
  for (let i = 1; i <= N; i++) {
    const b0 = bk(edgeB[i - 1], i - 1), b1 = bk(edgeB[i], i), t0 = bk(edgeT[i - 1], i - 1), t1 = bk(edgeT[i], i);
    back.push(...b0.toArray(), ...t0.toArray(), ...b1.toArray(), ...b1.toArray(), ...t0.toArray(), ...t1.toArray());
    kit.rod('wall', edgeT[i - 1], edgeT[i], 0.2, white);                                  // thick white rims
    kit.rod('wall', edgeB[i - 1], edgeB[i], 0.2, white);
    kit.rod('wall', edgeT[i - 1].clone().lerp(t0, 0.02), edgeT[i].clone().lerp(t1, 0.02), 0.07, gold);
  }
  kit.tris3('wall', back, black);
  // scroll rolls at both ends, with gold rings and finials
  for (const u of [-1, 1]) {
    const { p, up, h } = band(u), a = worldOf(p.clone().addScaledVector(up, -0.35)), b = worldOf(p.clone().addScaledVector(up, h + 0.35));
    kit.rod('wall', a, b, 0.6, white);
    for (const k of [0.04, 0.96]) { const m = a.clone().lerp(b, k); kit.rod('wall', m.clone().addScaledVector(up, -0.08), m.clone().addScaledVector(up, 0.08), 0.66, gold); }
    for (const [end, dir] of [[b, 1], [a, -1]]) {
      const tipA = end.clone().addScaledVector(up, dir * 0.1), tipB = end.clone().addScaledVector(up, dir * 0.75);
      kit.add('wall', new THREE.SphereGeometry(0.3, 10, 8), new THREE.Matrix4().setPosition(tipA.clone().addScaledVector(up, dir * 0.2)), gold);
      kit.rod('wall', tipA.clone().addScaledVector(up, dir * 0.35), tipB, 0.08, gold);
    }
  }
  // gold finials along the top middle
  for (const u of [-0.42, -0.24, 0, 0.24, 0.42]) {
    const { p, up, h } = band(u), base = worldOf(p.clone().addScaledVector(up, h + 0.2));
    const big = u === 0 ? 1.6 : 1;
    kit.add('wall', new THREE.SphereGeometry(0.22 * big, 10, 8), new THREE.Matrix4().setPosition(base.clone().setY(base.y + 0.15 * big)), gold);
    kit.add('wall', new THREE.ConeGeometry(0.12 * big, 0.55 * big, 8), new THREE.Matrix4().setPosition(base.clone().setY(base.y + 0.55 * big)), gold);
  }

  // dolphins leaping over a rock on the left of the steps, a giant shell on the right
  // a wave of rock the dolphins leap from
  kit.add('wall', new THREE.DodecahedronGeometry(1, 0).scale(1.3, 1.9, 1.1), new THREE.Matrix4().makeRotationY(0.6).setPosition(f.P(-6.0, 1.5, 4.0)), col('#8a9aa6'));
  rock(-5.8, 3.8, 1.3, 1); rock(-4.8, 4.8, 0.8, 2);
  dolphin(kit, f, -6.3, 3.9, 3.9, ry, 0.5, 1.2, '#7f93a3');
  dolphin(kit, f, -5.0, 3.1, 5.0, ry, 0.15, 0.95, '#8fa2b0');
  solids.push({ u: -5.8, w: 3.8, r: 1.6 });
  const shell = new THREE.CircleGeometry(1.4, 16, 0, Math.PI);
  const sp = shell.attributes.position;
  for (let i = 0; i < sp.count; i++) { const a = Math.atan2(sp.getY(i), sp.getX(i)), r0 = Math.hypot(sp.getX(i), sp.getY(i)); sp.setZ(i, Math.sin(a * 8) * 0.12 * r0 - r0 * 0.35); }
  shell.computeVertexNormals();
  const sm = new THREE.Matrix4().makeRotationY(ry + 0.4).multiply(new THREE.Matrix4().makeRotationX(-0.5)).setPosition(f.P(5.8, 0.45, 3.9));
  kit.add('wall', shell, sm, col('#efe6d6'));
  kit.add('wall', shell.clone().scale(1, 1, -1), sm, col('#e0d4c0'));
  rock(5.8, 3.9, 0.9, 3);
  solids.push({ u: 5.8, w: 3.9, r: 1.4 });
  // a Thai flag and a yellow flag on tall poles either side of the steps
  for (const [u, stripes] of [[-8.2, ['#a51931', '#f4f5f8', '#2d2a4a', '#2d2a4a', '#f4f5f8', '#a51931']], [8.2, ['#f2c417']]]) {
    f.rod('metal', [u, 0.3, 6.5], [u, 9, 6.5], 0.06, col('#e8e8e4'));
    kit.add('wall', new THREE.SphereGeometry(0.12, 8, 6), new THREE.Matrix4().setPosition(f.P(u, 9.1, 6.5)), gold);
    const hgt = 1.2, n = stripes.length;
    stripes.forEach((c2, k) => f.box('wall', u + 0.95, 8.8 - hgt * (k + 0.5) / n, 6.5, 1.8, hgt / n + 0.005, 0.02, col(c2)));
    solids.push({ u, w: 6.5, r: 0.15 });
  }

  // the lettered face (its own mesh: it needs the texture)
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const face = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ map: signTexture(), side: THREE.DoubleSide }));
  face.receiveShadow = true;

  const ca = Math.cos(ry), sa = Math.sin(ry);
  const palms = [];
  for (let i = 0; i < 9; i++) {                                                      // tall coconut palms behind the sign
    const a = -Math.PI / 2 + (i - 4) * 0.33, rr = S.island - 4.5 - (i % 2) * 2.2, u = Math.cos(a) * rr, w = Math.sin(a) * rr - 1;
    palms.push({ x: x + u * ca + w * sa, z: z - u * sa + w * ca, y: y + 0.2, rot: i * 1.7, s: 1.25 + (i % 3) * 0.12 });
  }
  return { face, palms, solids: solids.map(s => ({ x: x + s.u * ca + s.w * sa, z: z - s.u * sa + s.w * ca, r: s.r, top: y + 4 })) };
}
