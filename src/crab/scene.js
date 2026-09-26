// Dusk beach for จับปูลม: a strip of sand between the sea (−z) and a casuarina line
// (+z). The sky and light fade from golden dusk to night over the round (setDusk).
import * as THREE from 'three';
import { paintedMaterial } from '../world/materials.js';
import { applyHaze } from '../world/haze.js';
import { SPECIES as TREES } from '../town/assets/trees.js';
import { cardMaterial } from '../world/foliage.js';
import { rng } from '../core/rng.js';

export const BEACH = { x0: -20, x1: 20, water: -12, back: 12, treeLine: 27 };  // trees stay behind the camera

// dusk (t=0) → night (t=1)
const LOOK = {
  zenith: ['#3a4f8a', '#101a3a'], horizon: ['#f2a060', '#3a3a6a'], sunCol: ['#ffb070', '#6a70a8'],
  sun: [2.6, 0.2], hemi: [1.5, 0.42], fog: ['#e0b09a', '#1c2440'], fogDensity: [0.009, 0.02],
  sand: '#d9c6a0', wet: '#a8946e', sea: '#2d5a78',
};
const lerpC = (a, b, t) => new THREE.Color(a).lerp(new THREE.Color(b), t);

export const heightAt = (x, z) => {
  // gentle beach: rises away from the water, small dunes near the tree line
  const base = Math.max(0, (z - BEACH.water) * 0.035);
  return base + Math.sin(x * 0.21) * Math.cos(z * 0.17) * 0.12 + Math.max(0, z - 12) * 0.05;
};

function skyMaterial(u) {
  return new THREE.ShaderMaterial({
    uniforms: u, side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position,1.); gl_Position = p.xyww; }',
    fragmentShader: `uniform vec3 zenith, horizon, sunCol, sunDir; uniform float stars; varying vec3 vD;
      float h(vec3 p){ return fract(sin(dot(p, vec3(12.9898,78.233,45.164))) * 43758.5453); }
      void main(){ vec3 d = normalize(vD); float e = max(d.y, 0.);
        vec3 c = mix(horizon, zenith, pow(e, 0.45));
        float s = max(dot(d, sunDir), 0.); c += sunCol * (pow(s, 12.) * 0.6 + pow(s, 400.) * 3.);
        vec3 q = floor(d * 180.); float st = step(0.9975, h(q)) * smoothstep(0.1, 0.5, d.y) * stars; c += vec3(st);
        gl_FragColor = vec4(c, 1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
}

export function buildScene() {
  const scene = new THREE.Scene();
  const r = rng(77);
  const sunDir = new THREE.Vector3(-0.8, 0.22, -0.6).normalize();   // setting over the sea (west)
  const skyU = { zenith: { value: new THREE.Color() }, horizon: { value: new THREE.Color() }, sunCol: { value: new THREE.Color() }, sunDir: { value: sunDir }, stars: { value: 0 } };
  const sky = new THREE.Mesh(new THREE.SphereGeometry(400, 32, 16), skyMaterial(skyU));
  sky.frustumCulled = false; sky.renderOrder = -1;
  sky.onBeforeRender = (_r, _s, cam) => sky.position.copy(cam.position);
  scene.add(sky);
  scene.fog = new THREE.FogExp2(LOOK.fog[0], LOOK.fogDensity[0]);

  const sun = new THREE.DirectionalLight(LOOK.sunCol[0], LOOK.sun[0]);
  sun.position.copy(sunDir).multiplyScalar(60);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -40, right: 40, top: 40, bottom: -40, near: 1, far: 160 });
  sun.shadow.bias = -0.0005;
  const hemi = new THREE.HemisphereLight('#b8b0d8', '#8a6a4a', LOOK.hemi[0]);
  scene.add(sun, hemi);

  // sand: vertex-coloured, wet near the water
  const W = BEACH.x1 - BEACH.x0 + 60, D = 70;
  const sand = new THREE.PlaneGeometry(W, D, 120, 140).rotateX(-Math.PI / 2).translate(0, 0, 8);
  const pos = sand.attributes.position, col = new Float32Array(pos.count * 3), c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    pos.setY(i, heightAt(x, z) - (z < BEACH.water ? (BEACH.water - z) * 0.08 : 0));
    const wet = THREE.MathUtils.smoothstep(z, BEACH.water + 5, BEACH.water);
    c.set(LOOK.sand).lerp(new THREE.Color(LOOK.wet), wet).offsetHSL(0, 0, (r() - 0.5) * 0.03).toArray(col, i * 3);
  }
  sand.computeVertexNormals();
  sand.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const ground = new THREE.Mesh(sand, paintedMaterial({ amp: 0.22, scale: 1.5 }));
  ground.receiveShadow = true;
  scene.add(ground);

  // sea with a soft foam line that rolls in and out
  const seaU = { time: { value: 0 }, col: { value: new THREE.Color(LOOK.sea) }, sky: { value: new THREE.Color() } };
  const seaMat = new THREE.ShaderMaterial({
    uniforms: seaU,
    transparent: true, fog: false,
    vertexShader: 'varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position,1.); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: `uniform float time; uniform vec3 col, sky; varying vec3 vW;
      void main(){ float edge = ${BEACH.water.toFixed(1)} - vW.z;
        float wave = sin(vW.x * 0.35 + time * 0.9) * 0.6 + sin(vW.x * 0.9 - time * 1.3) * 0.25 + sin(time * 0.5) * 0.8;
        float foam = smoothstep(1.4, 0.2, abs(edge + wave)) * (0.6 + 0.4 * sin(vW.x * 3. + time * 2.));
        float fres = smoothstep(0., 40., edge) * 0.5;
        vec3 c = mix(col, sky, 0.35 + fres) + foam * 0.55;
        float a = smoothstep(-1.5, 1.5, edge + wave) * 0.92;
        gl_FragColor = vec4(c, a);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(400, 200).rotateX(-Math.PI / 2).translate(0, 0.08, BEACH.water - 96), seaMat);
  scene.add(sea);

  // casuarina tree line behind the beach (instanced from the town's tree templates)
  const tpl = TREES.casuarina(rng(5)), cards = cardMaterial();
  const trunkMat = paintedMaterial({ amp: 0.3, scale: 1.2 });
  const spots = [];
  for (let x = BEACH.x0 - 20; x < BEACH.x1 + 20; x += 5 + r() * 4) spots.push([x, BEACH.treeLine + r() * 6]);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
  for (const [geo, mat, depth] of [[tpl.trunk, trunkMat, null], [tpl.cards, cards.material, cards.depth]]) {
    const mesh = new THREE.InstancedMesh(geo, mat, spots.length);
    spots.forEach(([x, z], i) => {
      const s = 0.8 + r() * 0.35;
      mesh.setMatrixAt(i, m.compose(new THREE.Vector3(x, heightAt(x, z) - 0.1, z), q.setFromAxisAngle(up, r() * 6.3), new THREE.Vector3(s, s, s)));
    });
    mesh.castShadow = mesh.receiveShadow = true;
    if (depth) mesh.customDepthMaterial = depth;
    mesh.computeBoundingSphere();
    scene.add(mesh);
  }

  // lamp posts along the promenade: warm pools of light once it gets dark
  const lamps = [];
  const postMat = applyHaze(new THREE.MeshLambertMaterial({ color: '#3a3a3a' }));
  const bulbMat = new THREE.MeshBasicMaterial({ color: '#ffd9a0' });
  for (const x of [-16, 2, 18]) {
    const z = BEACH.back + 2.5, y = heightAt(x, z);
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 4, 8), postMat);
    post.position.set(x, y + 2, z); post.castShadow = true;
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 8), bulbMat);
    bulb.position.set(x, y + 4.05, z);
    const light = new THREE.PointLight('#ffc98a', 0, 16, 1.6);
    light.position.set(x, y + 3.9, z);
    scene.add(post, bulb, light);
    lamps.push(light);
  }

  /** t: 0 = golden dusk → 1 = night. */
  function setDusk(t) {
    skyU.zenith.value.copy(lerpC(LOOK.zenith[0], LOOK.zenith[1], t));
    skyU.horizon.value.copy(lerpC(LOOK.horizon[0], LOOK.horizon[1], t));
    skyU.sunCol.value.copy(lerpC(LOOK.sunCol[0], LOOK.sunCol[1], t));
    skyU.stars.value = THREE.MathUtils.smoothstep(t, 0.4, 1);
    sun.color.copy(skyU.sunCol.value);
    sun.intensity = THREE.MathUtils.lerp(LOOK.sun[0], LOOK.sun[1], t);
    hemi.intensity = THREE.MathUtils.lerp(LOOK.hemi[0], LOOK.hemi[1], t);
    scene.fog.color.copy(lerpC(LOOK.fog[0], LOOK.fog[1], t));
    scene.fog.density = THREE.MathUtils.lerp(LOOK.fogDensity[0], LOOK.fogDensity[1], t);
    seaU.sky.value.copy(skyU.horizon.value).lerp(skyU.zenith.value, 0.5);
    for (const l of lamps) l.intensity = THREE.MathUtils.smoothstep(t, 0.25, 0.7) * 14;
  }
  setDusk(0);

  return { scene, sun, hemi, setDusk, update: time => { seaU.time.value = time; } };
}
