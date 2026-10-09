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
import { bakePerson, personMaterial } from '../town/people/body.js';
import { PALETTE } from '../shared/palette.js';
import { rng } from '../core/rng.js';
import { PITCH, BALL } from './rules.js';
import { goalFrame, placeNet, GOAL_COLORS } from './goal.js';

const { L, W } = PITCH, G = PITCH.goal;
export const SET = {
  shore: -(W + 7), slope: 0.07, sea: -0.32,         // the sand starts to fall away here (x), this steeply, to the water at this height
  board: { r: 0.27, len: 2, colors: ['#f4f1e8', '#2f6fc4'] },
  line: '#2f6fc4', flag: '#e2443a',
  sun: [-16, 24, 10],                               // from over the sea, a little behind the camera
  watchers: 11,
};

function paint(g, hex) {
  g = g.index ? g.toNonIndexed() : g;
  if (g.attributes.uv) g.deleteAttribute('uv');
  const c = new THREE.Color(hex), n = g.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) c.toArray(a, i * 3);
  g.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return g;
}
export const groundAt = x => (x < SET.shore ? (x - SET.shore) * SET.slope : 0);

function waterMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true,
    uniforms: {
      time: { value: 0 }, edge: { value: SET.shore + SET.sea / SET.slope },   // edge: the waterline (x)
      shallow: { value: new THREE.Color('#7fd8c8') }, mid: { value: new THREE.Color(PALETTE.seaShallow) }, deep: { value: new THREE.Color(PALETTE.seaMid) },
      haze: { value: new THREE.Color(PALETTE.haze) },
    },
    vertexShader: /* glsl */`
      varying vec3 vW;
      void main() { vec4 wp = modelMatrix * vec4(position, 1.0); vW = wp.xyz; gl_Position = projectionMatrix * viewMatrix * wp; }`,
    fragmentShader: /* glsl */`
      uniform float time, edge; uniform vec3 shallow, mid, deep, haze;
      varying vec3 vW;
      float h2(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
      float n2(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(h2(i), h2(i + vec2(1, 0)), f.x), mix(h2(i + vec2(0, 1)), h2(i + vec2(1, 1)), f.x), f.y); }
      void main() {
        float wash = sin(time * 0.9 + vW.z * 0.33) * 0.55 + sin(time * 0.55 + vW.z * 0.12 + 1.7) * 0.45;   // the water's edge runs up and down the sand
        float d = edge - vW.x + wash * 0.7;                                                               // metres out from the edge
        if (d < 0.0) discard;
        vec3 col = mix(shallow, mid, smoothstep(0.0, 16.0, d));
        col = mix(col, deep, smoothstep(16.0, 90.0, d));
        col *= 0.9 + 0.2 * n2(vW.xz * vec2(0.45, 1.5) + vec2(time * 0.4, 0.0));
        float roll = sin(d * 0.5 + time * 1.1 + n2(vec2(vW.z * 0.15, 3.0)) * 2.5);                         // low waves rolling in along the shore
        float foam = smoothstep(1.3, 0.0, d) * (0.55 + 0.45 * n2(vW.xz * 3.0 + time * 0.6))
          + smoothstep(0.86, 1.0, roll) * smoothstep(1.5, 5.0, d) * smoothstep(45.0, 12.0, d) * n2(vW.xz * 2.2) * 0.8;
        col = mix(col, vec3(0.97), clamp(foam, 0.0, 0.9));
        float fogF = 1.0 - exp(-pow(length(vW - cameraPosition) * 0.006, 2.0));
        gl_FragColor = vec4(mix(col, haze, fogF), mix(0.6, 0.95, smoothstep(0.0, 3.0, d)));
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
}

/** People watching from behind the boards on the umbrella side (one merged, static mesh). */
function watchers(r) {
  const ADULT = { scale: 1.3, headScale: 0.86, print: 'none' }, pick = a => a[Math.floor(r() * a.length)];
  const shirts = ['#f4f1e8', '#f0b43a', '#e8958a', '#7fc4e8', '#9ad0b0', '#e2553f', '#c9b0e0'], skins = ['#c68f66', '#b8835c', '#d9a57c', '#a8764f'];
  const poses = [
    b => { b.armL.rotation.set(0, 0, 2.7); b.armR.rotation.set(0, 0, -2.7); },                       // both arms up
    b => { b.armR.rotation.set(-2.6, 0, -0.3); b.foreR.rotation.x = -0.4; },                           // one arm up
    b => { b.armL.rotation.set(-0.5, 0, 0.5); b.foreL.rotation.x = -1.9; b.armR.rotation.set(-0.5, 0, -0.5); b.foreR.rotation.x = -1.9; },   // hands together
    () => {},
  ];
  const geos = [];
  for (let i = 0; i < SET.watchers; i++) {
    const kid = r() < 0.4, look = { ...(kid ? { scale: 0.95 + r() * 0.1 } : ADULT), skin: pick(skins), shirt: pick(shirts), bottomColor: pick(['#34507a', '#5a4a3a', '#3a3a3a', '#f4f1e8']),
      hairStyle: pick(['short', 'long', 'bun', 'short']), hat: pick(['none', 'none', 'cap', 'straw', 'bucket']), bottom: pick(['shorts', 'shorts', 'pants', 'skirt']) };
    const z = -L + 2 + ((L * 2 - 4) * (i + r() * 0.6)) / SET.watchers, x = W + 1.1 + r() * 1.3;
    geos.push(bakePerson(look, pick(poses), 0.5).rotateY(-Math.PI / 2 + (r() - 0.5) * 0.7).translate(x, 0, z));
  }
  const mesh = new THREE.Mesh(mergeGeometries(geos), personMaterial());
  mesh.castShadow = mesh.receiveShadow = true;
  return mesh;
}

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

  const waterMat = waterMaterial();
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
  scene.add(nets, watchers(r));

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
