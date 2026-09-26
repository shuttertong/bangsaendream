// Things floating in the swim area (they bob on the waves and glint), and jellyfish that
// drift about and sting on contact.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { FINDS, ROUND, pickFind, waveAt } from './species.js';

function paint(g, hex) {
  g = g.index ? g.toNonIndexed() : g;
  if (g.attributes.uv) g.deleteAttribute('uv');
  const c = new THREE.Color(hex), n = g.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) c.toArray(a, i * 3);
  g.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return g;
}

function findGeometry(f) {
  switch (f.kind) {
    case 'conch': return mergeGeometries([paint(new THREE.ConeGeometry(0.16, 0.42, 10).rotateZ(Math.PI / 2), f.color), paint(new THREE.SphereGeometry(0.14, 10, 8).scale(1, 0.8, 0.8).translate(0.14, 0, 0), '#f8e8d8')]);
    case 'scallop': return paint(new THREE.CircleGeometry(0.22, 12, 0, Math.PI).rotateX(-Math.PI / 2).scale(1, 1, 1), f.color);
    case 'star': {
      const s = new THREE.Shape();
      for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2, rr = i % 2 ? 0.1 : 0.26; s[i ? 'lineTo' : 'moveTo'](Math.cos(a) * rr, Math.sin(a) * rr); }
      return paint(new THREE.ExtrudeGeometry(s, { depth: 0.05, bevelEnabled: false }).rotateX(-Math.PI / 2), f.color);
    }
    case 'glass': return paint(new THREE.OctahedronGeometry(0.13, 0).scale(1.3, 0.6, 1), f.color);
    case 'bottle': return mergeGeometries([paint(new THREE.CylinderGeometry(0.09, 0.09, 0.34, 10).rotateZ(Math.PI / 2), f.color), paint(new THREE.CylinderGeometry(0.035, 0.05, 0.12, 8).rotateZ(Math.PI / 2).translate(0.22, 0, 0), f.color), paint(new THREE.CylinderGeometry(0.03, 0.03, 0.05, 6).rotateZ(Math.PI / 2).translate(0.3, 0, 0), '#b08a5a')]);
    default: return mergeGeometries([paint(new THREE.SphereGeometry(0.2, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.4, 0.8), f.color), paint(new THREE.SphereGeometry(0.2, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, -0.3, 0.8), '#a8a098'), paint(new THREE.SphereGeometry(0.05, 8, 6).translate(0.05, 0.06, 0), '#fff8f0')]);
  }
}

function jellyGeometry() {
  const parts = [paint(new THREE.SphereGeometry(0.45, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.7, 1), '#e8b8e8')];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    parts.push(paint(new THREE.CylinderGeometry(0.02, 0.008, 0.8, 4).translate(Math.cos(a) * 0.3, -0.4, Math.sin(a) * 0.3), '#d8a8e0'));
  }
  return mergeGeometries(parts);
}

export function createFinds(scene, material, r) {
  const geos = Object.fromEntries(FINDS.map(f => [f.id, findGeometry(f)]));
  const glintMat = new THREE.SpriteMaterial({ color: '#ffffff', transparent: true, opacity: 0.9, depthWrite: false });
  const list = [];
  const A = ROUND.area;
  const place = () => [THREE.MathUtils.lerp(-A.x + 2, A.x - 2, r()), THREE.MathUtils.lerp(A.z0 + 2, A.z1 - 4, r())];

  function spawn(kx, kz) {
    const f = pickFind(r);
    let x, z;
    do { [x, z] = place(); } while (Math.hypot(x - kx, z - kz) < 6);
    const mesh = new THREE.Mesh(geos[f.id], material);
    mesh.castShadow = true;
    mesh.scale.setScalar(1.6);                               // readable from the camera
    const glint = new THREE.Sprite(glintMat);
    glint.scale.setScalar(0.35);
    mesh.add(glint);
    scene.add(mesh);
    list.push({ f, mesh, glint, x, z, spin: r() * 6, drift: (r() - 0.5) * 0.3 });
  }
  for (let i = 0; i < ROUND.finds; i++) spawn(0, 0);

  const jellyMat = new THREE.MeshLambertMaterial({ vertexColors: true, transparent: true, opacity: 0.55, emissive: '#402040' });
  const jellyGeo = jellyGeometry();
  const jellies = [];
  for (let i = 0; i < ROUND.jellies; i++) {
    const [x, z] = place();
    const mesh = new THREE.Mesh(jellyGeo, jellyMat);
    scene.add(mesh);
    jellies.push({ mesh, x, z, a: r() * 6.3, t: r() * 6 });
  }

  /** Move everything with the waves; returns finds the tube touched and whether a jelly stung. */
  function update(dt, t, tube) {
    const got = [];
    for (const it of list) {
      const w = waveAt(it.x, it.z, t);
      it.x += (w.gx * 0.25 + it.drift) * dt; it.z += (w.gz * 0.25 + 0.05) * dt;
      if (it.z > A.z1 - 1) it.z = A.z0 + 2;                      // washed ashore → drifts back out
      it.spin += dt * 0.6;
      it.mesh.position.set(it.x, w.h + 0.05, it.z);
      it.mesh.rotation.set(w.gz * 0.4, it.spin, -w.gx * 0.4);
      it.glint.material.opacity = 0.4 + 0.6 * Math.max(0, Math.sin(t * 3 + it.spin * 5));
      it.glint.position.y = 0.3;
      if (Math.hypot(it.x - tube.x, it.z - tube.z) < ROUND.tube.radius + 0.3) got.push(it);
    }
    for (const it of got) { scene.remove(it.mesh); list.splice(list.indexOf(it), 1); spawn(tube.x, tube.z); }

    let sting = null;
    for (const j of jellies) {
      j.t += dt; j.a += (Math.sin(j.t * 0.3) * 0.4) * dt;
      j.x = THREE.MathUtils.clamp(j.x + Math.sin(j.a) * 0.5 * dt, -A.x, A.x);
      j.z = THREE.MathUtils.clamp(j.z + Math.cos(j.a) * 0.5 * dt, A.z0, A.z1 - 3);
      const pulse = 1 + Math.sin(j.t * 3) * 0.12;
      j.mesh.scale.set(pulse, 2 - pulse, pulse);
      j.mesh.position.set(j.x, waveAt(j.x, j.z, t).h - 0.15, j.z);
      if (Math.hypot(j.x - tube.x, j.z - tube.z) < ROUND.tube.radius + 0.35) sting = j;
    }
    return { got, sting };
  }

  return { list, jellies, update, dispose: () => { list.forEach(it => scene.remove(it.mesh)); jellies.forEach(j => scene.remove(j.mesh)); } };
}
