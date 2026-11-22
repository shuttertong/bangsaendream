// The glowing jellyfish room in the aquarium (aquarium.js calls this): a dark room made for photos. An avenue of tall
// columns of water leads to the "moon" — a round window 5 m across full of jellies — with a marked photo spot in
// front of it; a wall tank of green moon jellies by the door; pools of light on the floor and stars on the ceiling.
// Every light is a colour that drifts slowly (one GLSL function, hueAt), and the jellies take the colour of the light
// they swim in. Nothing is animated on the CPU: the bell's pulse, the trailing tentacles, the bob and the halos are
// all in the vertex shaders. Draw calls: lights 1, floor pools 1, jellies 1 (instanced), halos + stars 1 (points).
//   buildJellyRoom(kit, { glass, solid, rnd }) → { group, labels, solids, photo, update(time) }
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { MARINE, toWorld } from './marine.js';

const M = MARINE, J = M.rooms.jelly;
export const JELLY = {
  dark: '#10172a', base: '#161d2c', trim: '#dfeaff',
  cols: { at: [[-26.5, -37.5], [-15.5, -37.5], [-27, -30.5], [-15, -30.5], [-26.5, -23.5], [-15.5, -23.5]], r: 0.8, base: 0.6, h: 3.2, n: 5,
    hues: [0.6, 0.86, 0.5, 0.74, 0.93, 0.56], size: [0.3, 0.5], glow: [0.36, 0.03] },                       // each column its own colour (0–1 round the colour wheel)
  moon: { u: -21, y: 3.0, r: 2.4, depth: 0.95, n: 46, hue: [0.58, 0.9], size: [0.42, 1.05], core: [0.8, 0.5], rim: [0.62, 0.1] },   // core / rim: [hue, brightness] of its back light
  wall: { u: [-27, -15], depth: 1.2, y: [0.7, 3.3], n: 24, lo: '#04141a', hi: '#0f6a4a', hue: [0.36, 0.46], size: [0.34, 0.58] },   // moon jellies glowing green, by the door
  pool: { r: 3, glow: 0.6, moon: [5.2, 3.4, 0.34] },                                    // light on the floor round a column; in front of the moon: [half-width, reach, glow]
  stars: { n: 300, size: [0.05, 0.11], hues: [0.52, 0.6, 0.72, 0.85] },
  motes: { n: 70, size: [0.04, 0.08] },                                                   // sparkles drifting in the moon
  halo: 1.7, haloGlow: 0.3,                                                               // a jelly's soft halo: × its size (m), and how bright
  photo: { u: -21, w: -40.3, cam: { pitch: -0.06, dist: 5.2 }, ring: 0.7 },                // where to stand, and how the camera looks at the kid
  drift: [0.05, 0.07],                                                                    // how far a light's colour wanders round the wheel, and how fast
};

const GLSL = `
uniform float time;
vec3 hue2rgb(float h) { return clamp(abs(fract(h + vec3(0.0, 2.0 / 3.0, 1.0 / 3.0)) * 6.0 - 3.0) - 1.0, 0.0, 1.0); }
float hueAt(float h) { return h + ${JELLY.drift[0].toFixed(3)} * sin(time * ${JELLY.drift[1].toFixed(3)} + h * 23.0); }
vec3 tintAt(float h, float sat) { return mix(vec3(1.0), hue2rgb(hueAt(h)), sat); }
// a jelly's slow wander: j = (hue, phase, bob height, speed)
vec3 wander(vec4 j) { float k = j.z / 0.3; return vec3(0.12 * k * sin(time * 0.11 * j.w + j.y * 3.0), j.z * sin(time * 0.35 * j.w + j.y), 0.12 * k * cos(time * 0.13 * j.w + j.y * 2.0)); }
`;

/** One jelly, bell up, about 0.84 across: attributes `sway` (0 on the bell → 1 at a tentacle's tip) and `lum` (brightness). */
function jellyGeometry() {
  const parts = [], V = (r, y) => new THREE.Vector2(r, y);
  const tag = (g, lum, sway = () => 0) => {
    g = g.index ? g.toNonIndexed() : g; g.deleteAttribute('uv');
    const p = g.attributes.position, s = new Float32Array(p.count), l = new Float32Array(p.count);
    for (let k = 0; k < p.count; k++) { s[k] = sway(p.getY(k)); l[k] = lum; }
    g.setAttribute('sway', new THREE.BufferAttribute(s, 1)); g.setAttribute('lum', new THREE.BufferAttribute(l, 1));
    parts.push(g);
  };
  tag(new THREE.LatheGeometry([V(0.001, 0.34), V(0.14, 0.325), V(0.27, 0.27), V(0.37, 0.17), V(0.42, 0.05), V(0.43, 0), V(0.4, -0.03)], 24), 0.5);   // the bell
  tag(new THREE.LatheGeometry([V(0.001, 0.26), V(0.12, 0.24), V(0.2, 0.17), V(0.22, 0.08)], 16), 0.7);                                                // the bell's lining
  for (let k = 0; k < 4; k++) tag(new THREE.TorusGeometry(0.075, 0.02, 5, 12).rotateX(Math.PI / 2).translate(Math.cos(k * 1.57 + 0.78) * 0.11, 0.2, Math.sin(k * 1.57 + 0.78) * 0.11), 1.5);   // the four rings
  for (let k = 0; k < 4; k++) {                                                                                       // ruffled arms under the middle
    const g = new THREE.PlaneGeometry(0.12, 0.62, 2, 10), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const y = p.getY(i); p.setZ(i, 0.03 * Math.sin(y * 26 + k)); p.setX(i, p.getX(i) * (1 - 0.5 * (0.31 - y) / 0.62)); }
    g.computeVertexNormals();
    tag(g.rotateY(k * 1.57 + 0.4).translate(Math.cos(k * 1.57) * 0.05, -0.25, Math.sin(k * 1.57) * 0.05), 0.85, y => THREE.MathUtils.clamp(-(y - 0.06) / 0.62, 0, 1) * 0.6);
  }
  for (let k = 0; k < 16; k++) {                                                                                      // fine tentacles from the rim
    const a = (k / 16) * Math.PI * 2, len = 0.7 + 0.3 * ((k * 7) % 5) / 4;
    tag(new THREE.CylinderGeometry(0.007, 0.003, len, 3, 7, true).translate(Math.cos(a) * 0.4, -len / 2, Math.sin(a) * 0.4), 0.75, y => THREE.MathUtils.clamp(-y / 1.0, 0, 1));
  }
  return mergeGeometries(parts);
}

/** A piece of light: `fn(x, y, z)` (the piece's own coordinates) → [hue, brightness] per vertex; then it is put in the world. */
function lightPiece(geo, mx, fn) {
  const g = geo.index ? geo.toNonIndexed() : geo, p = g.attributes.position, a = new Float32Array(p.count * 2);
  for (let k = 0; k < p.count; k++) { const [h, i] = fn(p.getX(k), p.getY(k), p.getZ(k)); a[k * 2] = h; a[k * 2 + 1] = i; }
  for (const k of Object.keys(g.attributes)) if (k !== 'position') g.deleteAttribute(k);
  g.setAttribute('glow', new THREE.BufferAttribute(a, 2));
  return g.applyMatrix4(mx);
}

export function buildJellyRoom(kit, { glass, solid, rnd: r }) {
  const C = JELLY, f = kit.frame(M.at[0], M.level, M.at[1], M.ry), floor = M.building.floor, top = M.building.ceiling, col = h => new THREE.Color(h);
  const L = M.level, uni = { time: { value: 0 }, vh: { value: 800 } }, mix = THREE.MathUtils.lerp, lights = [], pools = [], jel = [], pts = [], solids = [], labels = [];
  const at = (u, y, w) => { const [x, z] = toWorld(u, w); return new THREE.Vector3(x, L + y, z); };
  // a matrix that stands a flat shape (drawn in x, y; facing +z) at a spot, facing along +w or −w
  const zw = (() => { const [x0, z0] = toWorld(0, 0), [x1, z1] = toWorld(0, 1), v = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), M.ry); return Math.sign(v.x * (x1 - x0) + v.z * (z1 - z0)) || 1; })();
  const facing = (u, y, w, dir) => new THREE.Matrix4().makeRotationY(M.ry + (zw * dir < 0 ? Math.PI : 0)).setPosition(at(u, y, w));
  const flat = (u, y, w) => new THREE.Matrix4().makeRotationY(M.ry).multiply(new THREE.Matrix4().makeRotationX(-Math.PI / 2)).setPosition(at(u, y, w));   // lying on the floor, facing up
  const jelly = (u, y, w, size, hue, bob = 0.28) => {
    const ph = r() * 6.28, sp = 0.8 + r() * 0.5;
    jel.push({ p: at(u, y, w), size, yaw: r() * 6.28, tilt: (r() - 0.5) * 0.3, j: [hue, ph, bob, sp] });
    pts.push({ p: at(u, y + 0.12 * size, w), j: [hue, ph, bob, sp], size: C.halo * size, kind: 0 });
  };

  // ---- the room: dark walls and ceiling (the doorway to the hall stays open) ----
  const dark = col(C.dark);
  for (const [u0, u1, w0, w1] of [[J[0] + 0.25, J[1] - 0.2, J[3] - 0.3, J[3] - 0.25], [J[0] + 0.25, J[0] + 0.3, J[2] + 0.25, J[3] - 0.25], [J[1] - 0.25, J[1] - 0.2, J[2] + 0.25, -19], [J[1] - 0.25, J[1] - 0.2, -15, J[3] - 0.25]]) {
    f.box('wall', (u0 + u1) / 2, top / 2, (w0 + w1) / 2, u1 - u0, top - 0.05, w1 - w0, dark);
  }
  kit.add('wall', new THREE.PlaneGeometry(J[1] - J[0] - 0.4, J[3] - J[2] - 0.4).rotateX(Math.PI / 2), new THREE.Matrix4().makeRotationY(M.ry).setPosition(at((J[0] + J[1]) / 2, top - 0.03, (J[2] + J[3]) / 2)), dark);

  // ---- the avenue of columns ----
  const K = C.cols;
  K.at.forEach(([u, w], i) => {
    const c = at(u, floor, w), hue = K.hues[i % K.hues.length], y0 = floor + K.base, mid = new THREE.Matrix4().setPosition(c.x, L + y0 + K.h / 2, c.z);
    kit.add('wall', new THREE.CylinderGeometry(K.r + 0.15, K.r + 0.28, K.base, 24), new THREE.Matrix4().setPosition(c.x, L + floor + K.base / 2, c.z), col(C.base));
    kit.add('wall', new THREE.CylinderGeometry(K.r + 0.15, K.r + 0.15, 0.4, 24), new THREE.Matrix4().setPosition(c.x, L + y0 + K.h + 0.2, c.z), col(C.base));
    for (const y of [y0 + 0.02, y0 + K.h - 0.02]) kit.add('lit', new THREE.TorusGeometry(K.r + 0.04, 0.025, 5, 28).rotateX(Math.PI / 2), new THREE.Matrix4().setPosition(c.x, L + y, c.z), col(C.trim));   // thin rings of light
    lights.push(lightPiece(new THREE.CylinderGeometry(K.r - 0.05, K.r - 0.05, K.h, 24, 4, true).scale(-1, 1, 1), mid, (x, y) => [hue, mix(K.glow[0], K.glow[1], (y + K.h / 2) / K.h)]));   // (turned inside out: its far half shows)
    lights.push(lightPiece(new THREE.CircleGeometry(K.r - 0.05, 24), flat(u, y0 + 0.01, w), (x, y) => [hue, mix(1.1, 0.5, Math.hypot(x, y) / K.r)]));                            // the lamp under the water
    glass.push(new THREE.CylinderGeometry(K.r, K.r, K.h, 24, 1, true).applyMatrix4(mid));
    pools.push(lightPiece(new THREE.RingGeometry(K.r + 0.28, C.pool.r, 28, 5), flat(u, floor + 0.03, w), (x, y) => [hue, C.pool.glow * Math.max(0, 1 - Math.hypot(x, y) / C.pool.r) ** 1.6]));
    solids.push({ x: c.x, z: c.z, r: K.r + 0.28, top: L + y0 + K.h + 0.4 });
    for (let k = 0; k < K.n; k++) { const a = r() * 6.28, d = r() * 0.24; jelly(u + Math.cos(a) * d, y0 + 0.55 + (k + r() * 0.5) * (K.h - 1) / K.n, w + Math.sin(a) * d, mix(...K.size, r()), hue + (r() - 0.5) * 0.04, 0.2); }
  });

  // ---- the moon: a round window on the far wall, lit from behind, full of jellies ----
  { const Mo = C.moon, wf = J[2] + 0.3 + Mo.depth, wb = J[2] + 0.32, half = (J[1] - J[0]) / 2 - 0.25, uc = (J[0] + J[1]) / 2;
    const sh = new THREE.Shape([[-half, 0], [half, 0], [half, top - 0.05], [-half, top - 0.05]].map(([x, y]) => new THREE.Vector2(x, y)));
    sh.holes.push(new THREE.Path().absarc(Mo.u - uc, Mo.y, Mo.r, 0, Math.PI * 2, true));
    kit.add('wall', new THREE.ShapeGeometry(sh, 40), facing(uc, 0, wf, 1), dark);                                                   // the wall round it
    kit.add('wall', new THREE.CylinderGeometry(Mo.r, Mo.r, Mo.depth, 40, 1, true).scale(-1, 1, 1).rotateX(Math.PI / 2), facing(Mo.u, Mo.y, (wf + wb) / 2, 1), col('#0a0f1c'));   // the reveal
    kit.add('lit', new THREE.TorusGeometry(Mo.r + 0.05, 0.05, 6, 64), facing(Mo.u, Mo.y, wf + 0.03, 1), col(C.trim));               // a ring of light round the window
    lights.push(lightPiece(new THREE.CircleGeometry(Mo.r + 0.05, 48), facing(Mo.u, Mo.y, wb, 1), (x, y) => { const k = Math.min(1, Math.hypot(x, y + 0.5) / Mo.r); return [mix(Mo.core[0], Mo.rim[0], k), mix(Mo.core[1], Mo.rim[1], k)]; }));
    glass.push(new THREE.CircleGeometry(Mo.r, 40).applyMatrix4(facing(Mo.u, Mo.y, wf - 0.02, 1)));
    pools.push(lightPiece(new THREE.CircleGeometry(1, 32, 0, Math.PI), flat(Mo.u, floor + 0.03, wf + 0.02).multiply(new THREE.Matrix4().makeScale(C.pool.moon[0], -zw * C.pool.moon[1], 1)), (x, y) => [mix(Mo.core[0], Mo.rim[0], Math.abs(x)), C.pool.moon[2] * Math.max(0, 1 - Math.hypot(x, y)) ** 1.5]));   // its light spilling over the floor
    solid(J[0], J[1], J[2], wf, top);
    for (let k = 0; k < Mo.n; k++) {
      const big = k < 3, size = big ? 1.2 + r() * 0.25 : mix(...Mo.size, r() ** 2), a = r() * 6.28, d = Math.sqrt(r()) * (Mo.r - 0.25 - size * 0.45);
      jelly(Mo.u + Math.cos(a) * d, Mo.y + Math.sin(a) * d + 0.15, mix(wb + 0.3, wf - 0.3, r()), size, mix(...Mo.hue, r()), 0.26);
    }
    for (let k = 0; k < C.motes.n; k++) { const a = r() * 6.28, d = Math.sqrt(r()) * (Mo.r - 0.1); pts.push({ p: at(Mo.u + Math.cos(a) * d, Mo.y + Math.sin(a) * d, mix(wb + 0.1, wf - 0.1, r())), j: [mix(...Mo.hue, r()), r() * 6.28, 0.5, 0.6], size: mix(...C.motes.size, r()), kind: 1 }); }
    labels.push({ tank: 'jelly', u: Mo.u + 6, w: wf + 1.1, plate: { u: Mo.u + 6, y: 1.1, w: wf + 1, face: [0, 1], stand: true } });
  }

  // ---- the wall of green moon jellies by the door ----
  { const W = C.wall, [u0, u1] = W.u, w1 = J[3] - 0.32, w0 = w1 - W.depth, [ya, yb] = W.y, cl = col(W.lo), ch = col(W.hi), tmp = new THREE.Color();
    const grad = (x, y) => tmp.copy(cl).lerp(ch, THREE.MathUtils.clamp((y - L - ya) / (yb - ya), 0, 1));
    f.box('wall', (u0 + u1) / 2, (floor + ya) / 2, (w0 + w1) / 2, u1 - u0 + 0.3, ya - floor, W.depth, col(C.base));
    f.box('wall', (u0 + u1) / 2, yb + 0.3, (w0 + w1) / 2, u1 - u0 + 0.3, 0.6, W.depth, col(C.base));
    f.box('lit', (u0 + u1) / 2, (ya + yb) / 2, w1 - 0.02, u1 - u0, yb - ya, 0.04, grad);
    for (const u of [u0, u1]) f.box('lit', u, (ya + yb) / 2, (w0 + w1) / 2, 0.04, yb - ya, W.depth, grad);
    f.box('lit', (u0 + u1) / 2, yb, (w0 + w1) / 2, u1 - u0, 0.04, W.depth, ch); f.box('lit', (u0 + u1) / 2, ya, (w0 + w1) / 2, u1 - u0, 0.04, W.depth, cl);
    glass.push(new THREE.BoxGeometry(u1 - u0, yb - ya, 0.03).applyMatrix4(new THREE.Matrix4().makeRotationY(M.ry).setPosition(at((u0 + u1) / 2, (ya + yb) / 2, w0))));
    pools.push(lightPiece(new THREE.PlaneGeometry(u1 - u0, 3, 6, 4), flat((u0 + u1) / 2, floor + 0.03, w0 - 1.5), (x, y) => [0.42, 0.22 * Math.max(0, 0.5 + zw * y / 3) ** 2 * (1 - (2 * x / (u1 - u0)) ** 4)]));
    solid(u0 - 0.15, u1 + 0.15, w0, w1, yb + 0.6);
    for (let k = 0; k < W.n; k++) jelly(u0 + 0.5 + r() * (u1 - u0 - 1), ya + 0.55 + r() * (yb - ya - 1.2), mix(w0 + 0.35, w1 - 0.3, r()), mix(...W.size, r()), mix(...W.hue, r()), 0.22);
    labels.push({ tank: 'jelly', u: (u0 + u1) / 2, w: w0 - 0.8, plate: { u: u1 - 0.9, y: 0.38, w: w0 - 0.01, face: [0, -1] } });
  }

  // ---- the photo spot: a ring of light on the floor in front of the moon ----
  const Ph = C.photo, [px, pz] = toWorld(Ph.u, Ph.w), [qx, qz] = toWorld(Ph.u, Ph.w + 1);
  pools.push(lightPiece(new THREE.RingGeometry(Ph.ring - 0.07, Ph.ring, 40), flat(Ph.u, floor + 0.035, Ph.w), () => [0.55, 0.9]));
  pools.push(lightPiece(new THREE.CircleGeometry(Ph.ring - 0.07, 32), flat(Ph.u, floor + 0.035, Ph.w), (x, y) => [0.55, 0.12 * (Math.hypot(x, y) / Ph.ring) ** 2]));

  // ---- stars on the ceiling ----
  for (let k = 0; k < C.stars.n; k++) pts.push({ p: at(mix(J[0] + 0.6, J[1] - 0.6, r()), top - 0.08, mix(J[2] + 1.6, J[3] - 0.6, r())), j: [C.stars.hues[k % C.stars.hues.length], r() * 6.28, 0, 1], size: mix(...C.stars.size, r() ** 2), kind: 2 });

  // ---- the meshes ----
  const group = new THREE.Group(); group.name = 'jelly-room';
  const lightShader = (extra = {}) => new THREE.ShaderMaterial({ uniforms: uni, ...extra,
    vertexShader: `attribute vec2 glow; varying vec2 vGlow; void main() { vGlow = glow; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `${GLSL} varying vec2 vGlow; void main() { gl_FragColor = vec4(tintAt(vGlow.x, 0.9) * vGlow.y, 1.0); }` });
  const lightMesh = new THREE.Mesh(mergeGeometries(lights), lightShader());
  const poolMesh = new THREE.Mesh(mergeGeometries(pools), lightShader({ side: THREE.DoubleSide, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  poolMesh.renderOrder = 1;

  const jg = jellyGeometry(), ja = new Float32Array(jel.length * 4);
  const jm = new THREE.InstancedMesh(jg, new THREE.ShaderMaterial({ uniforms: uni, side: THREE.DoubleSide, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
    vertexShader: `${GLSL} attribute float sway; attribute float lum; attribute vec4 jel; varying float vLum; varying float vHue; varying vec3 vN; varying vec3 vV;
      void main() {
        float t = time * jel.w + jel.y, beat = sin(t * 2.1), late = sin(t * 2.1 - 1.2), bell = 1.0 - step(0.0001, sway);
        vec3 p = position;
        p.xz *= 1.0 + 0.13 * mix(late * 0.5, beat, bell);                                  // the bell opens and shuts; the arms follow late
        p.y *= 1.0 - 0.15 * beat * bell;
        p.x += sway * 0.11 * sin(t * 1.3 + position.y * 7.0 + position.z * 9.0);           // tentacles trail and wave
        p.z += sway * 0.11 * cos(t * 1.1 + position.y * 6.0 + position.x * 9.0);
        p.y -= sway * 0.07 * late;
        mat4 m = modelMatrix * instanceMatrix;
        vec4 wp = m * vec4(p, 1.0); wp.xyz += wander(jel);
        vN = mat3(m) * normal; vV = cameraPosition - wp.xyz; vLum = lum; vHue = jel.x;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: `${GLSL} varying float vLum; varying float vHue; varying vec3 vN; varying vec3 vV;
      void main() { float rim = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.0); gl_FragColor = vec4(tintAt(vHue, 0.7) * vLum * (0.3 + 1.25 * rim), 1.0); }` }), jel.length);
  const mx = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3();
  jel.forEach((o, k) => { jm.setMatrixAt(k, mx.compose(o.p, q.setFromEuler(e.set(o.tilt, o.yaw, o.tilt * 0.6)), s.setScalar(o.size))); ja.set(o.j, k * 4); });
  jg.setAttribute('jel', new THREE.InstancedBufferAttribute(ja, 4));
  jm.frustumCulled = false; jm.renderOrder = 3; jm.name = 'jellies';

  const pg = new THREE.BufferGeometry(), pp = new Float32Array(pts.length * 3), pj = new Float32Array(pts.length * 4), ps = new Float32Array(pts.length * 2);
  pts.forEach((o, k) => { o.p.toArray(pp, k * 3); pj.set(o.j, k * 4); ps[k * 2] = o.size; ps[k * 2 + 1] = o.kind; });
  pg.setAttribute('position', new THREE.BufferAttribute(pp, 3)); pg.setAttribute('jel', new THREE.BufferAttribute(pj, 4)); pg.setAttribute('ps', new THREE.BufferAttribute(ps, 2));
  const pm = new THREE.Points(pg, new THREE.ShaderMaterial({ uniforms: uni, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
    vertexShader: `${GLSL} uniform float vh; attribute vec4 jel; attribute vec2 ps; varying vec3 vCol;
      void main() {
        vec4 mv = viewMatrix * vec4(position + wander(jel), 1.0);
        float halo = 1.0 - step(0.5, ps.y), star = step(1.5, ps.y), blink = 0.55 + 0.45 * sin(time * (1.0 + jel.y * 0.3) + jel.y * 11.0);
        vCol = tintAt(jel.x, mix(0.75, 0.45, star)) * mix(mix(1.3, 1.6, star) * blink, ${C.haloGlow.toFixed(2)} * (0.85 + 0.15 * sin(time * jel.w * 2.1 + jel.y)), halo);
        gl_PointSize = min(420.0, ps.x * vh * projectionMatrix[1][1] * 0.5 / max(0.1, -mv.z));
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `varying vec3 vCol; void main() { float d = length(gl_PointCoord - 0.5) * 2.0, a = pow(max(0.0, 1.0 - d), 2.2); gl_FragColor = vec4(vCol * a, 1.0); }` }));
  pm.frustumCulled = false; pm.renderOrder = 4; pm.name = 'jelly-halos';
  pm.onBeforeRender = renderer => { const rt = renderer.getRenderTarget(); uni.vh.value = rt ? rt.height : renderer.domElement.height; };   // point sizes are in metres
  group.add(lightMesh, poolMesh, jm, pm);

  return {
    group, labels, solids,
    photo: { x: px, z: pz, yaw: Math.atan2(qx - px, qz - pz), pitch: Ph.cam.pitch, dist: Ph.cam.dist, sign: { u: Ph.u - 2.3, w: Ph.w - 0.3 } },   // stand here, facing the room: the moon is behind
    counts: { jellies: jel.length, points: pts.length },
    update(time) { uni.time.value = time; },
  };
}
