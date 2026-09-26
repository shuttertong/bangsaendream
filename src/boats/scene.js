// Open sea off Bang Saen for the towed-inflatable games: rolling swell that follows the
// camera, the coast (beach, casuarinas, Khao Sam Muk) far off to one side, a speedboat
// with its driver, the tow rope and a foam wake behind the boat.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createSky, skyUniforms } from '../world/sky.js';
import { paintedMaterial } from '../world/materials.js';
import { buildPerson } from '../town/people/body.js';
import { PALETTE } from '../shared/palette.js';
import { speedboatGeometry } from './models.js';
import { rng } from '../core/rng.js';

export const SWELL = [
  { amp: 0.35, len: 16, speed: 3.5, dir: [0.3, 1] },
  { amp: 0.18, len: 7, speed: 2.4, dir: [-0.6, 0.8] },
  { amp: 0.08, len: 3.4, speed: 1.9, dir: [1, 0.2] },
];

/** Swell height + slope at (x, z, t) — same sum as the water shader. */
export function swellAt(x, z, t) {
  let h = 0, gx = 0, gz = 0;
  for (const w of SWELL) {
    const l = Math.hypot(...w.dir), dx = w.dir[0] / l, dz = w.dir[1] / l, k = (Math.PI * 2) / w.len;
    const ph = (x * dx + z * dz) * k - t * w.speed * k;
    h += w.amp * Math.sin(ph);
    const c = w.amp * k * Math.cos(ph);
    gx += c * dx; gz += c * dz;
  }
  return { h, gx, gz };
}

function paint(g, hex) {
  g = g.index ? g.toNonIndexed() : g;
  if (g.attributes.uv) g.deleteAttribute('uv');
  const c = new THREE.Color(hex), n = g.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) c.toArray(a, i * 3);
  g.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return g;
}

function oceanMaterial() {
  const W = SWELL.map(w => { const l = Math.hypot(...w.dir); return new THREE.Vector4(w.dir[0] / l, w.dir[1] / l, w.len, w.amp); });
  return new THREE.ShaderMaterial({
    uniforms: {
      time: { value: 0 }, W: { value: W }, S: { value: SWELL.map(w => w.speed) },
      body: { value: new THREE.Color(PALETTE.seaMid) }, shallow: { value: new THREE.Color(PALETTE.seaShallow) },
      sunDir: skyUniforms.sunDir, zenith: skyUniforms.zenith, horizon: skyUniforms.horizon, haze: { value: new THREE.Color(PALETTE.haze) },
    },
    vertexShader: /* glsl */`
      uniform float time; uniform vec4 W[3]; uniform float S[3];
      varying vec3 vW; varying vec3 vN; varying float vH;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        float h = 0.0; vec2 g = vec2(0.0);
        for (int i = 0; i < 3; i++) {
          float k = 6.2831853 / W[i].z, ph = dot(W[i].xy, wp.xz) * k - time * S[i] * k;
          h += W[i].w * sin(ph); g += W[i].w * k * cos(ph) * W[i].xy;
        }
        wp.y = h; vH = h; vN = normalize(vec3(-g.x, 1.0, -g.y)); vW = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 body, shallow, sunDir, zenith, horizon, haze; uniform float time;
      varying vec3 vW; varying vec3 vN; varying float vH;
      void main() {
        vec3 V = normalize(cameraPosition - vW), N = normalize(vN);
        vec3 c = mix(body, shallow, smoothstep(-0.2, 0.45, vH) * 0.6) * (0.75 + 0.35 * max(dot(N, sunDir), 0.0));
        vec3 R = reflect(-V, N); R.y = abs(R.y);
        float F = 0.02 + 0.98 * pow(1.0 - max(dot(N, V), 0.0), 5.0);
        c = mix(c, mix(horizon, zenith, pow(R.y, 0.5)), F * 0.85);
        c += vec3(1.0, 0.96, 0.88) * pow(max(dot(R, sunDir), 0.0), 200.0) * 2.2;
        c = mix(c, vec3(0.96), smoothstep(0.5, 0.62, vH) * 0.35);      // a little foam on the highest crests
        float f = 1.0 - exp(-pow(length(vW - cameraPosition) * 0.0022, 2.0));
        gl_FragColor = vec4(mix(c, haze, f), 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
}

/** tow: false leaves out the speedboat + rope (the jet ski drives itself). */
export function buildScene(r = rng(8), { tow = true } = {}) {
  const scene = new THREE.Scene();
  scene.add(createSky());
  scene.fog = new THREE.FogExp2(PALETTE.haze, 0.0012);
  const sun = new THREE.DirectionalLight(PALETTE.sun, 3.2);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -30, right: 30, top: 30, bottom: -30, near: 1, far: 120 });
  scene.add(sun, sun.target, new THREE.HemisphereLight(PALETTE.hemiSky, PALETTE.hemiGround, 1.1));

  const oceanMat = oceanMaterial();
  const ocean = new THREE.Mesh(new THREE.PlaneGeometry(260, 260, 200, 200).rotateX(-Math.PI / 2), oceanMat);
  ocean.frustumCulled = false;
  const far = new THREE.Mesh(new THREE.PlaneGeometry(6000, 6000).rotateX(-Math.PI / 2).translate(0, -0.05, 0), new THREE.MeshBasicMaterial({ color: new THREE.Color(PALETTE.seaMid).multiplyScalar(0.92) }));
  scene.add(far, ocean);

  // the Bang Saen coast far off to the east (+x... the boats run north along it)
  const coast = [];
  coast.push(paint(new THREE.BoxGeometry(40, 1.2, 4000).translate(420, 0.4, 1500), PALETTE.sand));
  coast.push(paint(new THREE.BoxGeometry(80, 6, 4000).translate(480, 3, 1500), '#5f8a44'));
  for (let z = -400; z < 3400; z += 22 + r() * 30) coast.push(paint(new THREE.ConeGeometry(4 + r() * 3, 12 + r() * 8, 6).translate(446 + r() * 20, 10, z), '#4d6e3c'));
  for (let z = -400; z < 3400; z += 9) if (r() < 0.6) coast.push(paint(new THREE.ConeGeometry(1.6, 0.8, 8).translate(412 + r() * 8, 2.4, z), r() < 0.5 ? '#2f6fc4' : '#d8443a'));
  coast.push(paint(new THREE.SphereGeometry(1, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2).scale(160, 70, 220).translate(470, 0, 2600), '#4f7236'));   // Khao Sam Muk
  for (let z = 0; z < 3200; z += 140) coast.push(paint(new THREE.BoxGeometry(18, 20 + r() * 30, 14).translate(520, 12, z + r() * 60), r() < 0.5 ? '#eee7da' : '#e2e6ea'));   // condos
  const land = new THREE.Mesh(mergeGeometries(coast), paintedMaterial({ amp: 0.1, scale: 8 }));
  scene.add(land);

  // speedboat + driver
  const boat = new THREE.Group();
  const hull = new THREE.Mesh(speedboatGeometry(), paintedMaterial({ amp: 0.05, scale: 1 }));
  hull.castShadow = true;
  boat.add(hull);
  const driver = buildPerson({ scale: 1.3, headScale: 0.86, skin: '#a8764f', shirt: '#f4f1e8', hat: 'cap', hatColor: '#2f6fc4', hatBand: '#f4f1e8', bottom: 'shorts', bottomColor: '#3a3a3a', vest: '#e8541e' });
  driver.mesh.position.set(0, 0.05, -0.2);
  driver.bones.armL.rotation.set(-1.1, 0, 0.2); driver.bones.armR.rotation.set(-1.1, 0, -0.2);
  boat.add(driver.mesh);
  if (tow) scene.add(boat);

  // tow rope + foam wake ribbon
  const ropeGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
  const rope = new THREE.Line(ropeGeo, new THREE.LineBasicMaterial({ color: '#f0e8d0' }));
  if (tow) scene.add(rope);
  const N = 60, trail = [];
  const wakeGeo = new THREE.BufferGeometry();
  wakeGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 2 * 3), 3));
  wakeGeo.setAttribute('alpha', new THREE.BufferAttribute(new Float32Array(N * 2), 1));
  const across = new Float32Array(N * 2);
  for (let i = 0; i < N; i++) { across[i * 2] = 1; across[i * 2 + 1] = -1; }
  wakeGeo.setAttribute('across', new THREE.BufferAttribute(across, 1));
  const idx = [];
  for (let i = 0; i < N - 1; i++) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  wakeGeo.setIndex(idx);
  const wake = new THREE.Mesh(wakeGeo, new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    // V-shaped wake: bright foam lines at the edges, churned water in the middle, soft noise
    vertexShader: 'attribute float alpha; attribute float across; varying float vA; varying float vX; varying vec2 vP; void main(){ vA = alpha; vX = across; vP = position.xz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
    fragmentShader: `varying float vA; varying float vX; varying vec2 vP;
      float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)))*43758.5453); }
      float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.-2.*f); return mix(mix(h(i),h(i+vec2(1,0)),f.x), mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x), f.y); }
      void main(){ float e = abs(vX); float edge = smoothstep(0.55, 0.9, e) * (1. - smoothstep(0.9, 1., e));
        float mid = (1. - smoothstep(0., 0.35, e)) * 0.6;
        float a = vA * (edge + mid) * (0.45 + 0.55 * n(vP * 1.7));
        gl_FragColor = vec4(vec3(0.97), a); }`,
  }));
  wake.frustumCulled = false;
  scene.add(wake);
  let trailTimer = 0;

  /**
   * t: time; T: createTow() state (or null); towPoint: where the rope attaches on the
   * inflatable; wakeFrom: {x, z, yaw, strength} when there's no tow boat (jet ski).
   */
  function update(t, dt, T, towPoint, cam, wakeFrom = null) {
    oceanMat.uniforms.time.value = t;
    ocean.position.set(Math.round(cam.x / 1.3) * 1.3, 0, Math.round(cam.z / 1.3) * 1.3);
    let st = wakeFrom, yaw = wakeFrom?.yaw ?? 0;
    if (T) {
      const b = T.boat, w = swellAt(b.x, b.z, t);
      boat.position.set(b.x, w.h - 0.2 + Math.abs(Math.sin(t * 7)) * 0.05, b.z);
      boat.rotation.set(-0.08 - w.gz * 0.3, b.yaw, -b.turn * 0.25 + w.gx * 0.3, 'YXZ');
      st = T.stern(); yaw = b.yaw;
      ropeGeo.attributes.position.setXYZ(0, st.x, w.h + 0.7, st.z);
      ropeGeo.attributes.position.setXYZ(1, towPoint.x, towPoint.y, towPoint.z);
      ropeGeo.attributes.position.needsUpdate = true;
      ropeGeo.computeBoundingSphere();
    }
    const strength = wakeFrom?.strength ?? 1;
    // wake: record the stern every 0.1 s; the ribbon widens and fades with age
    trailTimer -= dt;
    if (trailTimer <= 0) { trailTimer = 0.1; trail.unshift({ x: st.x, z: st.z, yaw, k: strength }); if (trail.length > N) trail.pop(); }
    const pos = wakeGeo.attributes.position, al = wakeGeo.attributes.alpha;
    for (let i = 0; i < N; i++) {
      const p = trail[Math.min(i, trail.length - 1)] || { x: st.x, z: st.z, yaw, k: 0 };
      const half = 0.6 + i * 0.12, rx = Math.cos(p.yaw), rz = -Math.sin(p.yaw);
      const hh = swellAt(p.x, p.z, t).h + 0.04;
      pos.setXYZ(i * 2, p.x + rx * half, hh, p.z + rz * half);
      pos.setXYZ(i * 2 + 1, p.x - rx * half, hh, p.z - rz * half);
      const a = i < trail.length ? Math.max(0, 1 - i / N) * 0.8 * p.k : 0;
      al.setX(i * 2, a); al.setX(i * 2 + 1, a);
    }
    pos.needsUpdate = al.needsUpdate = true;
    sun.position.set(cam.x + 20, 40, cam.z + 10);
    sun.target.position.set(cam.x, 0, cam.z);
  }

  return { scene, update };
}
