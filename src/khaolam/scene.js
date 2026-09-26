// Grandma's khao lam stall in front of her house, seen from the kid's chopping board: the
// board with the tube up close, the sales table with a tray of finished tubes, Grandma at
// the table, the roasting line of bamboo over burning coconut husks (smoke, flames, sun
// shafts) on the pavement beside it, customers on the pavement and shophouses across the street.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Kit } from '../town/assets/kit.js';
import { shophouseRow } from '../town/assets/shophouse.js';
import { paintedMaterial } from '../world/materials.js';
import { createSky } from '../world/sky.js';
import { buildPerson } from '../town/people/body.js';
import { ROSTER } from '../town/people/roster.js';
import { PALETTE } from '../shared/palette.js';
import { rng } from '../core/rng.js';
import { t } from '../shared/i18n.js';

export const BOARD = new THREE.Vector3(0, 0.857, 0.85);     // centre of the tube on the board (on the sales table)
export const SLOTS = [-0.95, 0, 0.95].map(x => new THREE.Vector3(x, 0, 2.3));
export const LANE = 3.7;
const TRAY = { x: 0.78, y: 0.8, z: 1.0, cols: 5, rows: 2 };      // +x is screen-left from the kid's side
const ROAST = { a: [1.45, 1.5], b: [3.3, 2.5] };                   // x, z of the roasting line's ends

function paint(g, hex) {
  g = g.index ? g.toNonIndexed() : g;
  if (g.attributes.uv) g.deleteAttribute('uv');
  const c = new THREE.Color(hex), n = g.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) c.toArray(a, i * 3);
  g.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return g;
}

function signTexture() {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 160;
  const g = c.getContext('2d');
  g.fillStyle = '#f4e9c8'; g.fillRect(0, 0, 512, 160);
  g.strokeStyle = '#b8583a'; g.lineWidth = 10; g.strokeRect(5, 5, 502, 150);
  g.fillStyle = '#7a2e1c'; g.textAlign = 'center';
  g.font = '600 64px Kanit, sans-serif'; g.fillText(t('khaolamSign'), 256, 82);
  g.font = '400 30px Kanit, sans-serif'; g.fillText(t('khaolamSignSub'), 256, 130);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function buildScene() {
  const scene = new THREE.Scene();
  const r = rng(77);
  scene.add(createSky());
  scene.fog = new THREE.FogExp2(PALETTE.haze, 0.01);
  const sun = new THREE.DirectionalLight('#ffd9a8', 2.9);          // late afternoon, from the right
  sun.position.set(12, 9, 6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.bias = -0.0004;
  Object.assign(sun.shadow.camera, { left: -6, right: 6, top: 6, bottom: -6, near: 1, far: 40 });
  scene.add(sun, new THREE.HemisphereLight(PALETTE.hemiSky, PALETTE.hemiGround, 1.1));

  // ground: packed earth yard, the pavement, the street
  const kit = new Kit(), f = kit.frame(0, 0, 0, 0), col = h => new THREE.Color(h);
  f.box('wall', 0, -0.05, 0.6, 14, 0.1, 5, col('#b8a88a'));
  f.box('wall', 0, -0.04, 3.4, 40, 0.1, 1.2, col('#c7c0b2'));
  f.box('wall', 0, -0.06, 7.2, 40, 0.1, 6.4, col('#5d5d5a'));
  for (let x = -18; x < 18; x += 3) f.box('wall', x, 0, 7.2, 1.6, 0.01, 0.12, col('#e8e4d8'));   // centre line
  // sales table: the kid's chopping board in the middle, the tray to the (screen) left
  f.box('wall', -0.2, 0.74, 1.05, 2.6, 0.05, 0.8, col('#d8cfb8'));
  for (const x of [-1.45, 1.05]) for (const z of [0.7, 1.4]) f.box('wall', x, 0.37, z, 0.05, 0.74, 0.05, col('#8a8a86'));
  f.box('wall', TRAY.x, 0.775, TRAY.z, 0.6, 0.02, 0.5, col('#4a7a9a'));
  f.box('wall', BOARD.x, 0.7825, BOARD.z, 0.64, 0.035, 0.3, col('#b08a5a'));
  // bundles of khao lam in plastic bags at the right end of the table (for show)
  for (let i = 0; i < 5; i++) {
    const x = -1.1 - (i % 3) * 0.11, z = 1.1 + Math.floor(i / 3) * 0.14, h = 0.26 + r() * 0.05;
    kit.rod('wall', new THREE.Vector3(x, 0.77, z), new THREE.Vector3(x, 0.77 + h, z), 0.035, col('#d8c890'));
    kit.rod('wall', new THREE.Vector3(x, 0.77 + h, z), new THREE.Vector3(x, 0.77 + h + 0.05, z), 0.04, col('#e8eef2'));
  }
  // stall umbrella
  kit.rod('wall', new THREE.Vector3(1.05, 0, 1.3), new THREE.Vector3(1.05, 2.3, 1.3), 0.025, col('#d8d4c8'));
  // roasting line on the pavement beside the stall (screen-left): bamboo leaning on a rail
  // over burning coconut husks
  const along = k => new THREE.Vector3(ROAST.a[0] + (ROAST.b[0] - ROAST.a[0]) * k, 0, ROAST.a[1] + (ROAST.b[1] - ROAST.a[1]) * k);
  const railA = along(0).setY(0.55), railB = along(1).setY(0.55), back = new THREE.Vector3(0, 0, 0.22);
  kit.rod('wall', railA.clone().add(back), railB.clone().add(back), 0.02, col('#5a5a58'));
  for (const p of [railA, railB]) kit.rod('wall', p.clone().add(back).setY(0), p.clone().add(back).setY(0.58), 0.025, col('#5a5a58'));
  for (let i = 0; i < 16; i++) {
    const p = along(i / 15);
    const bot = p.clone().setY(0.02), top = p.clone().add(back).add(new THREE.Vector3(0, 0.62, 0.04));
    kit.rod('wall', bot, top, 0.042, col(r() < 0.5 ? '#3a2a1c' : '#5a4a2a'));
    kit.rod('wall', top, top.clone().add(new THREE.Vector3(0, 0.03, 0.01)), 0.043, col('#8a9a4a'));
  }
  for (let i = 0; i < 22; i++) {                                                   // coconut husks
    const p = along(r()).add(new THREE.Vector3(0, 0.06, -0.12 - r() * 0.25));
    kit.box('wall', p.x, p.y, p.z, 0.2, 0.12, 0.14, r() * 3, col(r() < 0.5 ? '#6a4a2a' : '#3a2a1c'));
  }
  // houses across the street
  shophouseRow(kit, r, { x: -2, y: 0, z: 17, ry: Math.PI, n: 5, floors: 2 });
  shophouseRow(kit, r, { x: 17, y: 0, z: 17, ry: Math.PI, n: 3, floors: 3 });
  scene.add(kit.build());

  const mat = paintedMaterial({ amp: 0.1, scale: 0.6 });
  const canopy = new THREE.Mesh(paint(new THREE.ConeGeometry(1.5, 0.5, 10, 1, true).translate(1.05, 2.3, 1.3), '#e8543a'), paintedMaterial({ amp: 0.1, scale: 0.6, side: THREE.DoubleSide }));
  canopy.castShadow = true;
  scene.add(canopy);

  // sign on two poles over the front of the table, readable from both sides
  const signMat = new THREE.MeshLambertMaterial({ map: signTexture() });
  // on a stand at the left end of the table, turned to catch both the street and the kid
  const sign = new THREE.Group();
  for (const [z, ry] of [[0.012, 0], [-0.012, Math.PI]]) {
    const s = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.28), signMat);
    s.position.set(0, 1.45, z); s.rotation.y = ry;
    sign.add(s);
  }
  sign.add(new THREE.Mesh(mergeGeometries([-0.4, 0.4].map(x => paint(new THREE.CylinderGeometry(0.015, 0.015, 1.4, 6).translate(x, 0.8, 0), '#8a8a86'))), mat));
  sign.position.set(-1.95, 0, 1.25); sign.rotation.y = 0.75;
  scene.add(sign);

  // tray of finished tubes (instanced; count = stock)
  const trayMesh = new THREE.InstancedMesh(mergeGeometries([
    paint(new THREE.CylinderGeometry(0.04, 0.04, 0.36, 12).rotateX(Math.PI / 2), '#e0cf8e'),
    paint(new THREE.CircleGeometry(0.038, 12).translate(0, 0, 0.181), '#ffffff'),
  ]), mat, TRAY.cols * TRAY.rows);
  trayMesh.count = 0; trayMesh.castShadow = true;
  trayMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(TRAY.cols * TRAY.rows * 3), 3);
  scene.add(trayMesh);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), one = new THREE.Vector3(1, 1, 1);
  /** stock: array of kinds (in order) → tubes on the tray. */
  function setTray(stock) {
    const n = Math.min(stock.length, TRAY.cols * TRAY.rows);
    for (let i = 0; i < n; i++) {
      const cx = i % TRAY.cols, row = Math.floor(i / TRAY.cols);
      m4.compose(new THREE.Vector3(TRAY.x - 0.4 + cx * 0.09 + row * 0.045, TRAY.y + 0.04 + row * 0.07, TRAY.z), q.identity(), one);
      trayMesh.setMatrixAt(i, m4);
      trayMesh.setColorAt(i, new THREE.Color(stock[i].rice).lerp(new THREE.Color('#ffffff'), 0.2));
    }
    trayMesh.count = n;
    trayMesh.instanceMatrix.needsUpdate = true;
    if (trayMesh.instanceColor) trayMesh.instanceColor.needsUpdate = true;
  }

  // Grandma at the table, half turned to the customers
  const grandma = buildPerson(ROSTER.find(p => p.id === 'grandma').look);
  grandma.mesh.position.set(-0.68, 0, 0.42);
  grandma.mesh.rotation.y = 0.35;
  scene.add(grandma.mesh);

  // fire: flickering flame sprites + glow, smoke puffs, sun shafts through the smoke
  const flameMat = new THREE.SpriteMaterial({ color: '#ffb04a', transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false });
  const flames = Array.from({ length: 10 }, (_, i) => {
    const s = new THREE.Sprite(flameMat.clone());
    const p = along((i + 0.5) / 10).add(new THREE.Vector3(0, 0, -0.1));
    s.userData = { x: p.x, z: p.z, ph: r() * 6 };
    scene.add(s); return s;
  });
  const glow = new THREE.PointLight('#ff9a40', 2.2, 4, 1.6);
  glow.position.copy(along(0.5)).add(new THREE.Vector3(0, 0.35, -0.3));
  scene.add(glow);
  const smokeMat = new THREE.SpriteMaterial({ color: '#efe6d6', transparent: true, opacity: 0.3, depthWrite: false });
  const smoke = Array.from({ length: 14 }, (_, i) => { const s = new THREE.Sprite(smokeMat.clone()); s.userData = { t: i / 14, p: along(r()) }; scene.add(s); return s; });
  const shaftMat = new THREE.MeshBasicMaterial({ color: '#fff0c8', transparent: true, opacity: 0.08, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  for (let i = 0; i < 4; i++) {
    const s = new THREE.Mesh(new THREE.PlaneGeometry(0.35 + r() * 0.3, 5), shaftMat);
    s.position.copy(along(0.2 + i * 0.22)).add(new THREE.Vector3(0.4, 1.6, 0.3));
    s.rotation.set(0, -0.5, 0.9);
    scene.add(s);
  }

  let serveT = 0;
  function update(t, dt) {
    for (const s of flames) {
      const u = s.userData, k = 0.5 + 0.5 * Math.sin(t * 9 + u.ph) * Math.sin(t * 5.3 + u.ph * 2);
      s.position.set(u.x, 0.16 + k * 0.08, u.z);
      s.scale.set(0.16 + k * 0.08, 0.26 + k * 0.2, 1);
      s.material.opacity = 0.55 + k * 0.4;
    }
    glow.intensity = 1.8 + Math.sin(t * 11) * 0.3 + Math.sin(t * 7.3) * 0.2;
    for (const s of smoke) {
      const k = (t * 0.12 + s.userData.t) % 1;
      const p = s.userData.p;
      s.position.set(p.x + Math.sin(k * 5 + s.userData.t * 9) * 0.2 + k * 0.5, 0.4 + k * 3, p.z + 0.1 + k * 0.8);
      s.scale.setScalar(0.4 + k * 1.6);
      s.material.opacity = 0.32 * Math.sin(k * Math.PI);
    }
    // Grandma: idle sway; hands a tube over when serving
    serveT = Math.max(0, serveT - dt);
    const B = grandma.bones, reach = Math.sin(Math.min(1, serveT / 0.8) * Math.PI);
    B.armR.rotation.set(-0.4 - reach * 1.0, 0, -0.15);
    B.foreR.rotation.x = -0.6 + reach * 0.4;
    B.armL.rotation.set(-0.6, 0, 0.2); B.foreL.rotation.x = -0.9;
    B.head.rotation.set(0.15 + Math.sin(t * 0.7) * 0.04, Math.sin(t * 0.5) * 0.2 - reach * 0.3, 0);
  }

  return { scene, update, setTray, serve: () => { serveT = 0.8; }, grandma };
}
