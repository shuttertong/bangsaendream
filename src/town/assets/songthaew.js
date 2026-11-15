// Bang Saen red songthaew (รถแดง): a red pickup (a shaped cab with a sloping windscreen, rounded
// body, wheels with rims and arches, lights, mirrors, painted stripes) with a stainless-steel frame
// and roof over the bed, padded benches facing each other, rolled rain curtains, a rear step, sign
// boards, number plates and painted route lettering. Built once as a template (front = +z) and cloned per truck.
import * as THREE from 'three';
import { Kit } from './kit.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { bakePerson, personMaterial } from '../people/body.js';

export const TRUCK = {
  red: '#d8392f', darkRed: '#a8281f', steel: '#d4d8dc', tyre: '#262626', glass: '#3a4a56',
  stripe: '#f2c230', vinyl: '#7a3a32', curtain: '#d9d2bc',
  // the kind uncle at the wheel (right-hand drive: the driver's side is −x), one look per truck design
  driver: { x: -0.4, hip: 1.01, z: 1.2, detail: 0.5, looks: [
    { scale: 1.32, headScale: 0.9, skin: '#b8835c', hair: '#8a8680', hairStyle: 'short', shirt: '#8fb8d8', outfit: 'work', towel: '#f4f1e8', towelStripe: '#d8443a', hat: 'none', smile: 'grin', brow: 0.04, belly: 0.3, print: 'none' },
    { scale: 1.32, headScale: 0.9, skin: '#a8764f', hair: '#4a4440', hairStyle: 'short', shirt: '#e8c46a', outfit: 'hawaii', hat: 'cap', hatColor: '#f4f1e8', hatBand: '#d8392f', smile: 'grin', brow: 0.04, belly: 0.35, glasses: true, print: 'none' }] },
  seat: new THREE.Vector3(0.5, 1.22, -1.1),     // where a passenger sits (right bench)
  rear: new THREE.Vector3(0, 0, -2.9),          // hop-on point behind the step
  length: 5.3, width: 1.8,
};

const col = hex => new THREE.Color(hex);
const DECAL = { w: 512, h: 384, side: [0, 0, 512, 160], sign: [0, 160, 512, 96], plate: [0, 256, 256, 96], glass: [264, 264, 240, 80] };   // regions of the lettering canvas (x, y, w, h)

/** Canvas with the painted lettering (no brands, route names only): the sides, the roof signs, the number plates. */
function decal(route) {
  const cv = document.createElement('canvas');
  cv.width = DECAL.w; cv.height = DECAL.h;
  const g = cv.getContext('2d');
  g.fillStyle = '#f4efe6';
  g.textAlign = 'center';
  g.font = '600 44px Kanit, Sarabun, sans-serif';
  g.fillText('ชลบุรี – หนองมน – บางแสน', 256, 62);
  g.font = '600 52px Kanit, Sarabun, sans-serif';
  g.fillText(`สาย ${route}`, 256, 132);
  g.fillStyle = '#3a2a1a';                                                    // roof sign (the board itself is yellow geometry)
  g.font = '700 62px Kanit, Sarabun, sans-serif';
  g.fillText(`บางแสน · ${route}`, 256, 230);
  g.fillStyle = '#f6f4ee'; g.fillRect(8, 262, 240, 84);                       // number plate (made up)
  g.strokeStyle = '#2a2a2a'; g.lineWidth = 5; g.strokeRect(11, 265, 234, 78);
  g.fillStyle = '#2a2a2a'; g.font = '700 44px Kanit, Sarabun, sans-serif';
  g.fillText(`${route}–${1000 + route * 37 % 9000}`, 128, 310);
  g.font = '600 20px Kanit, Sarabun, sans-serif';
  g.fillText('บางแสน', 128, 336);
  const [gx, gy, gw, gh] = DECAL.glass, sheen = g.createLinearGradient(gx, gy, gx + gw, gy + gh);   // clear glass: a faint tint with a streak of reflected sky
  sheen.addColorStop(0, 'rgba(205,228,240,0.16)'); sheen.addColorStop(0.42, 'rgba(205,228,240,0.1)'); sheen.addColorStop(0.5, 'rgba(255,255,255,0.42)');
  sheen.addColorStop(0.58, 'rgba(205,228,240,0.1)'); sheen.addColorStop(1, 'rgba(190,215,232,0.2)');
  g.fillStyle = sheen; g.fillRect(gx - 8, gy - 8, gw + 16, gh + 16);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}
/** A lettering plane (w × h) showing one region of the canvas, turned `ry` and placed at (x, y, z). */
function label([rx, ry_, rw, rh], w, h, x, y, z, ry) {
  const g = new THREE.PlaneGeometry(w, h), uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (rx + uv.getX(i) * rw) / DECAL.w, 1 - (ry_ + (1 - uv.getY(i)) * rh) / DECAL.h);
  return g.rotateY(ry).translate(x, y, z);
}

let driverMat = null;
/** The driver, frozen at the wheel: seated, both hands forward, glancing out of his open window with a smile. */
function driver(look) {
  const D = TRUCK.driver;
  const g = bakePerson(look, B => {
    for (const s of ['L', 'R']) { B[`arm${s}`].rotation.set(-1.05, 0, s === 'L' ? 0.16 : -0.16); B[`fore${s}`].rotation.x = -0.55; B[`leg${s}`].rotation.x = -1.4; B[`shin${s}`].rotation.x = 1.3; }
    B.head.rotation.set(0.04, -0.3, 0); B.spine.rotation.x = 0.06;
  }, D.detail);
  g.translate(D.x, D.hip - 0.62 * look.scale, D.z);
  const m = new THREE.Mesh(g, driverMat || (driverMat = personMaterial()));
  m.name = 'driver';
  return m;
}

/** Template group: body meshes per material + one lettering mesh + the driver. */
export function songthaewTemplate({ route = 42, rack = false, driverLook = 0 } = {}) {
  // built in the middle of one map chunk so the kit keeps it in one mesh per material
  const C = 192;
  const kit = new Kit();
  const f = kit.frame(C, 0, C, 0);
  const red = col(TRUCK.red), dark = col(TRUCK.darkRed), steel = col(TRUCK.steel), tyre = col(TRUCK.tyre), glass = col(TRUCK.glass);
  const black = col('#2a2a2a'), grey = col('#4a4a4a'), yellow = col(TRUCK.stripe), vinyl = col(TRUCK.vinyl), lamp = col('#f6f2dc'), amber = col('#f0a030');
  const E = new THREE.Euler(), Q = new THREE.Quaternion(), S = new THREE.Vector3(1, 1, 1);
  /** Add a geometry at (x, y, z) in the truck's frame, turned by (rx, ry, rz). */
  const put = (mat, geo, x, y, z, color, rx = 0, ry = 0, rz = 0) => {
    const p = f.P(x, y, z);
    kit.add(mat, geo, new THREE.Matrix4().compose(new THREE.Vector3(p.x, p.y, p.z), Q.setFromEuler(E.set(rx, ry, rz)), S), color);
  };
  const rb = (w, h, d, r = 0.04) => new RoundedBoxGeometry(w, h, d, 3, Math.min(r, w / 2 - 1e-3, h / 2 - 1e-3, d / 2 - 1e-3));
  const disc = (r, w, n = 16) => new THREE.CylinderGeometry(r, r, w, n).rotateZ(Math.PI / 2);   // axis across the truck

  // wheels: a tyre with rounded shoulders, a steel rim with lug nuts, an arch over each
  const tyreG = new THREE.LatheGeometry([[0.2, -0.12], [0.33, -0.12], [0.36, -0.085], [0.36, 0.085], [0.33, 0.12], [0.2, 0.12]].map(([r, y]) => new THREE.Vector2(r, y)), 22).rotateZ(Math.PI / 2);
  for (const z of [1.55, -1.35]) for (const s of [-1, 1]) {
    put('wall', tyreG, s * 0.8, 0.36, z, tyre);
    put('metal', disc(0.215, 0.25, 18), s * 0.8, 0.36, z, steel);
    put('metal', disc(0.07, 0.04, 10), s * 0.935, 0.36, z, grey);
    for (let k = 0; k < 5; k++) { const a = (k / 5) * Math.PI * 2; put('wall', disc(0.022, 0.02, 6), s * 0.93, 0.36 + Math.sin(a) * 0.13, z + Math.cos(a) * 0.13, grey); }
    put('wall', new THREE.TorusGeometry(0.43, 0.045, 6, 16, Math.PI).rotateY(Math.PI / 2), s * 0.875, 0.38, z, dark);       // wheel arch
    put('wall', rb(0.3, 0.3, 0.025, 0.01), s * 0.8, 0.36, z - 0.5, black);                                                 // mud flap
  }
  // body: the bed's lower half; the cab and bonnet as one shaped piece (a sloping windscreen, rounded edges)
  put('wall', rb(1.78, 0.62, 3.5, 0.07), 0, 0.8, -0.82, red);
  put('wall', rb(1.72, 0.08, 4.9, 0.03), 0, 0.49, -0.1, dark);                                                             // sill shadow line
  // (below the windows the cab is solid; above, pillars and a roof round an open cabin, so the driver shows)
  const side = new THREE.Shape([[0.84, 0.52], [2.76, 0.52], [2.86, 0.62], [2.86, 1.02], [2.78, 1.1], [2.2, 1.2], [0.84, 1.2]].map(([z, y]) => new THREE.Vector2(z, y)));
  const cab = new THREE.ExtrudeGeometry(side, { depth: 1.6, bevelEnabled: true, bevelSize: 0.06, bevelThickness: 0.06, bevelSegments: 3, curveSegments: 4 }).rotateY(-Math.PI / 2).translate(0.8, 0, 0);
  put('wall', cab, 0, 0, 0, red);
  put('wall', rb(1.72, 0.08, 0.98, 0.035), 0, 1.9, 1.27, red);                                                             // cab roof
  put('wall', rb(1.72, 0.74, 0.07, 0.03), 0, 1.56, 0.84, red); put('glass', rb(1.3, 0.36, 0.03, 0.01), 0, 1.6, 0.8, glass);   // rear wall and its window
  put('wall', rb(1.5, 0.13, 0.34, 0.04), 0, 1.29, 2.0, black);                                                             // dashboard
  put('wall', new THREE.TorusGeometry(0.16, 0.022, 6, 16), TRUCK.driver.x, 1.42, 1.74, black, -0.5);   // steering wheel
  for (const s of [-1, 1]) { put('wall', rb(0.5, 0.62, 0.12, 0.05), s * 0.4, 1.5, 0.98, vinyl); put('wall', rb(0.24, 0.16, 0.1, 0.04), s * 0.4, 1.86 - 0.08, 0.98, vinyl); }   // seat backs, head rests
  for (const s of [-1, 1]) {
    put('wall', rb(0.075, 0.86, 0.075, 0.025), s * 0.82, 1.53, 1.975, red, -0.63);                                         // windscreen pillar
    put('glass', rb(0.02, 0.05, 0.74, 0.008), s * 0.85, 1.275, 1.3, glass);                                                // the door window, wound right down: just its top edge shows
    put('wall', rb(0.02, 1.1, 0.015, 0.005), s * 0.866, 1.2, 0.9, dark); put('wall', rb(0.02, 0.62, 0.015, 0.005), s * 0.866, 0.95, 1.9, dark);   // door seams
    put('metal', rb(0.03, 0.035, 0.14, 0.01), s * 0.872, 1.2, 1.05, steel);                                                // door handle
    put('wall', rb(0.1, 0.03, 0.03, 0.01), s * 0.92, 1.42, 1.95, black); put('wall', rb(0.05, 0.2, 0.13, 0.03), s * 0.99, 1.47, 1.95, black);   // wing mirror
    put('metal', rb(0.52, 0.014, 0.02, 0.004), s * 0.36, 1.27, 2.185, black, 0, 0, s * 0.12);                                    // wiper
    put('glass', rb(0.34, 0.17, 0.06, 0.03), s * 0.6, 0.9, 2.925, lamp); put('glass', rb(0.12, 0.15, 0.06, 0.03), s * 0.8, 0.9, 2.915, amber);   // headlight, indicator
    put('glass', disc(0.06, 0.04, 12).rotateY(Math.PI / 2), s * 0.62, 0.57, 2.97, lamp);                                   // fog light
    // painted stripes along the side: yellow, then a thin white one
    put('wall', rb(0.012, 0.075, 3.44, 0.004), s * 0.892, 0.62, -0.82, yellow); put('wall', rb(0.012, 0.075, 1.86, 0.004), s * 0.862, 0.62, 1.85, yellow);
    put('wall', rb(0.012, 0.025, 3.44, 0.004), s * 0.892, 0.69, -0.82, lamp); put('wall', rb(0.012, 0.025, 1.86, 0.004), s * 0.862, 0.69, 1.85, lamp);
  }
  put('wall', rb(1.16, 0.2, 0.04, 0.015), 0, 0.87, 2.925, black);                                                          // grille, with bright bars
  for (const y of [0.82, 0.87, 0.92]) put('metal', rb(1.1, 0.018, 0.02, 0.006), 0, y, 2.95, steel);
  put('metal', rb(1.84, 0.2, 0.18, 0.06), 0, 0.57, 2.88, grey);                                                            // bumpers
  put('metal', rb(1.84, 0.16, 0.14, 0.05), 0, 0.55, -2.6, grey);
  for (const s of [-1, 1]) { put('glass', disc(0.07, 0.04, 14).rotateY(Math.PI / 2), s * 0.78, 0.99, -2.575, col('#e0302a')); put('glass', disc(0.05, 0.04, 12).rotateY(Math.PI / 2), s * 0.78, 0.84, -2.575, amber); }   // tail lights
  put('metal', new THREE.CylinderGeometry(0.03, 0.03, 0.4, 8).rotateX(Math.PI / 2), -0.55, 0.36, -2.5, grey);              // exhaust
  // a marigold garland hanging in the windscreen, for luck
  put('wall', new THREE.TorusGeometry(0.06, 0.02, 6, 14), 0.34, 1.7, 1.86, yellow, -0.63); put('wall', new THREE.SphereGeometry(0.026, 8, 6), 0.34, 1.62, 1.9, lamp);
  // bed: floor, side walls with a steel top rail, padded benches facing each other with back rests
  put('wall', rb(1.7, 0.06, 3.3, 0.01), 0, 1.1, -0.85, grey);
  for (const s of [-1, 1]) {
    put('wall', rb(0.07, 0.42, 3.3, 0.02), s * 0.86, 1.32, -0.85, red);
    put('wall', rb(0.4, 0.1, 2.9, 0.04), s * 0.58, 1.19, -0.95, vinyl);                                                    // bench cushion
    put('wall', rb(0.07, 0.3, 2.9, 0.03), s * 0.79, 1.44, -0.95, vinyl);                                                   // back rest
    put('wall', rb(0.06, 0.3, 2.8, 0.01), s * 0.58, 1.0, -0.95, grey);                                                     // bench leg
    put('wall', new THREE.CylinderGeometry(0.055, 0.055, 3.25, 10).rotateX(Math.PI / 2), s * 0.93, 2.33, -0.8, col(TRUCK.curtain));   // rain curtain, rolled up
    f.rod('metal', [s * 0.32, 2.3, 0.75], [s * 0.32, 2.3, -2.4], 0.018, steel);                                            // grab rail under the roof
  }
  // stainless frame: posts, window rails, a roof with a red edge, sign boards front and back
  for (const z of [0.85, -0.25, -1.35, -2.45]) for (const s of [-1, 1]) f.rod('metal', [s * 0.88, 1.5, z], [s * 0.88, 2.42, z], 0.03, steel);
  for (const s of [-1, 1]) for (const y of [1.95, 1.55]) f.rod('metal', [s * 0.9, y, 0.85], [s * 0.9, y, -2.45], 0.022, steel);
  put('metal', rb(2.0, 0.1, 4.2, 0.05), 0, 2.47, -0.5, steel);
  put('wall', rb(2.03, 0.045, 4.23, 0.02), 0, 2.425, -0.5, dark);
  put('wall', rb(1.9, 0.03, 4.0, 0.01), 0, 2.4, -0.5, col('#c9cdd0'));                                                     // roof lining
  put('wall', rb(1.34, 0.27, 0.06, 0.02), 0, 2.66, 1.34, yellow); put('wall', rb(1.34, 0.25, 0.05, 0.02), 0, 2.27, -2.53, yellow);
  // rear step with grab poles
  put('metal', rb(1.5, 0.06, 0.36, 0.02), 0, 0.62, -2.76, steel);
  for (const s of [-1, 1]) { f.rod('metal', [s * 0.62, 0.62, -2.64], [s * 0.62, 2.42, -2.5], 0.022, steel); f.rod('metal', [s * 0.5, 0.62, -2.66], [s * 0.5, 0.5, -2.56], 0.02, grey); }
  f.rod('metal', [-0.62, 2.0, -2.5], [0.62, 2.0, -2.5], 0.02, steel);
  if (rack) {                                                                 // roof rack (some trucks)
    for (const s of [-1, 1]) f.rod('metal', [s * 0.8, 2.66, 1.0], [s * 0.8, 2.66, -2.3], 0.022, steel);
    for (let z = 1.0; z >= -2.3; z -= 0.66) f.rod('metal', [-0.8, 2.66, z], [0.8, 2.66, z], 0.018, steel);
    for (const s of [-1, 1]) for (const z of [1.0, -2.3]) f.rod('metal', [s * 0.8, 2.52, z], [s * 0.8, 2.66, z], 0.018, steel);
  }
  const group = kit.build();
  for (const m of group.children) m.geometry.translate(-C, 0, -C);
  // lettering: both sides, the two sign boards and the plates, all in one mesh (one draw call)
  const dm = new THREE.MeshLambertMaterial({ map: decal(route), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 });
  const screen = label(DECAL.glass, 1.52, 0.8, 0, 0, 0, 0).rotateX(-0.63).translate(0, 1.57, 2.0);                          // the clear windscreen (drawn with the lettering: no extra draw call)
  const labels = [...[-1, 1].map(s => label(DECAL.side, 2.1, 0.656, s * 0.896, 1.04, -0.9, s * Math.PI / 2)),
    label(DECAL.sign, 1.26, 0.236, 0, 2.66, 1.372, 0), label(DECAL.sign, 1.26, 0.236, 0, 2.27, -2.557, Math.PI),
    label(DECAL.plate, 0.5, 0.19, 0, 0.58, 2.972, 0), label(DECAL.plate, 0.5, 0.19, 0, 0.82, -2.572, Math.PI), screen];
  const letters = new THREE.Mesh(mergeGeometries(labels), dm);
  group.add(letters, driver(TRUCK.driver.looks[driverLook % TRUCK.driver.looks.length]));
  group.traverse(o => { o.matrixAutoUpdate = true; o.castShadow = o.receiveShadow = !!o.geometry; });
  letters.castShadow = false;                                                 // (glass and paint cast no shadow)
  return group;
}
