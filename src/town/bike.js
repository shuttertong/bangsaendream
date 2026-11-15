// จักรยานสามที่นั่ง — the Bang Saen three-seat bicycle. Rent one at a rental point (every 500 m along
// the coast; ฿50, yours until the day ends), ride it from the front saddle, and friends online can hop
// on the two saddles behind: every extra pair of legs makes it faster. A bike may only be left at a
// bicycle park (a blue P sign, every 200 m; rental points count too).
// Netcode (co-op channel, no host): the renter says { k: 'bk', e: 'ride' } while riding and 'park'
// when getting off; a passenger says { k: 'bk', e: 'on', i: renter } and 'off'. Both repeat every
// BIKES.beat seconds, so newcomers catch up and a lost player times out. Every device seats the
// passengers by their sorted ids and draws them on its own copy of the bike (no lag behind it).
import * as THREE from 'three';
import { paintedMaterial } from '../world/materials.js';
import { t, onLang } from '../shared/i18n.js';
import * as P from '../shared/progress.js';
import { dayKey } from '../shared/wardrobe.js';
import { BIKE, bikeGeometry, seatAt } from './assets/bike.js';
import { paint } from '../shared/beachset.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const BIKES = {
  fee: 50,                                   // ฿ for the day
  speed: [0, 5.2, 6.4, 7.4],                 // m/s with 1, 2, 3 riders
  turn: 3.2, accel: 5,                       // steering (rad/s) and pick-up (m/s²): a long bike, not a kid on foot
  reach: 2.4, joinReach: 3.2, fetch: 14,     // how near the prompts show (m); beyond `fetch` a rental point offers to bring the bike back
  every: { rent: 500, park: 200 },           // a rental point every 500 m along the coast, a bicycle park every 200 m (the only places to leave a bike)
  parkReach: 7, inland: [30, 38, 22, 46, 14], // how near a park counts (m); how far in from the waterline a station may stand (tried in turn)
  beat: 2, expire: 6,                        // seconds between "still riding" messages; silence after which a rider is dropped
  clear: 1.4,                                // free radius a station needs (m)
  pedal: 1.1,                                // metres travelled per turn of the cranks
  key: 'bangsaen.bike.v1',
  frames: ['#4fb3a8', '#f0b43a', '#e8958a'],
};
const ME = 0;                                // our id while offline

/** The riding pose: hips on the saddle, leaning to the bars, legs turning the cranks (phase in radians). */
export function bikePose(B, phase) {
  B.hips.position.y = BIKE.saddle + 0.03;
  B.hips.rotation.set(0.1, 0, 0); B.spine.rotation.set(0.24, 0, 0); B.head.rotation.set(-0.26, 0, 0);
  for (const s of ['L', 'R']) {
    const c = Math.cos(phase + (s === 'L' ? 0 : Math.PI));
    B[`leg${s}`].rotation.set(-0.95 + 0.38 * c, 0, s === 'L' ? 0.07 : -0.07); B[`shin${s}`].rotation.x = 1.3 - 0.48 * c; B[`foot${s}`].rotation.x = -0.25;
    B[`arm${s}`].rotation.set(-0.98, 0, s === 'L' ? 0.14 : -0.14); B[`fore${s}`].rotation.x = -0.32;
  }
}

export function createBikes({ scene, hub, mp, player, map, lift, collision, audio, seaDist, at }) {
  // (at: the start beach — the first rental point stands nearest to it)
  const ground = (x, z) => Math.max(map.heightAt(x, z) + lift(x, z), map.sea);
  const myId = () => mp?.id ?? ME, now = () => performance.now() / 1000;
  const toast = (m, snd = 'coin') => { hub.hud?.toast(m); audio?.play(snd); };
  const mat = paintedMaterial({ amp: 0.05, scale: 1 });
  const newBike = hex => { const m = new THREE.Mesh(bikeGeometry(hex), mat); m.castShadow = true; scene.add(m); return m; };

  // ---------- stations along the coast: rental points and bicycle parks ----------
  // walk the coastline both ways from the start beach; a station stands a little inland of the waterline, on free ground
  const stations = [];
  {
    const half = (map.core.nx - 1) * map.core.step / 2 - 40, line = [];
    for (const c of map.coast) for (let i = 1; i < c.p.length; i++) {
      const [ax, az] = c.p[i - 1], [bx, bz] = c.p[i], L = Math.hypot(bx - ax, bz - az);
      for (let d = 0; d < L; d += 10) { const x = ax + (bx - ax) * d / L, z = az + (bz - az) * d / L; if (Math.abs(x) < half && Math.abs(z) < half) line.push([x, z, (bz - az) / L, -(bx - ax) / L]); }   // (land is on the left of a coastline way)
    }
    const spot = ([x, z, nx, nz]) => {
      for (const inl of BIKES.inland) for (const sgn of [1, -1]) {
        const px = x + nx * inl * sgn, pz = z + nz * inl * sgn;
        if (seaDist(px, pz) > 8 && collision.free(px, pz, BIKES.clear, ground(px, pz))) return { x: px, z: pz, y: ground(px, pz), yaw: Math.atan2(x - px, z - pz) };   // facing the sea
      }
      return null;
    };
    const far = (q, kind, d) => stations.every(st => (kind === 'rent' && st.kind !== 'rent') || Math.hypot(st.x - q[0], st.z - q[1]) >= d);
    let i0 = 0;
    if (at) line.forEach((q, i) => { if (Math.hypot(q[0] - at.x, q[1] - at.z) < Math.hypot(line[i0][0] - at.x, line[i0][1] - at.z)) i0 = i; });
    const order = [...line.slice(i0), ...line.slice(0, i0).reverse()];
    for (const q of order) {
      const kind = far(q, 'rent', BIKES.every.rent) ? 'rent' : far(q, 'park', BIKES.every.park) ? 'park' : null, st = kind && spot(q);
      if (st) stations.push({ ...st, kind });
    }
  }
  const sign = { cv: document.createElement('canvas'), tex: null };
  /** A station's local point (u across, w out in front) in the world. */
  const local = (st, u, w, out = {}) => { out.x = st.x + Math.cos(st.yaw) * u + Math.sin(st.yaw) * w; out.z = st.z - Math.sin(st.yaw) * u + Math.cos(st.yaw) * w; return out; };
  if (stations.length) {
    const racks = [], boards = [], M = new THREE.Matrix4();
    for (const st of stations) {
      const rent = st.kind === 'rent', parts = [paint(new THREE.CylinderGeometry(0.03, 0.03, 2.6, 8).rotateZ(Math.PI / 2).translate(0, 0.5, -1.3), '#d4d8dc')];
      for (const x of [-1.25, 0, 1.25]) parts.push(paint(new THREE.CylinderGeometry(0.03, 0.03, 0.5, 8).translate(x, 0.25, -1.3), '#d4d8dc'));
      if (rent) parts.push(bikeGeometry(BIKES.frames[1 + stations.indexOf(st) % 2]).rotateZ(0.08).translate(-0.85, 0, 0));
      parts.push(paint(new THREE.CylinderGeometry(0.035, 0.035, 2.1, 8).translate(1.75, 1.05, -1.2), '#8a6a4a'), paint(new THREE.BoxGeometry(rent ? 1.5 : 0.74, 0.62, 0.05).translate(1.75, 1.95, -1.2), rent ? '#f2c230' : '#2f6fc4'));
      M.makeRotationY(st.yaw).setPosition(st.x, st.y, st.z);
      racks.push(mergeGeometries(parts).applyMatrix4(M));
      for (const sd of [1, -1]) {                                       // the sign's face, both sides: a region of the one canvas
        const g = new THREE.PlaneGeometry(rent ? 1.42 : 0.7, 0.58), uv = g.attributes.uv;
        for (let i = 0; i < uv.count; i++) uv.setXY(i, rent ? uv.getX(i) : 0.02 + uv.getX(i) * 0.47, rent ? 0.5 + uv.getY(i) * 0.5 : uv.getY(i) * 0.5);
        if (sd < 0) g.rotateY(Math.PI);
        boards.push(g.translate(1.75, 1.95, -1.2 + sd * 0.03).applyMatrix4(M));
      }
    }
    const m = new THREE.Mesh(mergeGeometries(racks), mat);
    m.castShadow = m.receiveShadow = true;
    sign.cv.width = 512; sign.cv.height = 400;
    sign.tex = new THREE.CanvasTexture(sign.cv); sign.tex.colorSpace = THREE.SRGBColorSpace; sign.tex.anisotropy = 4;
    scene.add(m, new THREE.Mesh(mergeGeometries(boards), new THREE.MeshLambertMaterial({ map: sign.tex, transparent: true, polygonOffset: true, polygonOffsetFactor: -2 })));
    const draw = () => {
      const g = sign.cv.getContext('2d');
      g.clearRect(0, 0, 512, 400); g.fillStyle = '#3a2a1a'; g.textAlign = 'center';
      g.font = '700 64px Kanit, Sarabun, sans-serif'; g.fillText('🚲 ' + t('bikeSign'), 256, 92);
      g.font = '600 44px Kanit, Sarabun, sans-serif'; g.fillText(t('bikeSign2', { n: BIKES.fee }), 256, 160);
      g.fillStyle = '#ffffff'; g.font = '800 120px Kanit, Sarabun, sans-serif'; g.fillText('P', 130, 318);          // bicycle park
      g.font = '600 30px Kanit, Sarabun, sans-serif'; g.fillText('🚲 ' + t('bikeP'), 130, 372);
      sign.tex.needsUpdate = true;
    };
    draw(); onLang(draw); document.fonts?.ready.then(draw);
  }
  const rack = stations[0] || null;                                     // the rental point by the start beach
  /** The nearest station to (x, z): any, or only rental points. */
  const nearestStation = (x, z, rentOnly = false) => stations.reduce((b, st) => { const d = Math.hypot(st.x - x, st.z - z); return (!rentOnly || st.kind === 'rent') && (!b || d < b.d) ? { st, d } : b; }, null);

  // ---------- my bike ----------
  let day = null, saved = null;
  try { saved = JSON.parse(localStorage.getItem(BIKES.key) || 'null'); day = saved?.day || null; } catch { /* storage blocked */ }
  const save = () => { try { localStorage.setItem(BIKES.key, JSON.stringify({ day, x: +mine.x.toFixed(1), z: +mine.z.toFixed(1), yaw: +mine.yaw.toFixed(2) })); } catch { /* storage blocked */ } };
  const rented = () => !!rack && day === dayKey();
  const mine = { mesh: newBike(BIKES.frames[0]), x: 0, z: 0, yaw: 0, phase: 0 };
  /** Stand my bike in a station's free slot. */
  const parkAt = st => { const q = local(st, 0.45, 0); Object.assign(mine, { x: q.x, z: q.z, yaw: st.yaw }); save(); };
  if (saved && Number.isFinite(saved.x) && Number.isFinite(saved.z)) Object.assign(mine, { x: saved.x, z: saved.z, yaw: saved.yaw || 0 }); else if (rack) parkAt(rack);
  const s = { mode: 'none', owner: null, near: null, crew: 1, beatT: 0, px: 0, pz: 0 };   // mode: none | riding | aboard (on `owner`'s bike)
  const owners = new Map(), pass = new Map();        // remote renters riding: id → { t, mesh, phase, x, z }; remote passengers: id → { owner, t }

  const fwd = (yaw, d, out) => out.set(Math.sin(yaw) * d, 0, Math.cos(yaw) * d);
  const v = new THREE.Vector3(), seat0 = BIKE.seats[0];
  /** Put a bike mesh under a front rider at (x, y, z) facing yaw. */
  const setBike = (mesh, x, y, z, yaw) => { fwd(yaw, -seat0, v); mesh.position.set(x + v.x, y, z + v.z); mesh.rotation.y = yaw; mesh.visible = true; };
  /** Which saddle (1 or 2) passenger `id` has on `owner`'s bike: by sorted ids, the same on every device; −1 = no room. */
  function seatOf(id, owner) {
    const ids = [...pass].filter(([, p]) => p.owner === owner).map(([k]) => k);
    if (s.mode === 'aboard' && s.owner === owner) ids.push(myId());
    const i = ids.sort((a, b) => a - b).indexOf(id);
    return i >= 0 && i < 2 ? i + 1 : -1;
  }
  const send = d => mp?.co.send(null, { k: 'bk', ...d });
  const side = (x, z, yaw) => {                       // a free spot to step off to, beside the bike
    for (const [dx, dz] of [[-0.9, 0], [0.9, 0], [-1.4, 0.8], [1.4, -0.8], [0, -2]]) {
      const px = x + Math.cos(yaw) * dx + Math.sin(yaw) * dz, pz = z - Math.sin(yaw) * dx + Math.cos(yaw) * dz;
      if (collision.free(px, pz, 0.3, ground(px, pz))) return [px, pz];
    }
    return [x, z];
  };

  function mount() {
    const p = player.state;
    fwd(mine.yaw, seat0, v);
    player.place(mine.x + v.x, mine.z + v.z, mine.yaw);
    Object.assign(s, { mode: 'riding', crew: 1, beatT: 0, px: p.x, pz: p.z });
    audio?.play('click');
  }
  function off(quiet = false) {
    const p = player.state;
    if (s.mode === 'riding') {
      const n = nearestStation(p.x, p.z);                              // a bike may only be left at a bicycle park
      if (!n || n.d > BIKES.parkReach) { if (!quiet) toast(t('bikeParkOnly'), 'thud'); return; }
      send({ e: 'park' }); p.ride = null;
      parkAt(n.st);
      if (!quiet) toast(t('bikeParked'), 'click');
    } else if (s.mode === 'aboard') send({ e: 'off' });
    else return;
    const from = s.mode === 'riding' ? mine : p;
    s.mode = 'none'; s.owner = null;
    player.kid.bones.hips.position.copy(player.kid.bones.hips.userData.rest);
    player.place(...side(from.x, from.z, from.yaw), p.yaw);
    if (!quiet) audio?.play('thud');
  }
  function use() {
    const n = s.near;
    if (!n) return;
    if (n.kind === 'rent') {
      if (P.get().baht < BIKES.fee) { toast(t('bikeNoMoney', { n: BIKES.fee }), 'thud'); return; }
      P.addBaht(-BIKES.fee);
      day = dayKey();
      parkAt(n.st);
      toast(t('bikeRented'), 'fanfare');
    } else if (n.kind === 'fetch') { parkAt(n.st); toast(t('bikeFetched'), 'click'); }
    else if (n.kind === 'ride') mount();
    else if (n.kind === 'join') { Object.assign(s, { mode: 'aboard', owner: n.id, beatT: 0 }); audio?.play('click'); }
  }

  mp?.co.on((from, d) => {
    if (d.k === 'gone') { drop(from); pass.delete(from); return; }
    if (d.k !== 'bk') return;
    if (d.e === 'ride') owners.set(from, { mesh: null, phase: 0, x: null, z: null, ...owners.get(from), t: now() });
    else if (d.e === 'park') drop(from);
    else if (d.e === 'on' && Number.isInteger(d.i)) pass.set(from, { owner: d.i, t: now() });
    else if (d.e === 'off') pass.delete(from);
  });
  function drop(id) {
    const o = owners.get(id);
    if (o?.mesh) { scene.remove(o.mesh); o.mesh.geometry.dispose(); }
    owners.delete(id);
    if (s.mode === 'aboard' && s.owner === id) off(true);
  }

  /** multiplayer.js asks for each remote player: draw them on a bike? (r: the remote, st: its sampled state) */
  function remote(r, st) {
    const B = r.kid.bones, o = owners.get(r.id);
    if (o) {
      if (!o.mesh) o.mesh = newBike(BIKES.frames[r.id % BIKES.frames.length]);
      if (o.x != null) o.phase += Math.hypot(st.x - o.x, st.z - o.z) / BIKES.pedal * Math.PI * 2;
      o.x = st.x; o.z = st.z;
      r.kid.mesh.position.set(st.x, st.y, st.z); r.kid.mesh.rotation.y = st.yaw;
      bikePose(B, o.phase);
      setBike(o.mesh, st.x, st.y, st.z, st.yaw);
      return true;
    }
    const ps = pass.get(r.id);
    if (!ps) return false;
    const idx = seatOf(r.id, ps.owner), me = ps.owner === myId() && s.mode === 'riding', host = me ? null : mp.remotes.get(ps.owner);
    if (idx < 0 || (!me && !(host && owners.has(ps.owner)))) return false;
    const src = me ? player.kid.mesh : host.kid.mesh, yaw = src.rotation.y;
    fwd(yaw, BIKE.seats[idx] - seat0, v);
    r.kid.mesh.position.set(src.position.x + v.x, src.position.y, src.position.z + v.z); r.kid.mesh.rotation.y = yaw;
    bikePose(B, (me ? mine.phase : owners.get(ps.owner).phase) + idx * 1.3);
    return true;
  }

  /** After player.update: ride, follow, and find what the F prompt offers. active = the kid may act. */
  function update(dt, active) {
    const p = player.state, tt = now();
    for (const [id, o] of owners) if (tt - o.t > BIKES.expire) drop(id);
    for (const [id, ps] of pass) if (tt - ps.t > BIKES.expire) pass.delete(id);
    s.beatT -= dt;
    if (s.mode === 'riding') {
      const crew = 1 + Math.min(2, [...pass.values()].filter(q => q.owner === myId()).length);
      if (crew !== s.crew) { if (crew > s.crew) toast(t('bikeCrew', { n: crew })); s.crew = crew; }
      p.ride = { speed: BIKES.speed[crew], turn: BIKES.turn, accel: BIKES.accel };
      mine.phase += Math.hypot(p.x - s.px, p.z - s.pz) / BIKES.pedal * Math.PI * 2; s.px = p.x; s.pz = p.z;
      fwd(p.yaw, -seat0, v);
      Object.assign(mine, { x: p.x + v.x, z: p.z + v.z, yaw: p.yaw });
      bikePose(player.kid.bones, mine.phase);
      mine.mesh.position.set(mine.x, p.y, mine.z); mine.mesh.rotation.y = p.yaw;
      if (s.beatT <= 0) { s.beatT = BIKES.beat; send({ e: 'ride' }); }
    } else if (s.mode === 'aboard') {
      const host = mp?.remotes.get(s.owner), idx = seatOf(myId(), s.owner);
      if (!host || !owners.has(s.owner)) off(true);
      else if (idx < 0) { off(true); toast(t('bikeFull'), 'thud'); }
      else {
        const src = host.kid.mesh, yaw = src.rotation.y;
        fwd(yaw, BIKE.seats[idx] - seat0, v);
        player.place(src.position.x + v.x, src.position.z + v.z, yaw);
        player.kid.mesh.position.set(src.position.x + v.x, src.position.y, src.position.z + v.z); player.kid.mesh.rotation.y = yaw;
        bikePose(player.kid.bones, owners.get(s.owner).phase + idx * 1.3);
        if (s.beatT <= 0) { s.beatT = BIKES.beat; send({ e: 'on', i: s.owner }); }
      }
    }
    if (s.mode !== 'riding') { mine.mesh.visible = rented(); mine.mesh.position.set(mine.x, ground(mine.x, mine.z), mine.z); mine.mesh.rotation.set(0, mine.yaw, s.mode === 'none' ? 0.08 : 0); }
    else mine.mesh.rotation.z = 0;

    // what F would do here
    s.near = null;
    if (s.mode !== 'none' || !active || !rack) return;
    const dBike = rented() ? Math.hypot(p.x - mine.x, p.z - mine.z) : Infinity, shop = nearestStation(p.x, p.z, true);
    if (dBike < BIKES.reach) s.near = { kind: 'ride' };
    else if (shop.d < BIKES.reach + 1) s.near = !rented() ? { kind: 'rent', st: shop.st } : dBike > BIKES.fetch ? { kind: 'fetch', st: shop.st } : null;
    if (!s.near) for (const id of owners.keys()) {
      const r = mp.remotes.get(id);
      if (!r || Math.hypot(p.x - r.kid.mesh.position.x, p.z - r.kid.mesh.position.z) > BIKES.joinReach) continue;
      if ([...pass.values()].filter(q => q.owner === id).length < 2) { s.near = { kind: 'join', id, name: mp.info(id)?.name || '' }; break; }
    }
  }

  return {
    update, use, off, remote,
    get busy() { return s.mode !== 'none'; }, get aboard() { return s.mode === 'aboard'; }, get riding() { return s.mode === 'riding'; },
    get near() { return s.near; },
    /** [i18n key, vars] for the F prompt: on a bike, where it may be parked; on foot, what is in reach. */
    prompt() {
      if (s.mode === 'aboard') return ['bikeOff', null];
      if (s.mode === 'riding') {
        const p = player.state, n = nearestStation(p.x, p.z);
        if (!n) return [null, null];
        if (n.d <= BIKES.parkReach) return ['bikePark', null];
        let a = Math.atan2(n.st.x - p.x, n.st.z - p.z) - p.yaw; a = Math.atan2(Math.sin(a), Math.cos(a));           // which way, from the handlebars
        return ['bikeNoPark', { n: Math.round(n.d / 10) * 10, dir: ['↑', '↖', '←', '↙', '↓', '↘', '→', '↗'][Math.round(a / (Math.PI / 4) + 8) % 8] }];
      }
      return s.near ? [{ rent: 'bikeRent', fetch: 'bikeFetch', ride: 'bikeRide', join: 'bikeJoin' }[s.near.kind], { n: BIKES.fee, name: s.near.name || '' }] : [null, null];
    },
    debug: { s, mine, owners, pass, rack, stations, nearestStation, rented, seatOf },
  };
}
