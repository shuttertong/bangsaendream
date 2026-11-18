// ลานอินไลน์สเก็ต — an inline-skating rink with a skating school, on the beach beside the promenade
// near the start. buildSkatePark() lays it out before the promenade and the beach are dressed (so
// umbrellas, palms and stalls keep off the plot): a concrete slab (a walkable deck) with a painted oval, a rail round the rink, slalom
// cones, a fun box and a grind rail, benches, floodlights and the school's kiosk with a rack of
// skates on the apron. createSkating() is the life on it: F at the rack puts skates on the kid
// (free; they glide fast and turn wide, and come off on leaving the slab), and a few skaters lap
// the oval. The lessons are the mini-game in src/skate/, taught by the teacher who stands here.
import * as THREE from 'three';
import { t, onLang } from '../shared/i18n.js';
import { buildPeopleMesh } from './people/body.js';

export const SKATE = {
  rink: { L: 30, D: 16, apron: 5 },            // the railed rink (along the shore × toward the sea), the apron behind it for the school
  // where it may stand: on the beach beside the promenade (the strip behind the beach road is full) — metres from the start,
  // its middle's distance from the sea; ground range across the plot; clear of roads (the promenade too) and buildings
  find: { from: [50, 460], sea: [19, 34], flat: 1.9, road: 6.5, houses: 22 },   // (road: the generated promenade runs along the road's sea side: keep behind it)
  oval: { straight: 16, r: 5.2, lane: 2.2 },   // the painted oval: straights, bend radius, half-width the lessons use
  ride: { speed: 7, turn: 11, accel: 14, coast: 0.7 },   // the kid on skates: top speed (running is 4.3), steering and pick-up as nimble as on foot (player.js MOVE), and how slowly they roll to a stop (m/s²)
  pose: { crouch: 0.07, forward: 0.2, hip: 0.6, knee: 1.0, sway: 0.05, lean: 0.11, edge: 0.35 },   // knees bent, body forward; hip and knee bend of the gliding leg; sideways weight shift (m); roll per rad/s of turning
  lift: 0.08,                                  // how far the wheels raise a skater off the ground
  reach: 2.4,                                  // how near the rack the F prompt shows
  skaters: { n: 5, speed: [3.4, 5.4], detail: 0.5, range: 170 },
  colors: { slab: '#bfc8cd', apron: '#cfc8b8', line: '#f4f1e8', rail: '#f4f1e8', cone: '#f08a3a', kiosk: '#eee3cc', roof: '#3a9a8a', box: '#6a9ad0', boot: '#d8443a' },
};
const col = hex => new THREE.Color(hex);

const QP = new THREE.Quaternion(), QA = new THREE.Quaternion(), EU = new THREE.Euler();
const sstep = (a, b, v) => { const u = Math.max(0, Math.min(1, (v - a) / (b - a))); return u * u * (3 - 2 * u); };
/** How far the stride cycle turns (radians) for `dist` metres at speed v: long, slow strokes at speed, shorter ones when slow. */
export const strideStep = (dist, v) => dist * Math.PI * 2 / (2.6 + 0.9 * v);

/**
 * The skating pose. One cycle of `phase` is a stroke with each leg: a leg glides under the body (knee bent, the
 * weight over it), pushes out to the side and back with the toe turned out, then lifts, tucks and swings in to land
 * as the other leg pushes. The body rides low and leans forward, sways over the gliding leg, the arms swing against
 * the legs. k (0–1): how hard the skater is working — 0 is coasting, both skates down, one a little ahead.
 * lean: roll into a turn (rad, + = to the left).
 */
export function skatePose(B, phase, k = 1, lean = 0) {
  const P = SKATE.pose, sw = Math.sin(phase);
  B.hips.position.y = B.hips.userData.rest.y - P.crouch - 0.015 * k * Math.abs(sw);   // from the rest height, not from what the walk cycle left there: its running bob at skating speed shook the whole kid
  B.hips.position.x = sw * P.sway * k;                                // the weight goes over the gliding leg (left for the first half)
  B.hips.rotation.set(P.forward + 0.06 * k, sw * -0.1 * k, -sw * 0.07 * k + lean);
  B.spine.rotation.set(P.forward * 0.9, sw * 0.16 * k, sw * 0.05 * k + lean * 0.4);
  B.head.rotation.set(-P.forward * 1.7, -sw * 0.06 * k, -lean * 0.5);
  for (const s of ['L', 'R']) {
    const sd = s === 'L' ? 1 : -1, g = (((phase + (s === 'L' ? 0 : Math.PI)) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    let hip, knee, out, toe, pitch = 0;
    if (g < Math.PI) {                                                // on the ground: glide, then push
      const push = sstep(0.45 * Math.PI, Math.PI, g) * k;
      hip = -P.hip + 0.5 * push; knee = P.knee - 0.62 * push; out = 0.05 + 0.5 * push; toe = 0.5 * push;
    } else {                                                          // in the air: lift the heel, tuck, swing in under the body
      const r = (g - Math.PI) / Math.PI, lift = Math.sin(r * Math.PI) * k, back = (1 - sstep(0, 0.75, r)) * k;
      hip = -P.hip + 0.5 * back - 0.12 * lift; knee = P.knee - 0.62 * back + 0.85 * lift; out = 0.05 + 0.5 * back * (1 - r); toe = 0.5 * back;
      pitch = 0.45 * lift;
    }
    const scissor = (1 - k) * sd * 0.12;                              // coasting: one skate a little ahead of the other
    B[`leg${s}`].rotation.set(hip - scissor, 0, sd * out); B[`shin${s}`].rotation.x = knee; 
    // the skate is set in the body's own frame, whatever the leg does: flat on its wheels, toe turned out on the push,
    // a little on its inside edge, heel lifted on the recovery — so the boot never twists off the line of the shin
    QP.setFromEuler(B.hips.rotation).multiply(QA.setFromEuler(B[`leg${s}`].rotation)).multiply(QA.setFromEuler(B[`shin${s}`].rotation)).invert();
    B[`foot${s}`].quaternion.copy(QP).multiply(QA.setFromEuler(EU.set(pitch, sd * toe, sd * (out - 0.05) * P.edge + lean, 'YXZ')));
    const swing = -sw * sd * 0.8 * k;                                 // arms against the legs, elbows bent; hanging loose when coasting
    B[`arm${s}`].rotation.set(swing - 0.15, 0, sd * (0.2 + 0.1 * k)); B[`fore${s}`].rotation.x = -0.45 - 0.5 * k - Math.max(0, swing) * 0.5;
  }
}

/** Points of the oval's centreline, clockwise, in the rink's own (u, w) metres. */
export function ovalPoints(O = SKATE.oval, step = 1) {
  const pts = [], h = O.straight / 2, n = Math.round(Math.PI * O.r / step);
  for (let u = -h; u < h; u += step) pts.push([u, -O.r]);
  for (let i = 0; i < n; i++) { const a = -Math.PI / 2 + (i / n) * Math.PI; pts.push([h + Math.cos(a) * O.r, Math.sin(a) * O.r]); }
  for (let u = h; u > -h; u -= step) pts.push([u, O.r]);
  for (let i = 0; i < n; i++) { const a = Math.PI / 2 + (i / n) * Math.PI; pts.push([-h + Math.cos(a) * O.r, Math.sin(a) * O.r]); }
  return pts;
}

/** Lay the rink out. Returns null when no plot is free, else { rink, place, rack, decks, solids, sign }. */
export function buildSkatePark(kit, scene, map, layout, start) {
  const K = SKATE, R = K.rink, F = K.find, C = K.colors, hx = R.L / 2 + 0.5, hz = (R.D + R.apron) / 2 + 0.5;
  const ground = (x, z) => map.heightAt(x, z);
  let plot = null;
  search: for (let r = F.from[0]; r <= F.from[1]; r += 14) for (let k = 0; k < 28; k++) {
    const a = (k / 28) * Math.PI * 2, x = start.x + Math.cos(a) * r, z = start.z + Math.sin(a) * r, sd = layout.seaDist(x, z);
    if (sd < F.sea[0] || sd > F.sea[1]) continue;
    const gx = layout.seaDist(x + 3, z) - layout.seaDist(x - 3, z), gz = layout.seaDist(x, z + 3) - layout.seaDist(x, z - 3), ry = Math.atan2(-gx, -gz);   // w points at the sea
    const c = Math.cos(ry), s = Math.sin(ry);
    let lo = Infinity, hi = -Infinity, ok = !layout.occ.test(x, z, hx + 2, hz + 2, ry);
    for (let u = -hx - 2; ok && u <= hx + 2; u += 4) for (let w = -hz - 2; w <= hz + 2; w += 4) {
      const px = x + u * c + w * s, pz = z - u * s + w * c, g = ground(px, pz);
      lo = Math.min(lo, g); hi = Math.max(hi, g);
      if (layout.roadIdx.clearance(px, pz, 14) < F.road || g < map.sea + 0.5) { ok = false; break; }
    }
    if (!ok || hi - lo > F.flat) continue;
    if ((map.buildings || []).some(b => b.p.some(([bx, bz]) => Math.hypot(bx - x, bz - z) < F.houses))) continue;
    plot = { x, z, ry, top: hi + 0.14 };
    break search;
  }
  if (!plot) return null;
  layout.occ.mark(plot.x, plot.z, hx + 1.5, hz + 1.5, plot.ry);
  const f = kit.frame(plot.x, plot.top, plot.z, plot.ry), w0 = R.apron / 2, wa = -R.D / 2 - R.apron / 2 + w0;   // rink centre is w0 toward the sea of the slab's; the apron's centre
  const world = (u, w) => { const p = f.P(u, 0, w + w0); return { x: p.x, z: p.z }; };                         // (u, w) in the RINK's own metres
  const solids = [], O = K.oval;
  // slab: the rink and, a shade warmer, the apron
  f.box('wall', 0, -0.9, w0, R.L + 1, 1.8, R.D + 1, col(C.slab));
  f.box('wall', 0, -0.9, wa - 0.25, R.L + 1, 1.8, R.apron + 0.5, col(C.apron));
  // the painted oval (both edges of the lane) and a dashed middle line
  for (const off of [-O.lane, O.lane]) {
    const pts = ovalPoints({ ...O, r: O.r + off }, 1.2);
    pts.forEach((p, i) => { const q = pts[(i + 1) % pts.length], a = f.P(p[0], 0.012, p[1] + w0), b = f.P(q[0], 0.012, q[1] + w0); kit.box('wall', (a.x + b.x) / 2, a.y, (a.z + b.z) / 2, Math.hypot(b.x - a.x, b.z - a.z) + 0.02, 0.012, 0.1, Math.atan2(-(b.z - a.z), b.x - a.x), col(C.line)); });
  }
  for (let u = -O.straight / 2 + 1; u < O.straight / 2; u += 2.4) f.box('wall', u, 0.012, w0, 1.1, 0.012, 0.08, col('#f2c230'));
  // slalom cones down the middle, a fun box and a grind rail inside the oval
  for (let u = -6; u <= 6; u += 2) { const p = f.P(u, 0.16, w0 + 1.6); kit.add('wall', new THREE.ConeGeometry(0.11, 0.32, 8), new THREE.Matrix4().setPosition(p), col(C.cone)); }
  f.box('wall', -4, 0.16, w0 - 1.4, 3.2, 0.32, 1.2, col(C.box)); f.box('metal', -4, 0.33, w0 - 0.82, 3.2, 0.03, 0.05, col('#d4d8dc'));
  f.rod('metal', [1.5, 0.38, w0 - 1.4], [6, 0.38, w0 - 1.4], 0.03, col('#d4d8dc'));
  for (const u of [1.8, 3.75, 5.7]) f.rod('metal', [u, 0, w0 - 1.4], [u, 0.38, w0 - 1.4], 0.025, col('#8f959b'));
  // the rail round the rink (a gap in the middle of the apron side), floodlights at the corners
  const rail = (ua, wa2, ub, wb) => {
    const n = Math.max(1, Math.round(Math.hypot(ub - ua, wb - wa2) / 2));
    for (let i = 0; i <= n; i++) { const u = ua + (ub - ua) * i / n, w = wa2 + (wb - wa2) * i / n; f.rod('metal', [u, 0, w + w0], [u, 1.0, w + w0], 0.035, col(C.rail)); const q = world(u, w); solids.push({ x: q.x, z: q.z, r: 0.22, top: plot.top + 1 }); }
    for (const y of [0.55, 1.0]) f.rod('metal', [ua, y, wa2 + w0], [ub, y, wb + w0], 0.028, col(C.rail));
    for (let i = 0; i < n; i++) { const q = world(ua + (ub - ua) * (i + 0.5) / n, wa2 + (wb - wa2) * (i + 0.5) / n); solids.push({ x: q.x, z: q.z, r: 0.22, top: plot.top + 1 }); }
  };
  const hl = R.L / 2, hd = R.D / 2;
  rail(-hl, hd, hl, hd); rail(hl, hd, hl, -hd); rail(-hl, -hd, -hl, hd); rail(-hl, -hd, -2.2, -hd); rail(2.2, -hd, hl, -hd);
  for (const [u, w] of [[-hl, hd], [hl, hd], [-hl, -hd], [hl, -hd]]) { f.rod('metal', [u, 0, w + w0], [u, 6.5, w + w0], 0.07, col('#8f959b')); f.rod('metal', [u, 6.45, w + w0], [u * 0.97, 6.45, w * 0.95 + w0], 0.04, col('#8f959b')); f.box('lit', u * 0.97, 6.5, w * 0.95 + w0, 0.7, 0.14, 0.4, col('#fff4d2')); }   // (an arm out to the lamp: it hung beside the pole)
  // benches along the apron, the school's kiosk with an awning and a rack of skates and helmets
  for (const u of [4.5, 8.5, 12.5]) { f.box('wall', u, 0.42, wa - 1.2, 2.4, 0.08, 0.5, col('#8a6a4a')); for (const s of [-1, 1]) f.box('wall', u + s * 0.95, 0.2, wa - 1.2, 0.1, 0.4, 0.45, col('#6a6a6a')); }
  const ku = -9.5, kw = wa - 0.9;
  f.box('wall', ku, 1.4, kw, 5, 2.8, 2.6, col(C.kiosk)); f.box('wall', ku, 2.95, kw, 5.6, 0.3, 3.2, col(C.roof));
  f.box('wall', ku, 1.55, kw + 1.31, 3.6, 1.1, 0.06, col('#3a3228')); f.box('wall', ku, 0.95, kw + 1.45, 3.9, 0.08, 0.4, col('#8a6a4a'));   // the counter
  f.box('wall', ku, 2.45, kw + 1.9, 5.2, 0.06, 1.3, col(C.boot));                                                                    // awning
  { const q = f.P(ku, 0, kw); solids.push({ x: q.x, z: q.z, r: 2.2, top: plot.top + 3 }, { x: f.P(ku - 1.6, 0, kw).x, z: f.P(ku - 1.6, 0, kw).z, r: 1.6, top: plot.top + 3 }, { x: f.P(ku + 1.6, 0, kw).x, z: f.P(ku + 1.6, 0, kw).z, r: 1.6, top: plot.top + 3 }); }
  const ru = -4.6, rw = wa - 0.3;
  for (const y of [0.35, 0.8, 1.25]) f.box('wall', ru, y, rw, 2.2, 0.05, 0.45, col('#8a6a4a'));
  for (const s of [-1, 1]) f.box('wall', ru + s * 1.1, 0.7, rw, 0.06, 1.4, 0.45, col('#6a6a6a'));
  for (const y of [0.33, 0.78, 1.38]) f.box('wall', ru, y, rw, 2.2, 0.04, 0.45, col('#7a7a7a'));   // shelves (the skates and helmets stood on nothing)
  for (let i = 0; i < 5; i++) for (const [y, hex] of [[0.45, ['#d8443a', '#2f6fc4', '#f2c230', '#3a9a6a', '#9a5a8a'][i]], [0.9, ['#2f6fc4', '#f08a3a', '#d8443a', '#f4f1e8', '#3a9a6a'][i]]]) f.box('wall', ru - 0.84 + i * 0.42, y, rw, 0.16, 0.2, 0.3, col(hex));
  for (let i = 0; i < 4; i++) { const p = f.P(ru - 0.75 + i * 0.5, 1.4, rw); kit.add('wall', new THREE.SphereGeometry(0.14, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.Matrix4().setPosition(p), col(['#f2c230', '#d8443a', '#2f6fc4', '#3a9a6a'][i])); }
  { const q = f.P(ru, 0, rw); solids.push({ x: q.x, z: q.z, r: 1.0, top: plot.top + 1.5 }); }
  // the school's sign over the kiosk (its own small mesh: a canvas through i18n)
  const cv = document.createElement('canvas'); cv.width = 1024; cv.height = 200;
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const sign = new THREE.Mesh(new THREE.BoxGeometry(5, 0.95, 0.1), [0, 1, 2, 3].map(() => new THREE.MeshLambertMaterial({ color: C.roof })).concat([new THREE.MeshLambertMaterial({ map: tex }), new THREE.MeshLambertMaterial({ color: C.roof })]));
  sign.position.copy(f.P(ku, 3.6, kw + 1.5)); sign.rotation.y = plot.ry; sign.castShadow = true;
  scene.add(sign);
  const draw = () => { const g = cv.getContext('2d'); g.fillStyle = C.roof; g.fillRect(0, 0, 1024, 200); g.fillStyle = '#f4f1e8'; g.textAlign = 'center'; g.font = '700 96px Kanit, Sarabun, sans-serif'; g.fillText('🛼 ' + t('skateSchool'), 512, 134); tex.needsUpdate = true; };
  draw(); onLang(draw); document.fonts?.ready.then(draw);

  const stand = f.P(0, 0, wa + 0.4), rack = f.P(ru, 0, rw + 1.0);        // the coach waits on the apron at the rink's gate
  return {
    rink: { x: world(0, 0).x, z: world(0, 0).z, ry: plot.ry, top: plot.top, world, slab: { x: plot.x, z: plot.z, hx: R.L / 2 + 0.4, hz: (R.D + R.apron) / 2 + 0.4, ry: plot.ry } },
    place: { x: stand.x, z: stand.z, yaw: plot.ry },                   // on the apron at the gate, looking at the rink
    rack: { x: rack.x, z: rack.z },
    decks: [{ x: plot.x, z: plot.z, w: R.L + 1, d: R.D + R.apron + 1, ry: plot.ry, top: plot.top }],
    solids, sign,
  };
}

/** Skates for the kid (F at the rack) and the skaters lapping the oval. park: buildSkatePark()'s result. */
export function createSkating({ scene, park, hub, player, audio, input, setLook, baseLook }) {
  if (!park) return { on: false, near: false, use() {}, off() {}, hide() {}, update() {}, prompt: () => [null, null] };
  const K = SKATE, { rink } = park, S = rink.slab, c = Math.cos(S.ry), sn = Math.sin(S.ry);
  const onSlab = (x, z) => { const dx = x - S.x, dz = z - S.z, u = dx * c - dz * sn, w = dx * sn + dz * c; return Math.abs(u) < S.hx && Math.abs(w) < S.hz; };
  const s = { on: false, near: false, phase: 0, px: 0, pz: 0, k: 0, lean: 0, yaw: 0 };
  const toast = (m, snd = 'click') => { hub.hud?.toast(m); audio?.play(snd); };
  function wear(on) { s.on = on; setLook({ ...baseLook(), skates: on ? K.colors.boot : null }); if (!on) player.state.ride = null; }
  function use() { if (!s.near || s.on) return; wear(true); s.px = player.state.x; s.pz = player.state.z; s.yaw = player.state.yaw; s.k = s.lean = 0; toast(t('skateOnToast'), 'coin'); }
  function off(quiet = false) { if (!s.on) return; wear(false); if (!quiet) toast(t('skateOffToast')); }

  // the skaters: one skinned mesh, each lapping the oval at their own pace
  const O = K.oval, pts = ovalPoints(O, 0.5), cum = [0];
  for (let i = 1; i <= pts.length; i++) { const a = pts[i - 1], b = pts[i % pts.length]; cum.push(cum[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1])); }
  const total = cum[pts.length];
  const at = (d, lane) => {
    let m = ((d % total) + total) % total, i = 0;
    while (cum[i + 1] < m) i++;
    const a = pts[i], b = pts[(i + 1) % pts.length], u = (m - cum[i]) / (cum[i + 1] - cum[i]), tx = b[0] - a[0], tz = b[1] - a[1], L = Math.hypot(tx, tz) || 1;
    const p = rink.world(a[0] + tx * u + (tz / L) * lane, a[1] + tz * u - (tx / L) * lane), q = rink.world(a[0] + tx * u + tx / L, a[1] + tz * u + tz / L);
    return { x: p.x, z: p.z, yaw: Math.atan2(q.x - rink.world(a[0] + tx * u, a[1] + tz * u).x, q.z - rink.world(a[0] + tx * u, a[1] + tz * u).z) };
  };
  const LOOKS = [
    { skin: '#c68f66', shirt: '#f0b43a', hairStyle: 'ponytail', hat: 'none', bottomColor: '#3a3a3a', outfit: 'tee' }, { skin: '#e0b08a', shirt: '#e8958a', hairStyle: 'twin', hat: 'cap', hatColor: '#f4f1e8', bottom: 'skirt', bottomColor: '#3a5a7a' },
    { skin: '#b8835c', shirt: '#3a9a6a', hairStyle: 'spiky', hat: 'none', shirtStyle: 'raglan' }, { scale: 1.26, headScale: 0.9, skin: '#d9a57c', shirt: '#2f6fc4', hairStyle: 'short', hat: 'cap', hatColor: '#d8443a', bottom: 'shorts', bottomColor: '#2a2a2a' },
    { skin: '#a8764f', shirt: '#9a5a8a', hairStyle: 'bob', hat: 'none', shirtStyle: 'stripes' },
  ].slice(0, K.skaters.n).map(l => ({ ...l, skates: ['#2f6fc4', '#d8443a', '#3a9a6a', '#f2c230', '#9a5a8a'][Math.floor(Math.random() * 5)], bag: null }));
  const crew = buildPeopleMesh(LOOKS, K.skaters.detail);
  scene.add(crew.mesh);
  const skaters = crew.people.map((p, i) => ({ p, d: (i / LOOKS.length) * total, v: K.skaters.speed[0] + (K.skaters.speed[1] - K.skaters.speed[0]) * ((i * 0.37) % 1), lane: (i % 3 - 1) * 1.1, ph: i }));

  /** After player.update. active: the kid may act. */
  function update(dt, active) {
    const p = player.state, far = Math.hypot(p.x - rink.x, p.z - rink.z) > K.skaters.range;
    crew.mesh.visible = !far && !s.hidden;
    if (!far && !s.hidden) for (const k of skaters) {
      k.d += k.v * dt; k.ph += strideStep(k.v * dt, k.v);
      const q = at(k.d, k.lane);
      let turn = k.yaw == null ? 0 : q.yaw - k.yaw; turn = Math.atan2(Math.sin(turn), Math.cos(turn)) / (dt || 1); k.yaw = q.yaw;
      k.lean = (k.lean || 0) + (Math.max(-0.3, Math.min(0.3, turn * K.pose.lean * k.v / 4)) - (k.lean || 0)) * Math.min(1, dt * 4);
      k.p.root.position.set(q.x, rink.top + SKATE.lift, q.z); k.p.root.rotation.y = q.yaw;
      k.p.bones.hips.position.copy(k.p.bones.hips.userData.rest);
      skatePose(k.p.bones, k.ph, 0.85, k.lean);
    }
    s.near = active && !s.on && Math.hypot(p.x - park.rack.x, p.z - park.rack.z) < K.reach;
    if (!s.on) return;
    if (!onSlab(p.x, p.z)) { off(true); toast(t('skateOnlyHere')); return; }
    p.ride = K.ride;
    const d = Math.hypot(p.x - s.px, p.z - s.pz); s.px = p.x; s.pz = p.z;
    // striding while the stick is pushed (harder when still picking up speed), coasting with both skates down when it is let go
    const pushing = input?.axis().mag > 0.1 ? Math.min(1, 0.55 + Math.max(0, K.ride.speed - p.speed) / 4) : 0;
    s.k += (pushing - s.k) * Math.min(1, dt * (pushing > s.k ? 6 : 2.5));
    s.phase += strideStep(d, p.speed) * (0.35 + 0.65 * s.k);
    let turn = p.yaw - s.yaw; turn = Math.atan2(Math.sin(turn), Math.cos(turn)) / (dt || 1); s.yaw = p.yaw;
    s.lean += (Math.max(-0.32, Math.min(0.32, turn * K.pose.lean * p.speed / 4)) - s.lean) * Math.min(1, dt * 5);
    skatePose(player.kid.bones, s.phase, s.k, s.lean);
    player.kid.mesh.position.y += SKATE.lift;                                // up on the wheels
  }
  return {
    update, use, off,
    /** Clear the oval (a lesson or the half-pipe is on the rink). */
    hide(on) { s.hidden = on; crew.mesh.visible = !on; },
    get on() { return s.on; }, get near() { return s.near; },
    prompt: () => (s.on ? ['skateOff', null] : s.near ? ['skateOn', null] : [null, null]),
    debug: { s, skaters, park },
  };
}
