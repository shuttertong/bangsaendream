// Night squid boat off Laem Thaen, seen side-on from under the water (a cutaway):
// the boat, its lamp boom and the kid above the line; squid, the jig, sea floor,
// swaying seaweed and a fish school below.
import * as THREE from 'three';
import { underwaterUniforms, uwMaterial } from '../world/underwater.js';
import { buildPerson } from '../town/people/body.js';
import { ROSTER } from '../town/people/roster.js';
import { rng } from '../core/rng.js';
import { ROUND } from './species.js';

export const BOAT = { x: -2.5, deck: 1.1, rodTip: new THREE.Vector3(2.6, 2.5, 0.4), lureX: 2.7 };
const LAMPS = [-5.5, -3, -0.5, 2];

function paint(g, hex) {
  g = g.index ? g.toNonIndexed() : g;
  if (g.attributes.uv) g.deleteAttribute('uv');
  const c = new THREE.Color(hex), n = g.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) c.toArray(a, i * 3);
  g.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return g;
}

function sky() {
  return new THREE.Mesh(new THREE.SphereGeometry(400, 32, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position,1.); gl_Position = p.xyww; }',
    fragmentShader: `varying vec3 vD;
      float h(vec3 p){ return fract(sin(dot(p, vec3(12.9898,78.233,45.164))) * 43758.5453); }
      void main(){ vec3 d = normalize(vD); float e = max(d.y, 0.);
        vec3 c = mix(vec3(0.07,0.1,0.22), vec3(0.02,0.03,0.09), pow(e, 0.5));
        vec3 moon = normalize(vec3(0.5, 0.35, -0.8)); float m = max(dot(d, moon), 0.);
        c += vec3(1.,0.97,0.88) * (step(0.9993, m) * 2. + pow(m, 60.) * 0.25);
        c += vec3(step(0.998, h(floor(d * 220.)))) * smoothstep(0.05, 0.3, d.y) * 0.9;
        gl_FragColor = vec4(c, 1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  }));
}

export function buildScene() {
  const scene = new THREE.Scene();
  const U = underwaterUniforms({ waterY: 0, light: [-1.5, 3, 0], causticStrength: 0.6, density: 0.045, shallow: '#136a78', deep: '#031626', absorb: [0.5, 0.14, 0.08], air: '#0a1230', airDensity: 0.004 });
  const r = rng(11);
  const sk = sky(); sk.frustumCulled = false; sk.onBeforeRender = (_r, _s, cam) => sk.position.copy(cam.position);
  scene.add(sk);

  scene.add(new THREE.HemisphereLight('#4a6a9a', '#0a1a2a', 0.55));
  const moon = new THREE.DirectionalLight('#b8c8ff', 0.5);
  moon.position.set(20, 30, 10);
  scene.add(moon);

  // boat lamps: bright bulbs + a strong downward light that pulls squid into the glow
  const lampLight = new THREE.SpotLight('#dfffe8', 260, 30, 0.95, 0.6, 1.2);
  lampLight.position.set(-1.5, 3.2, 0.5);
  lampLight.target.position.set(0.5, -10, 0);
  lampLight.castShadow = true;
  lampLight.shadow.mapSize.set(1024, 1024);
  scene.add(lampLight, lampLight.target);
  const fill = new THREE.PointLight('#cfffe0', 30, 14, 1.4);
  fill.position.set(0, 2.6, 2.5);
  scene.add(fill);

  // ---- boat (side profile extruded across its width) ----
  const hullShape = new THREE.Shape();
  hullShape.moveTo(-4.2, 1.2); hullShape.lineTo(3.4, 1.2); hullShape.quadraticCurveTo(4.6, 1.6, 4.9, 2.1);
  hullShape.lineTo(4.4, 0.4); hullShape.quadraticCurveTo(3.0, -0.55, 0, -0.6); hullShape.lineTo(-3.8, -0.45);
  hullShape.quadraticCurveTo(-4.4, 0.3, -4.2, 1.2);
  const hull = new THREE.ExtrudeGeometry(hullShape, { depth: 2.4, bevelEnabled: false }).translate(0, 0, -1.2);
  const hp = hull.attributes.position, hc = new Float32Array(hp.count * 3), c = new THREE.Color();
  for (let i = 0; i < hp.count; i++) {
    const y = hp.getY(i);
    c.set(y > 1.0 ? '#f2efe6' : y > 0.75 ? '#d8443a' : y > -0.1 ? '#2f6fa8' : '#6a3a2a').toArray(hc, i * 3);
  }
  hull.setAttribute('color', new THREE.BufferAttribute(hc, 3));
  const boatMat = uwMaterial(U);
  const boat = new THREE.Group();
  boat.add(new THREE.Mesh(hull, boatMat));
  const parts = [
    paint(new THREE.BoxGeometry(2.2, 1.5, 2.0).translate(-2.4, 1.95, 0), '#e9e4d6'),     // cabin
    paint(new THREE.BoxGeometry(2.6, 0.12, 2.3).translate(-2.4, 2.76, 0), '#2f6fa8'),    // cabin roof
    paint(new THREE.BoxGeometry(0.9, 0.5, 0.05).translate(-2.4, 2.1, 1.01), '#3a4a5a'),   // window
    paint(new THREE.CylinderGeometry(0.06, 0.07, 3.2, 8).translate(-1.2, 2.8, 0), '#8a8680'),   // mast
    paint(new THREE.CylinderGeometry(0.04, 0.04, 8.6, 6).rotateZ(Math.PI / 2).translate(-1.6, 3.9, 0.6), '#8a8680'),  // boom
  ];
  for (const x of LAMPS) parts.push(paint(new THREE.CylinderGeometry(0.01, 0.01, 0.6, 4).translate(x, 3.6, 0.6), '#333'));
  for (const g of parts) boat.add(new THREE.Mesh(g, boatMat));
  const bulbMat = new THREE.MeshBasicMaterial({ color: '#eaffee' });
  for (const x of LAMPS) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 8), bulbMat); b.position.set(x, 3.25, 0.6); boat.add(b); }
  boat.position.x = BOAT.x;
  boat.traverse(o => { o.castShadow = o.receiveShadow = true; });
  scene.add(boat);

  // Uncle Piak on deck
  const piak = buildPerson(ROSTER.find(p => p.id === 'piak').look);
  piak.mesh.position.set(BOAT.x - 0.4, BOAT.deck + 0.1, -0.3);
  piak.mesh.rotation.y = Math.PI / 2;
  piak.bones.armR.rotation.set(-0.4, 0, -0.3);
  scene.add(piak.mesh);

  // ---- under the water ----
  // the underside of the surface, lit from above by the lamps
  const surfMat = new THREE.ShaderMaterial({
    uniforms: { time: U.uwTime }, transparent: true, side: THREE.DoubleSide, depthWrite: false,
    vertexShader: 'varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position,1.); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: `uniform float time; varying vec3 vW;
      void main(){ float glow = exp(-abs(vW.x + 1.5) * 0.16) * exp(-abs(vW.z) * 0.08);
        float rip = sin(vW.x * 2.1 + time * 1.7) * sin(vW.z * 2.7 - time * 1.3) * 0.5 + 0.5;
        vec3 c = mix(vec3(0.03,0.2,0.28), vec3(0.55,0.95,0.85), glow * (0.55 + 0.45 * rip));
        gl_FragColor = vec4(c, 0.92);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const surface = new THREE.Mesh(new THREE.PlaneGeometry(140, 17).rotateX(Math.PI / 2).translate(0, -0.02, -5.5), surfMat);
  scene.add(surface);

  // back wall of water and the sea floor
  const back = new THREE.Mesh(paint(new THREE.PlaneGeometry(160, ROUND.bottom + 6).translate(0, -(ROUND.bottom + 6) / 2, -14), '#0e4a5a'), uwMaterial(U));
  scene.add(back);
  const floorG = new THREE.PlaneGeometry(160, 30, 160, 30).rotateX(-Math.PI / 2).translate(0, -ROUND.bottom, -4);
  const fp = floorG.attributes.position, fc = new Float32Array(fp.count * 3);
  for (let i = 0; i < fp.count; i++) {
    const x = fp.getX(i), z = fp.getZ(i);
    fp.setY(i, -ROUND.bottom + Math.sin(x * 0.3) * 0.4 + Math.cos(x * 0.13 + z * 0.4) * 0.5 - Math.max(0, -z - 6) * 0.2);
    c.set('#c9b48a').offsetHSL(0, 0, (r() - 0.5) * 0.06).toArray(fc, i * 3);
  }
  floorG.computeVertexNormals();
  floorG.setAttribute('color', new THREE.BufferAttribute(fc, 3));
  const floor = new THREE.Mesh(floorG, uwMaterial(U));
  floor.receiveShadow = true;
  scene.add(floor);

  // rocks + swaying seaweed
  const rockMat = uwMaterial(U);
  for (let i = 0; i < 26; i++) {
    const g = paint(new THREE.DodecahedronGeometry(0.5 + r() * 1.3, 0), r() < 0.5 ? '#6a6a5a' : '#7a6a58');
    const m = new THREE.Mesh(g, rockMat);
    m.position.set(-20 + r() * 40, -ROUND.bottom + 0.2, -9 + r() * 10);
    m.scale.y = 0.5 + r() * 0.5; m.rotation.set(r(), r() * 6, r());
    scene.add(m);
  }
  const weed = [];
  for (let i = 0; i < 60; i++) {
    const h = 1.2 + r() * 3;
    const g = new THREE.PlaneGeometry(0.25, h, 1, 6).translate(0, h / 2, 0);
    g.rotateY(r() * Math.PI);
    const p = g.attributes.position, sway = new Float32Array(p.count);
    for (let k = 0; k < p.count; k++) sway[k] = (p.getY(k) / h) ** 1.5 * (0.6 + r() * 0.8);
    g.setAttribute('sway', new THREE.BufferAttribute(sway, 1));
    g.translate(-20 + r() * 40, -ROUND.bottom, -10 + r() * 11);
    weed.push(paint(g, r() < 0.6 ? '#3f7a4a' : '#6a8a3a'));
  }
  const weedGeo = mergeSway(weed);
  scene.add(new THREE.Mesh(weedGeo, uwMaterial(U, { side: THREE.DoubleSide }, true)));

  // a small fish school circling in the lamp glow (instanced, tails wag via sway)
  const fishG = paint(new THREE.ConeGeometry(0.07, 0.32, 5).rotateZ(-Math.PI / 2), '#c8d8e0');
  const fs = new Float32Array(fishG.attributes.position.count);
  for (let k = 0; k < fs.length; k++) fs[k] = Math.max(0, -fishG.attributes.position.getX(k)) * 1.2;
  fishG.setAttribute('sway', new THREE.BufferAttribute(fs, 1));
  const fish = new THREE.InstancedMesh(fishG, uwMaterial(U, {}, true), 36);
  const fishSeed = Array.from({ length: 36 }, () => [r() * 6.28, 1.5 + r() * 2.5, -3 - r() * 4, 0.3 + r() * 0.4]);
  scene.add(fish);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();

  // light shafts under the lamps
  // soft gradient beams: bright near the surface, fading with depth and toward the edges
  const shaftMat = new THREE.ShaderMaterial({
    uniforms: { time: U.uwTime }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
    fragmentShader: `uniform float time; varying vec2 vUv;
      void main(){ float edge = 1. - abs(vUv.x - .5) * 2.; float a = pow(max(edge, 0.), 2.5) * pow(vUv.y, 1.6);
        a *= 0.75 + 0.25 * sin(vUv.x * 9. + time * 0.8);
        gl_FragColor = vec4(vec3(0.7, 1., 0.85) * a * 0.22, 1.); }`,
  });
  for (const x of [-4.5, -1.5, 1.5]) {
    const g = new THREE.PlaneGeometry(1, 14, 1, 1);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) p.setX(i, p.getX(i) * (p.getY(i) > 0 ? 2.2 : 7));   // narrow at the top, wide below
    const s = new THREE.Mesh(g.translate(0, -7, 0), shaftMat);
    s.position.set(x, 0, -2);
    scene.add(s);
  }

  // distant Bang Saen shore lights on the horizon
  const dots = [];
  for (let i = 0; i < 60; i++) dots.push(paint(new THREE.SphereGeometry(0.25, 6, 4).translate(-120 + r() * 70, 0.4 + r() * 1.2, -220 - r() * 30), r() < 0.7 ? '#ffd9a0' : '#ffffff'));
  scene.add(new THREE.Mesh(mergeSway(dots), new THREE.MeshBasicMaterial({ vertexColors: true })));

  function update(time) {
    U.uwTime.value = time;
    boat.position.y = Math.sin(time * 0.9) * 0.06;
    boat.rotation.z = Math.sin(time * 0.7) * 0.015;
    fishSeed.forEach(([a, rad, z, sp], i) => {
      const t = a + time * sp;
      const x = -1.5 + Math.cos(t) * (3 + rad), y = -3 - rad + Math.sin(t * 2) * 0.4;
      e.set(0, Math.sin(t) > 0 ? Math.PI : 0, 0);
      fish.setMatrixAt(i, m4.compose(new THREE.Vector3(x, y, z), q.setFromEuler(e), new THREE.Vector3(1, 1, 1)));
    });
    fish.instanceMatrix.needsUpdate = true;
  }
  return { scene, U, boat, lampLight, update, material: () => uwMaterial(U) };
}

// merge that keeps the optional `sway` attribute
function mergeSway(list) {
  const pos = [], nrm = [], col = [], sw = [];
  for (const g of list) {
    const n = g.index ? g.toNonIndexed() : g;
    if (!n.attributes.normal) n.computeVertexNormals();
    pos.push(...n.attributes.position.array); nrm.push(...n.attributes.normal.array); col.push(...n.attributes.color.array);
    if (n.attributes.sway) sw.push(...n.attributes.sway.array); else sw.push(...new Float32Array(n.attributes.position.count));
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setAttribute('sway', new THREE.Float32BufferAttribute(sw, 1));
  return g;
}
