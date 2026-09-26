// Midday swim area off Bang Saen: rolling waves (same formula as the physics), sandy
// shallows you can see into, foam on crests and at the shoreline, a buoy line, and the
// beach with umbrellas and casuarinas behind (+z).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { paintedMaterial } from '../world/materials.js';
import { createSky, skyUniforms } from '../world/sky.js';
import { SPECIES as TREES } from '../town/assets/trees.js';
import { cardMaterial } from '../world/foliage.js';
import * as PROPS from '../town/assets/props.js';
import { PALETTE } from '../shared/palette.js';
import { rng } from '../core/rng.js';
import { ROUND, waveAt } from './species.js';

export const seabedAt = (x, z) => (z > 0 ? z * 0.06 : z * 0.09) - 0.45 + Math.sin(x * 0.3 + z * 0.2) * 0.06;

function waterMaterial() {
  const W = ROUND.waves.map(w => { const l = Math.hypot(...w.dir); return new THREE.Vector4(w.dir[0] / l, w.dir[1] / l, w.len, w.amp); });
  const S = ROUND.waves.map(w => w.speed);
  return new THREE.ShaderMaterial({
    transparent: true,
    uniforms: {
      time: { value: 0 }, W: { value: W }, S: { value: S },
      shallow: { value: new THREE.Color('#7fd8c8') }, mid: { value: new THREE.Color(PALETTE.seaShallow) }, deep: { value: new THREE.Color(PALETTE.seaMid) },
      sunDir: skyUniforms.sunDir, zenith: skyUniforms.zenith, horizon: skyUniforms.horizon,
      haze: { value: new THREE.Color(PALETTE.haze) },
    },
    vertexShader: /* glsl */`
      uniform float time; uniform vec4 W[3]; uniform float S[3];
      varying vec3 vW; varying vec3 vN; varying float vH;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        float h = 0.0; vec2 g = vec2(0.0);
        float shore = smoothstep(1.5, -3.0, wp.z);          // waves flatten on the sand
        for (int i = 0; i < 3; i++) {
          float k = 6.2831853 / W[i].z, ph = dot(W[i].xy, wp.xz) * k - time * S[i] * k;
          h += W[i].w * sin(ph); g += W[i].w * k * cos(ph) * W[i].xy;
        }
        h *= shore; g *= shore;
        wp.y = h; vH = h;
        vN = normalize(vec3(-g.x, 1.0, -g.y));
        vW = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 shallow, mid, deep, sunDir, zenith, horizon, haze; uniform float time;
      varying vec3 vW; varying vec3 vN; varying float vH;
      float h2(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
      float n2(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(h2(i), h2(i + vec2(1, 0)), f.x), mix(h2(i + vec2(0, 1)), h2(i + vec2(1, 1)), f.x), f.y); }
      void main() {
        vec3 V = normalize(cameraPosition - vW), N = normalize(vN);
        float depth = max(0.0, -(vW.z > 0.0 ? vW.z * 0.06 : vW.z * 0.09) + 0.45);
        vec3 body = mix(shallow, mid, smoothstep(0.3, 1.6, depth));
        body = mix(body, deep, smoothstep(1.6, 4.0, depth));
        body *= 0.75 + 0.35 * max(dot(N, sunDir), 0.0);
        vec3 R = reflect(-V, N); R.y = abs(R.y);
        float F = 0.02 + 0.98 * pow(1.0 - max(dot(N, V), 0.0), 5.0);
        vec3 col = mix(body, mix(horizon, zenith, pow(R.y, 0.5)), F * 0.8);
        col += vec3(1.0, 0.96, 0.88) * pow(max(dot(R, sunDir), 0.0), 180.0) * 2.0;
        float foam = smoothstep(0.34, 0.58, vH) * smoothstep(0.35, 0.75, n2(vW.xz * 1.6 + vec2(time * 0.3, 0.0)) * 0.6 + n2(vW.xz * 4.0) * 0.4);
        foam += smoothstep(-0.8, 0.2, vW.z) * (0.4 + 0.3 * sin(vW.x * 1.7 + time * 2.0));
        col = mix(col, vec3(0.97), clamp(foam, 0.0, 0.85));
        float a = mix(0.55, 0.95, smoothstep(0.2, 1.5, depth));
        float fogF = 1.0 - exp(-pow(length(vW - cameraPosition) * 0.006, 2.0));
        col = mix(col, haze, fogF);
        gl_FragColor = vec4(col, max(a, foam));
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
}

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
  const r = rng(21);
  scene.add(createSky());
  scene.fog = new THREE.FogExp2(PALETTE.haze, 0.004);
  const sun = new THREE.DirectionalLight(PALETTE.sun, 3.2);
  sun.position.set(12, 30, 18);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -25, right: 25, top: 25, bottom: -25, near: 1, far: 100 });
  scene.add(sun, sun.target, new THREE.HemisphereLight(PALETTE.hemiSky, PALETTE.hemiGround, 1.1));

  // seabed + beach
  const g = new THREE.PlaneGeometry(160, 150, 160, 150).rotateX(-Math.PI / 2).translate(0, 0, -30);
  const p = g.attributes.position, col = new Float32Array(p.count * 3), c = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i);
    p.setY(i, seabedAt(x, z));
    c.set(z > 1.5 ? PALETTE.sand : PALETTE.wetSand).lerp(new THREE.Color('#9a8a62'), THREE.MathUtils.smoothstep(-z, 4, 30)).offsetHSL(0, 0, (r() - 0.5) * 0.04).toArray(col, i * 3);
  }
  g.computeVertexNormals();
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const ground = new THREE.Mesh(g, paintedMaterial({ amp: 0.2, scale: 1.2 }));
  ground.receiveShadow = true;
  scene.add(ground);

  const waterMat = waterMaterial();
  const water = new THREE.Mesh(new THREE.PlaneGeometry(160, 110, 200, 150).rotateX(-Math.PI / 2).translate(0, 0, -53), waterMat);
  water.renderOrder = 1;
  scene.add(water);

  // buoy line around the swim area
  const buoyGeo = mergeGeometries([paint(new THREE.SphereGeometry(0.22, 10, 8), '#e8443a'), paint(new THREE.SphereGeometry(0.16, 10, 8).translate(0, 0.14, 0), '#f4f1e8')]);
  const A = ROUND.area, buoys = [];
  for (let x = -A.x; x <= A.x; x += 2) buoys.push([x, A.z0 - 1]);
  for (let z = A.z0 - 1; z <= -2; z += 2) buoys.push([-A.x - 1, z], [A.x + 1, z]);
  const buoy = new THREE.InstancedMesh(buoyGeo, paintedMaterial({ amp: 0.05, scale: 1 }), buoys.length);
  scene.add(buoy);

  // beach: umbrellas, chairs and casuarinas behind the swimmers
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
  const umb = [];
  for (let x = -40; x <= 40; x += 3.6) if (r() < 0.8) umb.push([x + r() * 0.8, 9 + (Math.round(x / 3.6) % 2) * 3.5]);
  const propMat = paintedMaterial({ amp: 0.06, scale: 1 });
  const cols = ['#2f6fc4', '#d8443a', '#f0c23a'];
  // [geometry, tinted canopy?, offset from the umbrella (chairs sit beside it, facing the sea)]
  for (const [geo, tinted, ox, oz] of [[PROPS.umbrellaCanopy(), true, 0, 0], [PROPS.umbrellaPole(), false, 0, 0], [PROPS.deckChair(), false, 0.7, -0.9]]) {
    const mesh = new THREE.InstancedMesh(geo, propMat, umb.length);
    umb.forEach(([x, z], i) => {
      mesh.setMatrixAt(i, m4.compose(new THREE.Vector3(x + ox, seabedAt(x + ox, z + oz), z + oz), q.setFromAxisAngle(up, Math.PI + (r() - 0.5) * 0.3), new THREE.Vector3(1, 1, 1)));
      mesh.setColorAt(i, new THREE.Color(tinted ? cols[i % 3] : '#f4f2ec'));
    });
    mesh.castShadow = true;
    scene.add(mesh);
  }
  const tpl = TREES.casuarina(rng(3)), cards = cardMaterial(), bark = paintedMaterial({ amp: 0.3, scale: 1.2 });
  const treeSpots = [];
  for (let x = -60; x <= 60; x += 5 + r() * 4) treeSpots.push([x, 20 + r() * 8]);
  for (const [geo, mat, depth] of [[tpl.trunk, bark, null], [tpl.cards, cards.material, cards.depth]]) {
    const mesh = new THREE.InstancedMesh(geo, mat, treeSpots.length);
    treeSpots.forEach(([x, z], i) => mesh.setMatrixAt(i, m4.compose(new THREE.Vector3(x, seabedAt(x, z) - 0.1, z), q.setFromAxisAngle(up, r() * 6.3), new THREE.Vector3(1, 1, 1))));
    if (depth) mesh.customDepthMaterial = depth;
    mesh.castShadow = true;
    scene.add(mesh);
  }

  function update(t, focus) {
    waterMat.uniforms.time.value = t;
    buoys.forEach(([x, z], i) => buoy.setMatrixAt(i, m4.makeTranslation(x, waveAt(x, z, t).h + 0.05, z)));
    buoy.instanceMatrix.needsUpdate = true;
    // keep the sun's shadow box around the action
    sun.position.set(focus.x + 12, 30, focus.z + 18);
    sun.target.position.set(focus.x, 0, focus.z);
  }
  return { scene, update };
}
