// The Go room: a wooden goban on a low table on tatami, bowls of stones, a paper screen and a
// hanging scroll. Stones are two instanced meshes; captured stones shrink away. The board is
// 0.9 m wide (larger than life) so a finger can pick a point on a phone.
import * as THREE from 'three';
import { BLACK, WHITE } from './board.js';
import { GO } from './rules.js';
import { t } from '../shared/i18n.js';

export const CELL = 0.1;
const N = GO.size, HALF = (N - 1) / 2, TOP = 0.42;                       // board top above the floor
const C = { wood: '#dcb36a', woodDark: '#b88d4a', line: '#3a2a18', tatami: '#c9c08a', edge: '#4a5a3a', wall: '#efe6d0', frame: '#7a5a3a', black: '#23221f', white: '#f4f1ea' };

function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  return tex;
}
const boardTex = () => canvasTex(1024, 1024, (g, W) => {
  g.fillStyle = C.wood; g.fillRect(0, 0, W, W);
  for (let i = 0; i < 90; i++) { g.strokeStyle = `rgba(150,105,50,${0.05 + Math.random() * 0.08})`; g.lineWidth = 1 + Math.random() * 3; const y = Math.random() * W; g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(W * 0.3, y + 14 * (Math.random() - 0.5), W * 0.7, y + 14 * (Math.random() - 0.5), W, y + 8 * (Math.random() - 0.5)); g.stroke(); }
  const m = W * 0.1, s = (W - 2 * m) / (N - 1);                           // 0.1 m margin on a 1 m board
  g.strokeStyle = C.line; g.lineWidth = 4; g.lineCap = 'square';
  for (let i = 0; i < N; i++) { g.beginPath(); g.moveTo(m + i * s, m); g.lineTo(m + i * s, W - m); g.moveTo(m, m + i * s); g.lineTo(W - m, m + i * s); g.stroke(); }
  g.fillStyle = C.line;
  for (const [x, y] of GO.stars) { g.beginPath(); g.arc(m + x * s, m + y * s, 9, 0, 7); g.fill(); }
});
const tatamiTex = () => canvasTex(512, 512, (g, W) => {
  g.fillStyle = C.tatami; g.fillRect(0, 0, W, W);
  for (let y = 0; y < W; y += 3) { g.strokeStyle = `rgba(110,105,60,${0.06 + Math.random() * 0.08})`; g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
  g.fillStyle = C.edge; g.fillRect(0, 0, W, 14); g.fillRect(0, 0, 14, W);
});
const shojiTex = () => canvasTex(512, 512, (g, W) => {
  g.fillStyle = '#fbf6e6'; g.fillRect(0, 0, W, W);
  g.strokeStyle = C.frame; g.lineWidth = 10;
  for (let i = 0; i <= 4; i++) { g.beginPath(); g.moveTo(i * W / 4, 0); g.lineTo(i * W / 4, W); g.moveTo(0, i * W / 4); g.lineTo(W, i * W / 4); g.stroke(); }
});
const scrollTex = () => canvasTex(256, 640, (g, W, H) => {
  g.fillStyle = '#f7f0dc'; g.fillRect(0, 0, W, H);
  g.fillStyle = '#8a3a2a'; g.fillRect(0, 0, W, 26); g.fillRect(0, H - 26, W, 26);
  g.fillStyle = C.black; g.beginPath(); g.arc(W / 2 - 34, 120, 44, 0, 7); g.fill();
  g.fillStyle = '#fff'; g.strokeStyle = C.black; g.lineWidth = 5; g.beginPath(); g.arc(W / 2 + 34, 170, 44, 0, 7); g.fill(); g.stroke();
  g.fillStyle = '#3a2a18'; g.textAlign = 'center'; g.font = '600 54px Kanit, sans-serif';
  const words = t('goSign').split(' ');
  words.forEach((w, i) => g.fillText(w, W / 2, 330 + i * 70, W - 24));
});

export function buildScene() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#e9dfc6');
  const sun = new THREE.DirectionalLight('#fff1d6', 2.6);
  sun.position.set(-2.2, 4.5, 2.4); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.02;
  Object.assign(sun.shadow.camera, { left: -2, right: 2, top: 2, bottom: -2, near: 0.5, far: 12 });
  scene.add(sun, new THREE.HemisphereLight('#fff6e0', '#a89a78', 1.25));
  const lam = (color, map = null) => new THREE.MeshLambertMaterial({ color, map });
  const add = (geo, mat, x, y, z, shadow = true) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = shadow; m.receiveShadow = true; scene.add(m); return m; };

  const tt = tatamiTex(); tt.wrapS = tt.wrapT = THREE.RepeatWrapping; tt.repeat.set(5, 5);
  add(new THREE.PlaneGeometry(9, 9).rotateX(-Math.PI / 2), lam('#ffffff', tt), 0, 0, 0, false);
  const st = shojiTex(); st.wrapS = st.wrapT = THREE.RepeatWrapping; st.repeat.set(4, 1.4);
  add(new THREE.PlaneGeometry(9, 3), lam('#ffffff', st), 0, 1.5, -2.6, false);
  add(new THREE.BoxGeometry(9, 0.12, 0.08), lam(C.frame), 0, 0.06, -2.56);
  add(new THREE.PlaneGeometry(0.5, 1.25), lam('#ffffff', scrollTex()), -1.55, 1.25, -2.57, false);
  // low table + goban
  add(new THREE.BoxGeometry(1.7, 0.06, 1.3), lam('#8a6a44'), 0, TOP - 0.19, 0);
  for (const x of [-0.75, 0.75]) for (const z of [-0.55, 0.55]) add(new THREE.BoxGeometry(0.08, TOP - 0.22, 0.08), lam('#6f5436'), x, (TOP - 0.22) / 2, z);
  add(new THREE.BoxGeometry(1.0, 0.16, 1.0), lam(C.woodDark), 0, TOP - 0.081, 0);
  add(new THREE.PlaneGeometry(1.0, 1.0).rotateX(-Math.PI / 2), lam('#ffffff', boardTex()), 0, TOP, 0, false);
  // bowls with stones, cushions
  const bowl = new THREE.LatheGeometry([[0.0, 0], [0.09, 0], [0.12, 0.05], [0.115, 0.09], [0.1, 0.09], [0.1, 0.05], [0, 0.03]].map(p => new THREE.Vector2(p[0], p[1])), 24);
  for (const [x, col] of [[-0.68, C.black], [0.68, C.white]]) {
    add(bowl, lam('#6a4a30'), x, TOP - 0.16, 0.42);
    add(new THREE.SphereGeometry(0.095, 20, 10).scale(1, 0.35, 1), new THREE.MeshStandardMaterial({ color: col, roughness: 0.45 }), x, TOP - 0.085, 0.42);
  }
  for (const z of [-1.15, 1.15]) add(new THREE.BoxGeometry(0.7, 0.07, 0.6), lam('#b8583a'), 0, 0.035, z);

  // ---------- stones ----------
  const stoneGeo = new THREE.SphereGeometry(CELL * 0.47, 22, 12).scale(1, 0.42, 1);
  const mats = { [BLACK]: new THREE.MeshStandardMaterial({ color: C.black, roughness: 0.42 }), [WHITE]: new THREE.MeshStandardMaterial({ color: C.white, roughness: 0.3 }) };
  const inst = {}, scale = new Float32Array(N * N), want = new Uint8Array(N * N), shown = new Uint8Array(N * N);
  for (const c of [BLACK, WHITE]) { const m = new THREE.InstancedMesh(stoneGeo, mats[c], N * N); m.castShadow = m.receiveShadow = true; m.frustumCulled = false; scene.add(m); inst[c] = m; }
  const pos = i => { const x = i % N, y = (i - x) / N; return [(x - HALF) * CELL, TOP + CELL * 0.2, (y - HALF) * CELL]; };
  const ghost = new THREE.Mesh(stoneGeo, new THREE.MeshStandardMaterial({ color: C.black, transparent: true, opacity: 0.55, roughness: 0.4 }));
  ghost.visible = false; scene.add(ghost);
  const mark = new THREE.Mesh(new THREE.RingGeometry(CELL * 0.14, CELL * 0.22, 20).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#e8541e' }));
  mark.visible = false; scene.add(mark);
  const terr = {};
  for (const c of [BLACK, WHITE]) { const m = new THREE.InstancedMesh(new THREE.BoxGeometry(CELL * 0.3, 0.004, CELL * 0.3), new THREE.MeshBasicMaterial({ color: c === BLACK ? C.black : '#ffffff' }), N * N); m.count = 0; m.frustumCulled = false; scene.add(m); terr[c] = m; }

  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), S = new THREE.Vector3(), V = new THREE.Vector3();
  function update(dt) {
    const n = { [BLACK]: 0, [WHITE]: 0 };
    for (let i = 0; i < N * N; i++) {
      const target = want[i] ? 1 : 0;
      if (want[i]) shown[i] = want[i];
      scale[i] += (target - scale[i]) * Math.min(1, dt * 14);
      if (!shown[i] || scale[i] < 0.02) { if (!want[i]) shown[i] = 0; continue; }
      const [x, y, z] = pos(i), k = scale[i];
      M.compose(V.set(x, y + (1 - k) * 0.05, z), Q, S.set(k, k, k));
      inst[shown[i]].setMatrixAt(n[shown[i]]++, M);
    }
    for (const c of [BLACK, WHITE]) { inst[c].count = n[c]; inst[c].instanceMatrix.needsUpdate = true; }
  }

  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -TOP), ray = new THREE.Raycaster(), hit = new THREE.Vector3(), ndc = new THREE.Vector2();
  return {
    scene, update, top: TOP,
    /** Show the board's stones (cells: Uint8Array) and the last move. */
    setBoard(cells, last) {
      want.set(cells);
      mark.visible = last >= 0;
      if (last >= 0) { const [x, y, z] = pos(last); mark.position.set(x, y + CELL * 0.21, z); mark.material.color.set(cells[last] === BLACK ? '#ffffff' : '#23221f'); }
    },
    setGhost(i, color) {
      ghost.visible = i >= 0;
      if (i >= 0) { const [x, y, z] = pos(i); ghost.position.set(x, y, z); ghost.material.color.set(color === BLACK ? C.black : C.white); }
    },
    /** Small squares on the points each side owns at the end. */
    setTerritory(owner, cells) {
      const n = { [BLACK]: 0, [WHITE]: 0 };
      if (owner) for (let i = 0; i < N * N; i++) if (owner[i] && !cells[i]) { const [x, , z] = pos(i); M.makeTranslation(x, TOP + 0.004, z); terr[owner[i]].setMatrixAt(n[owner[i]]++, M); }
      for (const c of [BLACK, WHITE]) { terr[c].count = n[c]; terr[c].instanceMatrix.needsUpdate = true; }
    },
    /** Screen point → board index, or -1 when off the board. */
    pick(px, py, camera) {
      ndc.set((px / innerWidth) * 2 - 1, -(py / innerHeight) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      if (!ray.ray.intersectPlane(plane, hit)) return -1;
      const x = Math.round(hit.x / CELL + HALF), y = Math.round(hit.z / CELL + HALF);
      if (x < 0 || y < 0 || x >= N || y >= N || Math.hypot(hit.x / CELL + HALF - x, hit.z / CELL + HALF - y) > 0.48) return -1;
      return x + y * N;
    },
  };
}
