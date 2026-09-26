// Aunt Nuan's som tam cart seen from behind the counter: the kid at the mortar, Aunt
// Nuan at the charcoal grill, customers on the promenade (+z) and the beach and sea
// beyond.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Kit } from '../town/assets/kit.js';
import { somTamCart } from '../town/assets/stall.js';
import { paintedMaterial } from '../world/materials.js';
import { createSky } from '../world/sky.js';
import * as PROPS from '../town/assets/props.js';
import { SPECIES as TREES } from '../town/assets/trees.js';
import { frondMaterial } from '../world/foliage.js';
import { buildPerson } from '../town/people/body.js';
import { ROSTER } from '../town/people/roster.js';
import { KID_LOOK } from '../town/kid/model.js';
import { PALETTE } from '../shared/palette.js';
import { rng } from '../core/rng.js';

export const SLOTS = [-1.7, 0, 1.7].map(x => new THREE.Vector3(x, 0, 2.1));
export const MORTAR = new THREE.Vector3(0.45, 0.99, 0.05);

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
  const r = rng(51);
  scene.add(createSky());
  scene.fog = new THREE.FogExp2(PALETTE.haze, 0.006);
  const sun = new THREE.DirectionalLight('#ffe2b8', 2.8);
  sun.position.set(-14, 18, 20);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -12, right: 12, top: 12, bottom: -12, near: 1, far: 80 });
  scene.add(sun, new THREE.HemisphereLight(PALETTE.hemiSky, PALETTE.hemiGround, 1.15));

  // ground: pavement under the cart, promenade, then sand down to the sea
  const g = new THREE.PlaneGeometry(90, 90, 90, 90).rotateX(-Math.PI / 2).translate(0, 0, 38).toNonIndexed();
  const p = g.attributes.position, col = new Float32Array(p.count * 3), c = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    const z = p.getZ(i);
    p.setY(i, z > 9 ? -(z - 9) * 0.04 : 0);
  }
  for (let i = 0; i < p.count; i += 3) {
    const x = (p.getX(i) + p.getX(i + 1) + p.getX(i + 2)) / 3, z = (p.getZ(i) + p.getZ(i + 1) + p.getZ(i + 2)) / 3;
    if (z < 5.5) c.set((Math.floor(x) + Math.floor(z)) % 2 ? '#c9bfae' : '#bfb4a2');
    else if (z < 9) c.set('#b9ad98');
    else c.set(PALETTE.sand).offsetHSL(0, 0, (r() - 0.5) * 0.04);
    for (let k = 0; k < 3; k++) c.toArray(col, (i + k) * 3);
  }
  g.computeVertexNormals();
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const ground = new THREE.Mesh(g, paintedMaterial({ amp: 0.15, scale: 1.5 }));
  ground.receiveShadow = true;
  scene.add(ground);
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(600, 400).rotateX(-Math.PI / 2).translate(0, -1.9, 240), new THREE.MeshLambertMaterial({ color: PALETTE.seaShallow }));
  scene.add(sea);

  // the cart (shared with the town), facing the customers
  const kit = new Kit();
  somTamCart(kit, { x: 0, y: 0, z: 0, ry: 0, umbrella: false });   // no umbrella: it would block the view
  // charcoal grill next to it with chicken
  const f = kit.frame(1.7, 0, -0.2, 0);
  f.box('wall', 0, 0.45, 0, 0.9, 0.9, 0.45, new THREE.Color('#6a6a6a'));
  f.box('wall', 0, 0.92, 0, 0.85, 0.04, 0.4, new THREE.Color('#2a2a2a'));
  for (let i = 0; i < 4; i++) f.box('wall', -0.3 + i * 0.2, 0.98, 0, 0.14, 0.06, 0.22, new THREE.Color('#b8652a'));
  scene.add(kit.build());

  // pestle (animated when pounding)
  const pestle = new THREE.Mesh(paint(new THREE.CylinderGeometry(0.025, 0.035, 0.34, 8).translate(0, 0.17, 0), '#c9a86a'), paintedMaterial({ amp: 0.2, scale: 0.3 }));
  pestle.position.copy(MORTAR);
  scene.add(pestle);

  // the kid behind the counter (over-the-shoulder), Aunt Nuan at the grill
  const kid = buildPerson(KID_LOOK);
  kid.mesh.position.set(0.15, 0, -0.75);
  scene.add(kid.mesh);
  const nuan = buildPerson(ROSTER.find(p => p.id === 'nuan').look);
  nuan.mesh.position.set(1.75, 0, -0.9);
  nuan.bones.armR.rotation.set(-1.1, 0, -0.2);
  nuan.bones.foreR.rotation.x = -0.6;
  scene.add(nuan.mesh);

  // grill smoke
  const smokeMat = new THREE.SpriteMaterial({ color: '#e8e4dc', transparent: true, opacity: 0.35, depthWrite: false });
  const smoke = Array.from({ length: 8 }, (_, i) => { const s = new THREE.Sprite(smokeMat.clone()); s.userData.t = i / 8; scene.add(s); return s; });

  // beach backdrop: umbrellas + palms
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
  const spots = [];
  for (let x = -30; x <= 30; x += 3.4) spots.push([x + r(), 16 + r() * 6]);
  const propMat = paintedMaterial({ amp: 0.06, scale: 1 });
  for (const [geo, tinted] of [[PROPS.umbrellaCanopy(), true], [PROPS.umbrellaPole(), false]]) {
    const mesh = new THREE.InstancedMesh(geo, propMat, spots.length);
    spots.forEach(([x, z], i) => {
      mesh.setMatrixAt(i, m4.compose(new THREE.Vector3(x, -(z - 9) * 0.04, z), q.identity(), new THREE.Vector3(1, 1, 1)));
      mesh.setColorAt(i, new THREE.Color(tinted ? ['#ffffff', '#f2f4f8'][i % 2] : '#ffffff'));   // canopies are baked blue/white
    });
    scene.add(mesh);
  }
  const palms = TREES.palm(rng(9)), fronds = frondMaterial();
  const palmSpots = [[-6, 10], [5.5, 11], [-14, 12], [12, 10.5], [20, 12]];
  for (const [geo, mat] of [[palms.trunk, paintedMaterial({ amp: 0.3, scale: 1.2 })], [palms.fronds, fronds.material]]) {
    const mesh = new THREE.InstancedMesh(geo, mat, palmSpots.length);
    palmSpots.forEach(([x, z], i) => mesh.setMatrixAt(i, m4.compose(new THREE.Vector3(x, -(z - 9) * 0.04, z), q.setFromAxisAngle(up, i * 1.3), new THREE.Vector3(0.9, 0.9, 0.9))));
    mesh.castShadow = true;
    scene.add(mesh);
  }

  function update(t, pound) {
    // pestle: up/down while pounding
    pestle.position.y = MORTAR.y + 0.12 + Math.abs(Math.sin(pound * Math.PI)) * 0.25;
    kid.bones.armR.rotation.set(-1.2 - Math.sin(pound * Math.PI) * 0.6, 0, -0.2);
    kid.bones.armL.rotation.set(-0.9, 0, 0.4);
    nuan.bones.foreR.rotation.z = Math.sin(t * 5) * 0.3;          // fanning the charcoal
    for (const s of smoke) {
      const k = (t * 0.25 + s.userData.t) % 1;
      s.position.set(1.7 + Math.sin(k * 6 + s.userData.t * 9) * 0.15, 1.05 + k * 1.8, -0.2);
      s.scale.setScalar(0.25 + k * 0.7);
      s.material.opacity = 0.35 * (1 - k);
    }
  }
  return { scene, update };
}
