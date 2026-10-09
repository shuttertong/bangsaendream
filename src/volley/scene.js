// A beach volleyball court on Bang Saen beach, seen from the side: the net across the middle
// (x = 0), rope lines on the sand, people watching along the far side, the sea behind them (−z)
// with Khao Sam Muk in the haze, umbrellas and palms beyond both ends. The kid's side is on the left.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { paintedMaterial } from '../world/materials.js';
import { createSky } from '../world/sky.js';
import { SPECIES as TREES } from '../town/assets/trees.js';
import { cardMaterial } from '../world/foliage.js';
import * as PROPS from '../town/assets/props.js';
import { paint, seaMaterial, watcherMesh } from '../shared/beachset.js';
import { PALETTE } from '../shared/palette.js';
import { rng } from '../core/rng.js';
import { COURT, BALL } from './rules.js';

const { half: H, wide: Wd } = COURT;
export const SET = {
  shore: -(Wd + 9), slope: 0.07, sea: -0.32,        // the sand starts to fall away here (z), this steeply, to the water at this height
  line: '#2f6fc4', post: '#f4f1e8', pad: '#e2553f', tape: '#fbfaf5', net: '#2a3038',
  ball: ['#f6f4ee', '#e2553f', '#f6f4ee', '#f0c23a', '#f6f4ee', '#2f6fc4'],   // six panels round the ball
  sun: [-9, 22, 15],                                // from the camera's side, a little to the left: faces are lit
  watchers: 16, trail: 7,
};
export const groundAt = z => (z < SET.shore ? (z - SET.shore) * SET.slope : 0);

export function buildScene() {
  const scene = new THREE.Scene(), r = rng(83);
  scene.add(createSky());
  scene.fog = new THREE.FogExp2(PALETTE.haze, 0.0035);
  const sun = new THREE.DirectionalLight(PALETTE.sun, 3.2);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -16, right: 16, top: 16, bottom: -16, near: 1, far: 80 });
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03;
  sun.position.set(...SET.sun);
  scene.add(sun, sun.target, new THREE.HemisphereLight(PALETTE.hemiSky, PALETTE.hemiGround, 1.1));

  // sand: flat where the game is, falling away to the sea behind the court; the court is raked a shade paler
  const g = new THREE.PlaneGeometry(260, 200, 220, 180).rotateX(-Math.PI / 2).translate(0, 0, -60);
  const p = g.attributes.position, col = new Float32Array(p.count * 3), c = new THREE.Color(), wet = new THREE.Color(PALETTE.wetSand), bed = new THREE.Color(PALETTE.seabed);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i), y = groundAt(z);
    p.setY(i, y);
    c.set(PALETTE.sand).lerp(wet, THREE.MathUtils.smoothstep(-y, 0.05, 0.3)).lerp(bed, THREE.MathUtils.smoothstep(-y, 0.4, 1.6));
    if (Math.abs(x) < H && Math.abs(z) < Wd) c.offsetHSL(0, -0.03, 0.02);
    c.offsetHSL(0, 0, (r() - 0.5) * 0.03).toArray(col, i * 3);
  }
  g.computeVertexNormals();
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const ground = new THREE.Mesh(g, paintedMaterial({ amp: 0.22, scale: 1.4 }));
  ground.receiveShadow = true;
  scene.add(ground);

  const waterMat = seaMaterial('z', SET.shore + SET.sea / SET.slope);
  const water = new THREE.Mesh(new THREE.PlaneGeometry(900, 600).rotateX(-Math.PI / 2).translate(0, SET.sea, SET.shore - 296), waterMat);
  water.renderOrder = 1;
  scene.add(water);
  for (const [x, z, sx, sy, sz] of [[-230, -560, 200, 60, 110], [-60, -640, 150, 38, 90], [330, -700, 90, 22, 60]]) {   // Khao Sam Muk, and an island
    const hill = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 10, 0, Math.PI * 2, 0, Math.PI / 2).scale(sx, sy, sz), new THREE.MeshLambertMaterial({ color: PALETTE.hill }));
    hill.position.set(x, -2, z);
    scene.add(hill);
  }

  // the court: rope lines, the net between two padded posts, its tape and antennas
  const solid = [], flat = (w, d, x, z) => solid.push(paint(new THREE.BoxGeometry(w, 0.02, d).translate(x, 0.012, z), SET.line));
  for (const sz of [-1, 1]) flat(H * 2 + 0.08, 0.08, 0, sz * Wd);
  for (const sx of [-1, 1]) flat(0.08, Wd * 2 + 0.08, sx * H, 0);
  const pz = Wd + 0.45, top = COURT.net;
  for (const sz of [-1, 1]) {
    solid.push(paint(new THREE.CylinderGeometry(0.05, 0.05, top + 0.25, 10).translate(0, (top + 0.25) / 2, sz * pz), SET.post));
    solid.push(paint(new THREE.CylinderGeometry(0.12, 0.12, 1.5, 12).translate(0, 0.78, sz * pz), SET.pad));
    solid.push(paint(new THREE.CylinderGeometry(0.012, 0.012, 0.9, 6).translate(0, top + 0.4, sz * Wd), SET.pad));           // antenna over the side line
  }
  solid.push(paint(new THREE.BoxGeometry(0.025, 0.09, pz * 2).translate(0, top - 0.045, 0), SET.tape));
  solid.push(paint(new THREE.BoxGeometry(0.02, 0.05, pz * 2).translate(0, top - 0.98, 0), SET.tape));
  const court = new THREE.Mesh(mergeGeometries(solid), paintedMaterial({ amp: 0.06, scale: 1 }));
  court.castShadow = court.receiveShadow = true;
  const mesh = [];                                                      // the net: squares of string
  for (let z = -pz; z <= pz + 0.01; z += 0.14) mesh.push(0, top - 0.98, z, 0, top - 0.09, z);
  for (let y = top - 0.98; y <= top - 0.08; y += 0.14) mesh.push(0, y, -pz, 0, y, pz);
  const net = new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(mesh, 3)),
    new THREE.LineBasicMaterial({ color: SET.net, transparent: true, opacity: 0.7 }));
  // people watching along the far side line and round both ends
  const spots = [];
  for (let i = 0; i < SET.watchers; i++) {
    const x = -H - 2 + ((H * 2 + 4) * (i + r() * 0.7)) / SET.watchers;
    spots.push({ x, z: -Wd - 3.6 - r() * 2.4, yaw: (r() - 0.5) * 0.6 });
  }
  for (const sx of [-1, 1]) for (let i = 0; i < 3; i++) spots.push({ x: sx * (H + 3 + r() * 1.5), z: -2 + i * 1.6 + r(), yaw: -sx * Math.PI / 2 + (r() - 0.5) * 0.5 });
  scene.add(court, net, watcherMesh(spots, r));

  // beyond both ends: umbrellas and chairs, then palms
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), one = new THREE.Vector3(1, 1, 1);
  const umb = [];
  for (const sx of [-1, 1]) for (let x = H + 7; x <= H + 40; x += 3.6) for (const z of [-7.5, -3.6, 0.4]) if (r() < 0.85) umb.push([sx * (x + r() * 0.6), z + r() * 0.8]);
  const dressMat = paintedMaterial({ amp: 0.06, scale: 1 });
  for (const [geo, tinted, ox, oz] of [[PROPS.umbrellaCanopy(), true, 0, 0], [PROPS.umbrellaPole(), false, 0, 0], [PROPS.deckChair(), false, 0.7, -0.9]]) {
    const inst = new THREE.InstancedMesh(geo, dressMat, umb.length);
    umb.forEach(([x, z], i) => {
      inst.setMatrixAt(i, m4.compose(new THREE.Vector3(x + ox, 0, z + oz), q.setFromAxisAngle(up, Math.PI + (r() - 0.5) * 0.3), one));
      inst.setColorAt(i, new THREE.Color(tinted ? '#ffffff' : '#f4f2ec'));
    });
    inst.castShadow = true;
    scene.add(inst);
  }
  const cards = cardMaterial(), bark = paintedMaterial({ amp: 0.3, scale: 1.2 }), tpl = TREES.palm(rng(5)), palms = [];
  for (const sx of [-1, 1]) for (let x = H + 5; x <= H + 60; x += 5 + r() * 5) palms.push([sx * x, 3 - r() * 13]);
  for (const [geo, mat, depth] of [[tpl.trunk, bark, null], [tpl.cards, cards.material, cards.depth]]) {
    const inst = new THREE.InstancedMesh(geo, mat, palms.length);
    palms.forEach(([x, z], i) => inst.setMatrixAt(i, m4.compose(new THREE.Vector3(x, -0.1, z), q.setFromAxisAngle(up, r() * 6.3), one)));
    if (depth) inst.customDepthMaterial = depth;
    inst.castShadow = true;
    inst.computeBoundingSphere();
    scene.add(inst);
  }

  // the ball: a beach ball in six coloured panels; a dark blob on the sand under it; a fiery tail for a fireball spike
  const bg = new THREE.SphereGeometry(BALL.r, 24, 16).toNonIndexed(), bp = bg.attributes.position, bc = new Float32Array(bp.count * 3);
  for (let i = 0; i < bp.count; i += 3) {
    const cx = bp.getX(i) + bp.getX(i + 1) + bp.getX(i + 2), cz = bp.getZ(i) + bp.getZ(i + 1) + bp.getZ(i + 2), cy = (bp.getY(i) + bp.getY(i + 1) + bp.getY(i + 2)) / 3;
    const cap = Math.abs(cy) > BALL.r * 0.9, panel = Math.floor(((Math.atan2(cz, cx) + Math.PI) / (Math.PI * 2)) * 6) % 6;
    for (let k = 0; k < 3; k++) c.set(cap ? '#f6f4ee' : SET.ball[panel]).toArray(bc, (i + k) * 3);
  }
  bg.deleteAttribute('uv');
  bg.setAttribute('color', new THREE.BufferAttribute(bc, 3));
  const ball = new THREE.Mesh(bg, paintedMaterial({ amp: 0.04, scale: 1 }));
  ball.castShadow = true;
  const blob = new THREE.Mesh(new THREE.CircleGeometry(BALL.r * 1.15, 20).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#3a2f20', transparent: true, opacity: 0.3, depthWrite: false }));
  const trail = Array.from({ length: SET.trail }, (_, i) => {
    const t = new THREE.Mesh(new THREE.SphereGeometry(BALL.r * (1.05 - i * 0.1), 10, 8), new THREE.MeshBasicMaterial({ color: i < 2 ? '#ffd35a' : '#ff7a2a', transparent: true, opacity: 0.55 - i * 0.06, depthWrite: false }));
    t.visible = false;
    return t;
  });
  // rings on the sand: where the kid's ball comes down (and a second one that closes when it is time to press)
  const ringMat = () => new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.9, depthWrite: false });
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.7, 40).rotateX(-Math.PI / 2), ringMat());
  const timer = new THREE.Mesh(new THREE.RingGeometry(0.66, 0.8, 40).rotateX(-Math.PI / 2), ringMat());
  // arrows: one bobbing over the ring, one over the kid's head ("that's you")
  const arrow = (hex, k = 1) => new THREE.Mesh(new THREE.ConeGeometry(0.16 * k, 0.34 * k, 4).rotateX(Math.PI), new THREE.MeshBasicMaterial({ color: hex, transparent: true, opacity: 0.95, depthTest: false }));
  const here = arrow('#ffffff'), you = arrow('#ff5a2a', 1.35);
  for (const m of [blob, ring, timer, here, you]) { m.renderOrder = 2; m.position.y = 0.03; }
  ring.visible = timer.visible = here.visible = false;
  scene.add(ball, blob, ring, timer, here, you, ...trail);

  const sunOff = new THREE.Vector3(...SET.sun);
  function update(t, focus) {
    waterMat.uniforms.time.value = t;
    sun.position.copy(focus).add(sunOff);
    sun.target.position.copy(focus);
  }
  return { scene, update, ball, blob, trail, ring, timer, here, you };
}
