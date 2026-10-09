// A sand pitch on Bang Saen beach in the afternoon: inflatable boards round it, two yellow goals,
// blue ribbon lines, the sea on the left (−x), umbrellas and palms on the right, a few people
// watching, Khao Sam Muk in the haze up the beach. The kid's side attacks −z (up the screen).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { paintedMaterial } from '../world/materials.js';
import { createSky } from '../world/sky.js';
import { SPECIES as TREES } from '../town/assets/trees.js';
import { cardMaterial } from '../world/foliage.js';
import * as PROPS from '../town/assets/props.js';
import { PALETTE } from '../shared/palette.js';
import { rng } from '../core/rng.js';
import { PITCH, BALL } from './rules.js';
import { goalFrame, placeNet, GOAL_COLORS } from './goal.js';
import { paint, seaMaterial, watcherMesh } from '../shared/beachset.js';

const { L, W } = PITCH, G = PITCH.goal;
export const SET = {
  shore: -(W + 7), slope: 0.07, sea: -0.32,         // the sand starts to fall away here (x), this steeply, to the water at this height
  board: { r: 0.27, len: 2, colors: ['#f4f1e8', '#2f6fc4'] },
  line: '#2f6fc4', flag: '#e2443a',
  sun: [-16, 24, 10],                               // from over the sea, a little behind the camera
  watchers: 11,
};

export const groundAt = x => (x < SET.shore ? (x - SET.shore) * SET.slope : 0);

export function buildScene() {
  const scene = new THREE.Scene(), r = rng(47);
  scene.add(createSky());
  scene.fog = new THREE.FogExp2(PALETTE.haze, 0.0035);
  const sun = new THREE.DirectionalLight(PALETTE.sun, 3.2);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -24, right: 24, top: 24, bottom: -24, near: 1, far: 90 });
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03;
  scene.add(sun, sun.target, new THREE.HemisphereLight(PALETTE.hemiSky, PALETTE.hemiGround, 1.1));

  // sand: flat where the game is, falling away to the sea on the left; the pitch is raked a shade paler
  const g = new THREE.PlaneGeometry(220, 260, 220, 200).rotateX(-Math.PI / 2).translate(-10, 0, -30);
  const p = g.attributes.position, col = new Float32Array(p.count * 3), c = new THREE.Color(), wet = new THREE.Color(PALETTE.wetSand), bed = new THREE.Color(PALETTE.seabed);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i), y = groundAt(x);
    p.setY(i, y);
    c.set(PALETTE.sand).lerp(wet, THREE.MathUtils.smoothstep(-y, 0.05, 0.3)).lerp(bed, THREE.MathUtils.smoothstep(-y, 0.4, 1.6));
    if (Math.abs(x) < W && Math.abs(z) < L) c.offsetHSL(0, -0.03, 0.02);
    c.offsetHSL(0, 0, (r() - 0.5) * 0.03).toArray(col, i * 3);
  }
  g.computeVertexNormals();
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const ground = new THREE.Mesh(g, paintedMaterial({ amp: 0.22, scale: 1.4 }));
  ground.receiveShadow = true;
  scene.add(ground);

  const waterMat = seaMaterial('x', SET.shore + SET.sea / SET.slope);   // the waterline
  const water = new THREE.Mesh(new THREE.PlaneGeometry(600, 900).rotateX(-Math.PI / 2).translate(SET.shore - 296, SET.sea, -150), waterMat);
  water.renderOrder = 1;
  scene.add(water);

  // Khao Sam Muk up the beach, in the haze
  for (const [x, z, sx, sy, sz] of [[-150, -520, 190, 62, 120], [-10, -600, 150, 40, 100]]) {
    const hill = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 10, 0, Math.PI * 2, 0, Math.PI / 2).scale(sx, sy, sz), new THREE.MeshLambertMaterial({ color: PALETTE.hill }));
    hill.position.set(x, -2, z);
    scene.add(hill);
  }

  // the pitch: boards (a gap at each goal), goals, ribbon lines, flags
  const solid = [], netLines = [], B = SET.board;
  const board = (x, z, along, len, i) => solid.push(paint(new THREE.CapsuleGeometry(B.r, len - B.r * 2, 4, 10).rotateZ(Math.PI / 2).rotateY(along ? Math.PI / 2 : 0).translate(x, B.r, z), B.colors[i % 2]));
  for (const sx of [-1, 1]) for (let i = 0, n = Math.round((L * 2) / B.len); i < n; i++) board(sx * (W + B.r), -L + ((i + 0.5) * L * 2) / n, true, (L * 2) / n, i);
  for (const end of [-1, 1]) {
    const run = W - G.half - 0.12, n = Math.round(run / B.len);
    for (const sx of [-1, 1]) for (let i = 0; i < n; i++) board(sx * (G.half + 0.12 + ((i + 0.5) * run) / n), end * (L + B.r), false, run / n, i + 1);
    const goal = goalFrame(G), yaw = end > 0 ? 0 : Math.PI;                // the mouth faces the pitch
    solid.push(...goal.solid.map(geo => paint(geo.rotateY(yaw).translate(0, 0, end * L), GOAL_COLORS.post)));
    netLines.push(...placeNet(goal.net, yaw, 0, 0, end * L));
  }
  const flat = (geo, y = 0.014) => paint(geo.rotateX(-Math.PI / 2).translate(0, y, 0), SET.line);
  solid.push(flat(new THREE.PlaneGeometry(W * 2, 0.1)), flat(new THREE.RingGeometry(2.3, 2.4, 48)), flat(new THREE.CircleGeometry(0.14, 12)));
  for (const end of [-1, 1]) solid.push(flat(new THREE.RingGeometry(4.4, 4.5, 40, 1, 0, Math.PI)).rotateY(end > 0 ? 0 : Math.PI).translate(0, 0, end * L));   // the keeper's arc
  for (const [fx, fz] of [[-1, -1], [1, -1], [-1, 1], [1, 1], [-1, 0], [1, 0]]) {
    const x = fx * (W + 0.75), z = fz * (L + 0.75);
    solid.push(paint(new THREE.CylinderGeometry(0.02, 0.02, 1.5, 6).translate(x, 0.75, z), '#f4f1e8'));
    solid.push(paint(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 1.5, 0), new THREE.Vector3(0, 1.18, 0), new THREE.Vector3(0.36, 1.34, 0)]).toNonIndexed(), SET.flag).translate(x, 0, z));
  }
  for (const s of solid) if (!s.attributes.normal) s.computeVertexNormals();
  const propMat = paintedMaterial({ amp: 0.06, scale: 1 });
  propMat.side = THREE.DoubleSide;
  const pitch = new THREE.Mesh(mergeGeometries(solid), propMat);
  pitch.castShadow = pitch.receiveShadow = true;
  scene.add(pitch);
  const nets = new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(netLines, 3)),
    new THREE.LineBasicMaterial({ color: GOAL_COLORS.net, transparent: true, opacity: 0.55 }));
  // people watching from behind the boards on the umbrella side
  const spots = Array.from({ length: SET.watchers }, (_, i) => ({ x: W + 1.1 + r() * 1.3, z: -L + 2 + ((L * 2 - 4) * (i + r() * 0.6)) / SET.watchers, yaw: -Math.PI / 2 + (r() - 0.5) * 0.7 }));
  scene.add(nets, watcherMesh(spots, r));

  // the beach behind the right-hand boards: umbrellas and chairs, then palms and casuarinas
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), one = new THREE.Vector3(1, 1, 1);
  const umb = [];
  for (let z = -70; z <= 34; z += 3.6) for (const x of [W + 6, W + 9.6]) if (r() < 0.85) umb.push([x + r() * 0.6, z + r() * 0.8]);
  const dressMat = paintedMaterial({ amp: 0.06, scale: 1 });
  for (const [geo, tinted, ox, oz] of [[PROPS.umbrellaCanopy(), true, 0, 0], [PROPS.umbrellaPole(), false, 0, 0], [PROPS.deckChair(), false, -0.9, 0.7]]) {
    const mesh = new THREE.InstancedMesh(geo, dressMat, umb.length);
    umb.forEach(([x, z], i) => {
      mesh.setMatrixAt(i, m4.compose(new THREE.Vector3(x + ox, 0, z + oz), q.setFromAxisAngle(up, -Math.PI / 2 + (r() - 0.5) * 0.3), one));
      mesh.setColorAt(i, new THREE.Color(tinted ? '#ffffff' : '#f4f2ec'));
    });
    mesh.castShadow = true;
    scene.add(mesh);
  }
  const cards = cardMaterial(), bark = paintedMaterial({ amp: 0.3, scale: 1.2 });
  for (const [sp, x0, gap] of [['palm', W + 13.5, 6.5], ['casuarina', W + 21, 5.5]]) {
    const tpl = TREES[sp](rng(sp.length + 2)), spots = [];
    for (let z = -110; z <= 36; z += gap * (0.7 + r() * 0.6)) spots.push([x0 + r() * 4, z]);
    for (const [geo, mat, depth] of [[tpl.trunk, bark, null], [tpl.cards, cards.material, cards.depth]]) {
      const mesh = new THREE.InstancedMesh(geo, mat, spots.length);
      spots.forEach(([x, z], i) => mesh.setMatrixAt(i, m4.compose(new THREE.Vector3(x, -0.1, z), q.setFromAxisAngle(up, r() * 6.3), one)));
      if (depth) mesh.customDepthMaterial = depth;
      mesh.castShadow = true;
      mesh.computeBoundingSphere();
      scene.add(mesh);
    }
  }

  // the ball: white with dark patches (the twelve corners of an icosahedron)
  const bg = new THREE.SphereGeometry(BALL.r, 24, 16).toNonIndexed(), bp = bg.attributes.position, bc = new Float32Array(bp.count * 3);
  const spotsAt = new THREE.IcosahedronGeometry(1, 0).attributes.position, v = new THREE.Vector3(), w = new THREE.Vector3();
  for (let i = 0; i < bp.count; i += 3) {
    v.set(0, 0, 0);
    for (let k = 0; k < 3; k++) v.add(w.fromBufferAttribute(bp, i + k));
    v.normalize();
    let dark = false;
    for (let k = 0; k < spotsAt.count && !dark; k++) dark = v.dot(w.fromBufferAttribute(spotsAt, k).normalize()) > 0.93;
    for (let k = 0; k < 3; k++) c.set(dark ? '#26303a' : '#f6f4ee').toArray(bc, (i + k) * 3);
  }
  bg.deleteAttribute('uv');
  bg.setAttribute('color', new THREE.BufferAttribute(bc, 3));
  const ball = new THREE.Mesh(bg, paintedMaterial({ amp: 0.04, scale: 1 }));
  ball.castShadow = true;
  scene.add(ball);

  // a ring on the sand under the kid: it swells and warms as a kick winds up
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.44, 0.54, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.85, depthWrite: false }));
  ring.renderOrder = 2;
  scene.add(ring);

  const sunOff = new THREE.Vector3(...SET.sun);
  function update(t, focus) {
    waterMat.uniforms.time.value = t;
    sun.position.copy(focus).add(sunOff);                               // keep the shadow box round the play
    sun.target.position.copy(focus);
  }
  return { scene, update, ball, ring };
}
