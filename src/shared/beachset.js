// Pieces of beach the sand-court mini-games share (football/scene.js, volley/scene.js):
// flat-coloured geometry, the sea lapping at the sand, and a crowd of onlookers.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { bakePerson, personMaterial } from '../town/people/body.js';
import { PALETTE } from './palette.js';

/** A geometry in one flat colour (vertex colours, no UVs), ready to merge. */
export function paint(g, hex) {
  g = g.index ? g.toNonIndexed() : g;
  if (g.attributes.uv) g.deleteAttribute('uv');
  const c = new THREE.Color(hex), n = g.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) c.toArray(a, i * 3);
  g.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return g;
}

/**
 * Water for a flat plane: the sea lies on the low side of `axis` ('x' or 'z'), its edge at `edge`
 * (world units) running up and down the sand, low waves rolling in, foam at the edge.
 * Set uniforms.time each frame.
 */
export function seaMaterial(axis, edge) {
  return new THREE.ShaderMaterial({
    transparent: true,
    uniforms: {
      time: { value: 0 }, edge: { value: edge }, ax: { value: axis === 'x' ? 1 : 0 },
      shallow: { value: new THREE.Color('#7fd8c8') }, mid: { value: new THREE.Color(PALETTE.seaShallow) }, deep: { value: new THREE.Color(PALETTE.seaMid) },
      haze: { value: new THREE.Color(PALETTE.haze) },
    },
    vertexShader: /* glsl */`
      varying vec3 vW;
      void main() { vec4 wp = modelMatrix * vec4(position, 1.0); vW = wp.xyz; gl_Position = projectionMatrix * viewMatrix * wp; }`,
    fragmentShader: /* glsl */`
      uniform float time, edge, ax; uniform vec3 shallow, mid, deep, haze;
      varying vec3 vW;
      float h2(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
      float n2(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(h2(i), h2(i + vec2(1, 0)), f.x), mix(h2(i + vec2(0, 1)), h2(i + vec2(1, 1)), f.x), f.y); }
      void main() {
        vec2 q = vec2(mix(vW.z, vW.x, ax), mix(vW.x, vW.z, ax));                                         // (toward the land, along the shore)
        float wash = sin(time * 0.9 + q.y * 0.33) * 0.55 + sin(time * 0.55 + q.y * 0.12 + 1.7) * 0.45;   // the water's edge runs up and down the sand
        float d = edge - q.x + wash * 0.7;                                                               // metres out from the edge
        if (d < 0.0) discard;
        vec3 col = mix(shallow, mid, smoothstep(0.0, 16.0, d));
        col = mix(col, deep, smoothstep(16.0, 90.0, d));
        col *= 0.9 + 0.2 * n2(q * vec2(0.45, 1.5) + vec2(time * 0.4, 0.0));
        float roll = sin(d * 0.5 + time * 1.1 + n2(vec2(q.y * 0.15, 3.0)) * 2.5);                         // low waves rolling in along the shore
        float foam = smoothstep(1.3, 0.0, d) * (0.55 + 0.45 * n2(q * 3.0 + time * 0.6))
          + smoothstep(0.86, 1.0, roll) * smoothstep(1.5, 5.0, d) * smoothstep(45.0, 12.0, d) * n2(q * 2.2) * 0.8;
        col = mix(col, vec3(0.97), clamp(foam, 0.0, 0.9));
        float fogF = 1.0 - exp(-pow(length(vW - cameraPosition) * 0.006, 2.0));
        gl_FragColor = vec4(mix(col, haze, fogF), mix(0.6, 0.95, smoothstep(0.0, 3.0, d)));
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
}

/** People watching (one merged, static mesh). spots: [{ x, z, yaw }]; r: rng. */
export function watcherMesh(spots, r) {
  const ADULT = { scale: 1.3, headScale: 0.86, print: 'none' }, pick = a => a[Math.floor(r() * a.length)];
  const shirts = ['#f4f1e8', '#f0b43a', '#e8958a', '#7fc4e8', '#9ad0b0', '#e2553f', '#c9b0e0'], skins = ['#c68f66', '#b8835c', '#d9a57c', '#a8764f'];
  const poses = [
    b => { b.armL.rotation.set(0, 0, 2.7); b.armR.rotation.set(0, 0, -2.7); },                       // both arms up
    b => { b.armR.rotation.set(-2.6, 0, -0.3); b.foreR.rotation.x = -0.4; },                           // one arm up
    b => { b.armL.rotation.set(-0.5, 0, 0.5); b.foreL.rotation.x = -1.9; b.armR.rotation.set(-0.5, 0, -0.5); b.foreR.rotation.x = -1.9; },   // hands together
    () => {},
  ];
  const geos = spots.map(s => {
    const look = { ...(r() < 0.4 ? { scale: 0.95 + r() * 0.1 } : ADULT), skin: pick(skins), shirt: pick(shirts), bottomColor: pick(['#34507a', '#5a4a3a', '#3a3a3a', '#f4f1e8']),
      hairStyle: pick(['short', 'long', 'bun', 'short']), hat: pick(['none', 'none', 'cap', 'straw', 'bucket']), bottom: pick(['shorts', 'shorts', 'pants', 'skirt']) };
    return bakePerson(look, pick(poses), 0.5).rotateY(s.yaw).translate(s.x, 0, s.z);
  });
  const mesh = new THREE.Mesh(mergeGeometries(geos), personMaterial());
  mesh.castShadow = mesh.receiveShadow = true;
  return mesh;
}
