// The slalom course, laid out ahead of the rider as they go: pairs of buoys (gates),
// with net-float lines, moored longtails and floating bottles between them. Everything is
// instanced (one draw per kind) and bobs on the swell.
import * as THREE from 'three';
import { swellAt } from '../boats/scene.js';
import { paintedMaterial } from '../world/materials.js';
import { buoyGeometry, bottleGeometry, floatLineGeometry, longtailGeometry } from './props.js';
import { COURSE } from './rules.js';

const NEXT = new THREE.Color('#ff5a1f'), LATER = new THREE.Color('#f2cf3a'), DONE = new THREE.Color('#9aa3a6');
const WHITE = new THREE.Color('#ffffff');
const BOTTLES = ['#bfe6ee', '#d6f0e0', '#f4f2ec', '#9ad0e0'].map(c => new THREE.Color(c));
const SHAPE = { floats: { half: 3.5, rad: 0.45, axis: 'x' }, boat: { half: 3.8, rad: 0.95, axis: 'z' } };

export function createCourse(scene, r) {
  const mat = paintedMaterial({ amp: 0.05, scale: 1 });
  const cap = COURSE.ahead + 4;
  const mk = (geo, n, shadow = true) => {
    const m = new THREE.InstancedMesh(geo, mat, n);
    m.count = 0; m.castShadow = shadow; m.frustumCulled = false;
    m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3);
    scene.add(m);
    return m;
  };
  const buoys = mk(buoyGeometry(), cap * 2), bottles = mk(bottleGeometry(), cap * COURSE.trash[1], false);
  const floats = mk(floatLineGeometry(), cap), boats = mk(longtailGeometry(), cap);

  const gates = [], obstacles = [], trash = [];
  let id = 0, head = { x: 0, z: 40, yaw: 0 };

  function addGate() {
    const prev = gates.length ? gates[gates.length - 1] : null;
    if (prev) {
      let yaw = prev.yaw + r.range(-COURSE.swing, COURSE.swing);
      if (Math.abs(prev.x) > COURSE.drift) yaw -= Math.sign(prev.x) * COURSE.swing * 0.6;   // bend back toward open sea
      yaw = THREE.MathUtils.clamp(yaw, -1.1, 1.1);                                          // keep heading up the coast
      const d = r.range(...COURSE.spacing);
      head = { x: prev.x + Math.sin(yaw) * d, z: prev.z + Math.cos(yaw) * d, yaw };
    }
    const g = { id: id++, ...head, done: null };
    gates.push(g);
    if (!prev) return;
    // between prev and g: maybe an obstacle near the line, and some bottles
    const dx = g.x - prev.x, dz = g.z - prev.z, len = Math.hypot(dx, dz), fx = dx / len, fz = dz / len, rx = fz, rz = -fx;
    const segYaw = Math.atan2(fx, fz);
    if (r.chance(COURSE.obstacle)) {
      const kind = r.chance(0.55) ? 'floats' : 'boat', off = r.range(-6, 6), k = r.range(0.4, 0.6);
      const x = prev.x + dx * k + rx * off, z = prev.z + dz * k + rz * off;
      const yaw = kind === 'floats' ? segYaw + r.range(-0.4, 0.4) : r() * Math.PI * 2;
      obstacles.push({ seg: g.id, kind, x, z, yaw, ...SHAPE[kind], bob: r() * 6 });
    }
    const n = Math.round(r.range(...COURSE.trash));
    for (let i = 0; i < n; i++) {
      const k = r.range(0.2, 0.85), off = r.range(-5, 5);
      trash.push({ seg: g.id, x: prev.x + dx * k + rx * off, z: prev.z + dz * k + rz * off, yaw: r() * 6.28, got: false, c: r.pick(BOTTLES), bob: r() * 6 });
    }
  }
  for (let i = 0; i < COURSE.ahead + 1; i++) addGate();

  const next = () => gates.find(g => !g.done);

  /** Crossing the next gate's line between p0 and p1 → 'pass' | 'miss' | null. */
  function check(p0, p1) {
    const g = next();
    if (!g) return null;
    const fx = Math.sin(g.yaw), fz = Math.cos(g.yaw);
    const s0 = (p0.x - g.x) * fx + (p0.z - g.z) * fz, s1 = (p1.x - g.x) * fx + (p1.z - g.z) * fz;
    if (!(s0 < 0 && s1 >= 0)) return null;
    const lat = (p1.x - g.x) * fz - (p1.z - g.z) * fx;
    g.done = Math.abs(lat) <= COURSE.width / 2 ? 'pass' : 'miss';
    // keep `ahead` open gates; drop what's well behind
    addGate();
    while (gates.length > COURSE.ahead + 3) {
      const old = gates.shift();
      for (let i = obstacles.length - 1; i >= 0; i--) if (obstacles[i].seg <= old.id) obstacles.splice(i, 1);
      for (let i = trash.length - 1; i >= 0; i--) if (trash[i].seg <= old.id) trash.splice(i, 1);
    }
    return g.done;
  }

  /** Closest obstacle hit by a circle of radius rad at (x, z): { o, nx, nz, depth } or null. */
  function hit(x, z, rad) {
    for (const o of obstacles) {
      const ax = o.axis === 'x' ? Math.cos(o.yaw) : Math.sin(o.yaw), az = o.axis === 'x' ? -Math.sin(o.yaw) : Math.cos(o.yaw);
      const t = THREE.MathUtils.clamp((x - o.x) * ax + (z - o.z) * az, -o.half, o.half);
      const cx = o.x + ax * t, cz = o.z + az * t, d = Math.hypot(x - cx, z - cz);
      if (d < o.rad + rad) return { o, nx: (x - cx) / (d || 1), nz: (z - cz) / (d || 1), depth: o.rad + rad - d };
    }
    return null;
  }

  /** Bottles within reach are picked up; returns how many. */
  function collect(x, z, reach) {
    let n = 0;
    for (const b of trash) if (!b.got && Math.hypot(b.x - x, b.z - z) < reach) { b.got = true; n++; }
    return n;
  }

  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1);
  const place = (mesh, i, x, z, yaw, t, bob, color, sink = 0) => {
    const w = swellAt(x, z, t);
    q.setFromEuler(e.set(-w.gz * 0.5 + Math.sin(t * 1.7 + bob) * 0.05, yaw, w.gx * 0.5, 'YXZ'));
    mesh.setMatrixAt(i, m.compose(v.set(x, w.h - sink, z), q, one));
    mesh.setColorAt(i, color);
  };
  function update(t) {
    const nx = next();
    let i = 0;
    for (const g of gates) {
      const c = g === nx ? NEXT : g.done ? DONE : LATER, rx = Math.cos(g.yaw), rz = -Math.sin(g.yaw), h = COURSE.width / 2 + 0.6;
      place(buoys, i++, g.x + rx * h, g.z + rz * h, g.yaw, t, g.id, c);
      place(buoys, i++, g.x - rx * h, g.z - rz * h, g.yaw + Math.PI, t, g.id + 2, c);
    }
    buoys.count = i;
    let nf = 0, nb = 0;
    for (const o of obstacles) {
      if (o.kind === 'floats') place(floats, nf++, o.x, o.z, o.yaw, t, o.bob, WHITE);
      else place(boats, nb++, o.x, o.z, o.yaw, t * 0.6, o.bob, WHITE, 0.25);
    }
    floats.count = nf; boats.count = nb;
    let nt = 0;
    for (const b of trash) if (!b.got) place(bottles, nt++, b.x, b.z, b.yaw, t, b.bob, b.c);
    bottles.count = nt;
    for (const mesh of [buoys, floats, boats, bottles]) { mesh.instanceMatrix.needsUpdate = true; mesh.instanceColor.needsUpdate = true; }
  }

  return { gates, obstacles, trash, next, check, hit, collect, update };
}
