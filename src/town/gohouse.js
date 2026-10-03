// บ้านหมากล้อม — the Go house. One of the generated shophouse rows (the one nearest GO_HOUSE.near)
// is dressed as a Go club: a wooden signboard across the front (text through i18n), black and
// white stone emblems, red lanterns, a doormat, and a goban on a low table with two stools on
// the pavement. The teacher (roster.js 'kru') stands in front and offers หมากล้อม 9×9.
import * as THREE from 'three';
import { t, onLang } from '../shared/i18n.js';

export const GO_HOUSE = {
  near: [470, 1044],                 // local metres: the shophouse row nearest this point becomes the Go house (on the beach road, a short walk from the start)
  roads: ['tertiary'],               // not 'secondary': road 3137 is closed, a house on it sits behind the roadblock
  lot: 4,                            // shophouse unit width (buildings.js FRONTAGE.lot)
  units: 3, bigRow: 120,             // dress at most this many units; a longer row counts as this much further away
  sign: { h: 1.05, y: 3.5 },
  colors: { wood: '#5a3d26', trim: '#c9a25a', black: '#23221f', white: '#f4f1ea', lantern: '#d8322a', mat: '#8a3a2a', board: '#dcb36a', stool: '#7a5a3a' },
};
const col = h => new THREE.Color(h);

/** The shophouse row that becomes the Go house (also used for the travel stop), or null. */
export function goRow(rows) {
  const [nx, nz] = GO_HOUSE.near;
  let best = null, bd = Infinity;
  for (const r of rows) {
    if (r.kind !== 'shop' || !GO_HOUSE.roads.includes(r.road)) continue;
    const d = Math.hypot(r.x - nx, r.z - nz) + (r.n > GO_HOUSE.units ? GO_HOUSE.bigRow : 0);   // prefer a small row: the whole building is the club
    if (d < bd) { bd = d; best = r; }
  }
  return best;
}

/** Returns { row, place: { x, z, yaw }, solids } (place: where the teacher stands), or null. */
export function buildGoHouse(kit, scene, rows) {
  const row = goRow(rows);
  if (!row) return null;
  const G = GO_HOUSE, C = G.colors, f = kit.frame(row.x, row.y, row.z, row.ry), W = Math.min(row.n, G.units) * G.lot, front = row.D / 2, solids = [];
  // signboard across the whole front, with a trim frame
  f.box('wall', 0, G.sign.y, front + 0.14, W - 0.3, G.sign.h + 0.16, 0.1, col(C.trim));
  f.box('wall', 0, G.sign.y, front + 0.17, W - 0.46, G.sign.h, 0.1, col(C.wood));
  // stone emblems at both ends of the sign, lanterns under it
  const disc = new THREE.CylinderGeometry(0.36, 0.36, 0.08, 24).rotateX(Math.PI / 2);
  for (const [u, c] of [[-W / 2 + 0.75, C.black], [W / 2 - 0.75, C.white]]) {
    const p = f.P(u, G.sign.y, front + 0.25);
    kit.add('wall', disc, new THREE.Matrix4().makeRotationY(row.ry).setPosition(p), col(c));
    kit.add('wall', disc, new THREE.Matrix4().makeRotationY(row.ry).scale(new THREE.Vector3(1.14, 1.14, 0.6)).setPosition(f.P(u, G.sign.y, front + 0.235)), col(C.trim));   // a light rim, so the black stone shows on the dark wood
  }
  for (const u of [-W / 4, W / 4]) {
    f.rod('metal', [u, G.sign.y - G.sign.h / 2 - 0.05, front + 0.45], [u, G.sign.y - G.sign.h / 2 - 0.3, front + 0.45], 0.012, col('#3a3a3a'));
    f.rod('lit', [u, 2.3, front + 0.45], [u, 2.72, front + 0.45], 0.17, col(C.lantern));
    f.rod('wall', [u, 2.24, front + 0.45], [u, 2.3, front + 0.45], 0.1, col(C.trim));
    f.rod('wall', [u, 2.72, front + 0.45], [u, 2.78, front + 0.45], 0.1, col(C.trim));
  }
  f.box('wall', 0, 0.03, front + 0.55, 1.6, 0.04, 0.8, col(C.mat));
  // a goban on a low table with two stools, beside the door
  const tu = W / 2 - 1.1, tw = front + 1.5;
  f.box('wall', tu, 0.5, tw, 0.9, 0.06, 0.9, col(C.stool));
  for (const du of [-0.38, 0.38]) for (const dw of [-0.38, 0.38]) f.box('wall', tu + du, 0.24, tw + dw, 0.07, 0.48, 0.07, col(C.stool));
  f.box('wall', tu, 0.6, tw, 0.62, 0.14, 0.62, col(C.board));
  for (let i = 0; i < 9; i++) {                                           // the grid, and a few stones mid-game
    f.box('wall', tu + (i - 4) * 0.06, 0.672, tw, 0.006, 0.004, 0.486, col('#3a2a18'));
    f.box('wall', tu, 0.672, tw + (i - 4) * 0.06, 0.486, 0.004, 0.006, col('#3a2a18'));
  }
  const stone = new THREE.SphereGeometry(0.027, 10, 6).scale(1, 0.45, 1);
  for (const [gx, gy, c] of [[2, 2, 1], [6, 2, 2], [4, 4, 1], [2, 6, 2], [6, 6, 1], [5, 3, 2], [3, 5, 1], [3, 3, 2], [5, 5, 1], [6, 4, 2]]) {
    kit.add('wall', stone, new THREE.Matrix4().setPosition(f.P(tu + (gx - 4) * 0.06, 0.685, tw + (gy - 4) * 0.06)), col(c === 1 ? C.black : C.white));
  }
  for (const dw of [-0.85, 0.85]) { f.rod('wall', [tu, 0, tw + dw], [tu, 0.42, tw + dw], 0.19, col(C.stool)); const p = f.P(tu, 0, tw + dw); solids.push({ x: p.x, z: p.z, r: 0.3, top: row.y + 0.45 }); }
  const tp = f.P(tu, 0, tw);
  solids.push({ x: tp.x, z: tp.z, r: 0.6, top: row.y + 0.7 });

  // the sign text: one small canvas mesh, redrawn when the language changes
  const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = 160;
  const tex = new THREE.CanvasTexture(canvas); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const draw = () => {
    const g = canvas.getContext('2d');
    g.clearRect(0, 0, 1024, 160);
    g.fillStyle = '#f6e7c0'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = '600 96px Kanit, sans-serif'; g.fillText(t('goSign'), 512, 70, 980);
    g.font = '400 34px Kanit, sans-serif'; g.fillText(t('goSignSub'), 512, 136, 980);
    tex.needsUpdate = true;
  };
  draw(); document.fonts?.ready.then(draw); onLang(draw);
  const signW = W - 2.4;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(signW, signW * 160 / 1024), new THREE.MeshBasicMaterial({ map: tex, transparent: true }));
  mesh.position.copy(f.P(0, G.sign.y, front + 0.225)); mesh.rotation.y = row.ry;
  scene.add(mesh);

  const stand = f.P(-W / 2 + 1.2, 0, front + 1.5);
  return { row, place: { x: stand.x, z: stand.z, yaw: row.ry }, solids, mesh };
}
