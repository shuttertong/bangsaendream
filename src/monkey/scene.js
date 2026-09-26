// Khao Sam Muk viewpoint plaza in the afternoon: tiled plaza, railing at the cliff edge
// (−z) with the sea and islands far below, a Thai sala, trees around, the picnic mat.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { paintedMaterial } from '../world/materials.js';
import { createSky } from '../world/sky.js';
import { SPECIES as TREES } from '../town/assets/trees.js';
import { cardMaterial } from '../world/foliage.js';
import { PALETTE } from '../shared/palette.js';
import { rng } from '../core/rng.js';
import { ROUND } from './species.js';
import { matGeometry } from './models.js';

function paint(g, hex) {
  g = g.index ? g.toNonIndexed() : g;
  if (g.attributes.uv) g.deleteAttribute('uv');
  const c = new THREE.Color(hex), n = g.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) c.toArray(a, i * 3);
  g.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return g;
}

export function buildScene() {
  const scene = new THREE.Scene();
  const r = rng(31);
  scene.add(createSky());
  scene.fog = new THREE.FogExp2(PALETTE.haze, 0.004);

  const sun = new THREE.DirectionalLight('#ffe6c4', 3.0);
  sun.position.set(-20, 26, 12);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -18, right: 18, top: 18, bottom: -18, near: 1, far: 80 });
  sun.shadow.bias = -0.0004;
  scene.add(sun, new THREE.HemisphereLight(PALETTE.hemiSky, PALETTE.hemiGround, 1.1));

  const R = ROUND.arena;
  // ground: tiled plaza inside, grass and rock outside; the land falls away past the railing
  // square grid so each paving tile gets one flat colour (a ring mesh smears them radially)
  const ng = new THREE.PlaneGeometry(80, 80, 200, 200).rotateX(-Math.PI / 2).toNonIndexed();
  const p = ng.attributes.position, col = new Float32Array(p.count * 3), c = new THREE.Color();
  const heightAt = (x, z) => {
    const d = Math.hypot(x, z);
    if (d <= R + 1) return 0;
    return z < -R + 2 ? -(d - R - 1) * 1.2 : (d - R - 1) * 0.12 + Math.sin(x * 0.7) * 0.2;
  };
  for (let i = 0; i < p.count; i++) p.setY(i, heightAt(p.getX(i), p.getZ(i)));
  for (let i = 0; i < p.count; i += 3) {
    const x = (p.getX(i) + p.getX(i + 1) + p.getX(i + 2)) / 3, z = (p.getZ(i) + p.getZ(i + 1) + p.getZ(i + 2)) / 3, d = Math.hypot(x, z);
    if (d < R) c.set((Math.floor(x / 0.8) + Math.floor(z / 0.8)) % 2 ? '#c9bfae' : '#bdb2a0').offsetHSL(0, 0, (r() - 0.5) * 0.025);
    else if (d < R + 0.5) c.set('#9a9284');
    else c.set(z < -R ? '#7a8a5a' : '#6f8f4a').offsetHSL(0, 0, (r() - 0.5) * 0.05);
    for (let k = 0; k < 3; k++) c.toArray(col, (i + k) * 3);
  }
  ng.computeVertexNormals();
  ng.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const ground = new THREE.Mesh(ng, paintedMaterial({ amp: 0.2, scale: 2 }));
  ground.receiveShadow = true;
  scene.add(ground);

  // sea far below + island silhouettes (Ko Si Chang direction)
  const seaMat = new THREE.MeshLambertMaterial({ color: '#4a8fa6' });
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(3000, 3000).rotateX(-Math.PI / 2).translate(0, -70, -1400), seaMat);
  scene.add(sea);
  for (const [x, z, s] of [[-420, -900, 160], [260, -1300, 110]]) {
    const isl = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2).scale(s, s * 0.35, s * 0.6), new THREE.MeshLambertMaterial({ color: '#5a7a5a' }));
    isl.position.set(x, -70, z);
    scene.add(isl);
  }

  // railing along the cliff side
  const rail = [];
  for (let a = Math.PI * 1.15; a <= Math.PI * 1.85; a += 0.07) {
    const x = Math.cos(a) * (R + 0.2), z = Math.sin(a) * (R + 0.2);
    rail.push(paint(new THREE.BoxGeometry(0.12, 1, 0.12).translate(x, 0.5, z), '#e8e2d4'));
  }
  const arc = new THREE.TorusGeometry(R + 0.2, 0.05, 6, 60, Math.PI * 0.7).rotateX(Math.PI / 2).rotateY(-Math.PI * 1.15);
  rail.push(paint(arc.clone().translate(0, 0.95, 0), '#e8e2d4'), paint(arc.clone().translate(0, 0.55, 0), '#e8e2d4'));

  // Thai sala (open pavilion) at the back left
  const sala = [];
  for (const [x, z] of [[-1.4, -1.4], [1.4, -1.4], [-1.4, 1.4], [1.4, 1.4]]) sala.push(paint(new THREE.CylinderGeometry(0.12, 0.14, 2.6, 8).translate(x, 1.3, z), '#f2ece0'));
  sala.push(paint(new THREE.BoxGeometry(3.4, 0.25, 3.4).translate(0, 0.12, 0), '#d8d0c0'));
  const roof = new THREE.ConeGeometry(2.8, 1.8, 4).rotateY(Math.PI / 4).translate(0, 3.5, 0);
  sala.push(paint(roof, '#b0553a'), paint(new THREE.ConeGeometry(1.6, 1.1, 4).rotateY(Math.PI / 4).translate(0, 4.6, 0), '#b0553a'));
  sala.push(paint(new THREE.ConeGeometry(0.08, 0.9, 6).translate(0, 5.5, 0), '#d8b040'));
  const salaGeo = mergeGeometries(sala).translate(-7.5, 0, -6);

  // rocks + benches
  const extra = [];
  for (let i = 0; i < 18; i++) {
    const a = r() * Math.PI * 2, d = R + 1.5 + r() * 6;
    if (Math.sin(a) < -0.4) continue;                    // keep the sea view open
    extra.push(paint(new THREE.DodecahedronGeometry(0.4 + r() * 0.9, 0).scale(1, 0.6, 1).translate(Math.cos(a) * d, 0.2, Math.sin(a) * d), '#8a8474'));
  }
  for (const a of [0.2, 0.8, 2.4]) {
    const x = Math.cos(a) * (R - 1), z = Math.sin(a) * (R - 1);
    extra.push(paint(new THREE.BoxGeometry(1.8, 0.1, 0.5).rotateY(-a + Math.PI / 2).translate(x, 0.45, z), '#a87a4a'));
    extra.push(paint(new THREE.BoxGeometry(1.6, 0.45, 0.4).rotateY(-a + Math.PI / 2).translate(x, 0.22, z), '#8a8474'));
  }
  const props = new THREE.Mesh(mergeGeometries([...rail, salaGeo, ...extra]), paintedMaterial({ amp: 0.15, scale: 1 }));
  props.castShadow = props.receiveShadow = true;
  scene.add(props);

  // picnic mat in the middle
  const mat = new THREE.Mesh(matGeometry(ROUND.mat), paintedMaterial({ amp: 0.1, scale: 0.4 }));
  mat.position.y = 0.02;
  mat.receiveShadow = true;
  scene.add(mat);

  // trees around (not on the sea side): where the monkeys come from
  const spots = [];
  for (let i = 0; i < 26; i++) {
    const a = r() * Math.PI * 2;
    if (Math.sin(a) < -0.3) continue;
    const d = R + 3 + r() * 9;
    spots.push([Math.cos(a) * d, Math.sin(a) * d, r() < 0.7 ? 'rainTree' : 'frangipani']);
  }
  const cards = cardMaterial(), bark = paintedMaterial({ amp: 0.3, scale: 1.2 });
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
  for (const sp of ['rainTree', 'frangipani']) {
    const list = spots.filter(s => s[2] === sp);
    const tpl = TREES[sp](rng(sp.length));
    for (const [geo, mt, depth] of [[tpl.trunk, bark, null], [tpl.cards, cards.material, cards.depth]]) {
      const mesh = new THREE.InstancedMesh(geo, mt, list.length);
      list.forEach(([x, z], i) => {
        const s = sp === 'rainTree' ? 0.55 + r() * 0.25 : 1 + r() * 0.3;
        mesh.setMatrixAt(i, m4.compose(new THREE.Vector3(x, (Math.hypot(x, z) - R - 1) * 0.12, z), q.setFromAxisAngle(up, r() * 6.3), new THREE.Vector3(s, s, s)));
      });
      mesh.castShadow = mesh.receiveShadow = true;
      if (depth) mesh.customDepthMaterial = depth;
      mesh.computeBoundingSphere();
      scene.add(mesh);
    }
  }
  return { scene, sun };
}
