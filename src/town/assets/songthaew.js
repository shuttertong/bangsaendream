// Bang Saen red songthaew (รถแดง): a red pickup with a stainless-steel frame and roof
// over the bed, two benches facing each other, a rear step and ladder, and painted
// route lettering. Built once as a template (front = +z) and cloned per truck.
import * as THREE from 'three';
import { Kit } from './kit.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const TRUCK = {
  red: '#d8392f', darkRed: '#a8281f', steel: '#d4d8dc', tyre: '#262626', glass: '#3a4a56',
  seat: new THREE.Vector3(0.5, 1.22, -1.1),     // where a passenger sits (right bench)
  rear: new THREE.Vector3(0, 0, -2.9),          // hop-on point behind the step
  length: 5.3, width: 1.8,
};

const col = hex => new THREE.Color(hex);

/** Canvas decal with the painted route text (no brands, route names only). */
function decal(route) {
  const cv = document.createElement('canvas');
  cv.width = 512; cv.height = 160;
  const g = cv.getContext('2d');
  g.fillStyle = '#f4efe6';
  g.textAlign = 'center';
  g.font = '600 44px Kanit, Sarabun, sans-serif';
  g.fillText('ชลบุรี – หนองมน – บางแสน', 256, 62);
  g.font = '600 52px Kanit, Sarabun, sans-serif';
  g.fillText(`สาย ${route}`, 256, 132);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Template group: body meshes per material + two lettering decals. */
export function songthaewTemplate({ route = 42, rack = false } = {}) {
  // built in the middle of one map chunk so the kit keeps it in one mesh per material
  const C = 192;
  const kit = new Kit();
  const f = kit.frame(C, 0, C, 0);
  const red = col(TRUCK.red), dark = col(TRUCK.darkRed), steel = col(TRUCK.steel), tyre = col(TRUCK.tyre), glass = col(TRUCK.glass);

  // wheels + hubs
  // round wheels (the kit's rods only have 8 sides)
  const wheel = new THREE.CylinderGeometry(0.36, 0.36, 0.22, 18).rotateZ(Math.PI / 2);
  const hub = new THREE.CylinderGeometry(0.2, 0.2, 0.04, 14).rotateZ(Math.PI / 2);
  for (const z of [1.55, -1.35]) for (const s of [-1, 1]) {
    kit.add('wall', wheel, new THREE.Matrix4().setPosition(f.P(s * 0.83, 0.36, z)), tyre);
    kit.add('metal', hub, new THREE.Matrix4().setPosition(f.P(s * 0.95, 0.36, z)), steel);
  }
  // body: lower body, cab, hood, bumpers, lights
  f.box('wall', 0, 0.78, -0.1, 1.76, 0.6, 4.9, red);
  f.box('wall', 0, 0.5, -0.1, 1.7, 0.08, 4.9, dark);                          // sill shadow line
  f.box('wall', 0, 1.42, 1.45, 1.72, 0.78, 1.25, red);                       // cab
  f.box('glass', 0, 1.48, 2.08, 1.5, 0.55, 0.05, glass);                     // windshield
  for (const s of [-1, 1]) f.box('glass', s * 0.87, 1.5, 1.45, 0.04, 0.45, 1.0, glass);
  f.box('wall', 0, 1.12, 2.45, 1.72, 0.28, 0.75, red);                       // hood
  f.box('wall', 0, 0.85, 2.83, 1.6, 0.22, 0.05, col('#2a2a2a'));             // grille
  f.box('metal', 0, 0.58, 2.86, 1.8, 0.18, 0.12, col('#4a4a4a'));            // bumper
  for (const s of [-1, 1]) f.box('glass', s * 0.62, 0.98, 2.84, 0.32, 0.14, 0.03, col('#f4f1e0'));   // headlights
  f.box('metal', 0, 0.55, -2.58, 1.8, 0.15, 0.12, col('#4a4a4a'));           // rear bumper
  for (const s of [-1, 1]) f.box('wall', s * 0.78, 0.95, -2.56, 0.16, 0.26, 0.03, col('#e0302a'));  // tail lights
  // bed: side walls, floor, benches facing each other
  f.box('wall', 0, 1.1, -0.85, 1.7, 0.06, 3.3, col('#5a5a5a'));
  for (const s of [-1, 1]) {
    f.box('wall', s * 0.86, 1.32, -0.85, 0.06, 0.4, 3.3, red);
    f.box('wall', s * 0.58, 1.2, -0.95, 0.38, 0.08, 2.9, col('#8a6a4a'));     // bench seat
    f.box('wall', s * 0.58, 1.02, -0.95, 0.06, 0.3, 2.8, col('#6a6a6a'));     // bench leg
  }
  // stainless frame: posts, window rail, roof
  for (const z of [0.85, -0.25, -1.35, -2.45]) for (const s of [-1, 1]) f.rod('metal', [s * 0.88, 1.5, z], [s * 0.88, 2.42, z], 0.03, steel);
  for (const s of [-1, 1]) {
    f.rod('metal', [s * 0.9, 1.95, 0.85], [s * 0.9, 1.95, -2.45], 0.022, steel);
    f.rod('metal', [s * 0.9, 1.55, 0.85], [s * 0.9, 1.55, -2.45], 0.022, steel);
  }
  f.box('metal', 0, 2.45, -0.55, 1.98, 0.06, 4.1, steel);                     // roof over bed + cab
  f.box('wall', 0, 2.4, -0.55, 1.9, 0.04, 4.0, col('#b8bcc0'));              // roof underside
  f.box('metal', 0, 2.18, 1.6, 1.9, 0.05, 0.62, steel, 0);                    // front overhang lip
  // rear step + ladder
  f.box('metal', 0, 0.62, -2.72, 1.5, 0.05, 0.34, steel);
  for (const s of [-1, 1]) f.rod('metal', [s * 0.62, 0.62, -2.62], [s * 0.62, 2.42, -2.5], 0.022, steel);
  f.rod('metal', [-0.62, 2.0, -2.5], [0.62, 2.0, -2.5], 0.02, steel);
  if (rack) {                                                                 // roof rack (some trucks)
    for (const s of [-1, 1]) f.rod('metal', [s * 0.8, 2.62, 1.2], [s * 0.8, 2.62, -2.3], 0.022, steel);
    for (let z = 1.2; z >= -2.3; z -= 0.7) f.rod('metal', [-0.8, 2.62, z], [0.8, 2.62, z], 0.018, steel);
  }
  const group = kit.build();
  for (const m of group.children) m.geometry.translate(-C, 0, -C);
  // lettering on both sides of the lower body
  const tex = decal(route);
  const dm = new THREE.MeshLambertMaterial({ map: tex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 });
  // both sides in one mesh (one draw call)
  const sides = [-1, 1].map(s => new THREE.PlaneGeometry(2.4, 0.75).rotateY(s * Math.PI / 2).translate(s * 0.885, 0.82, -0.9));
  group.add(new THREE.Mesh(mergeGeometries(sides), dm));
  group.traverse(o => { o.matrixAutoUpdate = true; o.castShadow = o.receiveShadow = !!o.geometry; });
  return group;
}
