// The visit to the Institute of Marine Science (marine.js, aquarium.js): the signs (one canvas texture, one mesh,
// redrawn when the language changes), the ticket counter and the turnstile, the labels by every tank that open a card
// about its animals, and the roof that hides while the kid is inside.
//   buildMarineSigns(kit, scene, labels) — before the town kit is built (it adds the label stands);
//   createMarineVisit({ … }) → { interact, update } — after the hub (the F prompt, toasts, the card).
import * as THREE from 'three';
import { t, tr, onLang } from '../shared/i18n.js';
import { SPECIES, ZONES, VISIT } from '../shared/aquarium.js';
import * as P from '../shared/progress.js';
import { dayKey } from '../shared/wardrobe.js';
import { MARINE, toWorld } from './marine.js';

const M = MARINE;
// labels in the museum (marine.js hangs the models; the tanks' labels come from aquarium.js)
const MUSEUM = [
  { tank: 'whale', u: 15.5, w: -30, plate: { u: 15.2, y: 1.1, w: -30, face: [-1, 0], stand: true } },
  { tank: 'whaleShark', u: 16, w: -16.5, plate: { u: 15.7, y: 1.1, w: -16.5, face: [-1, 0], stand: true } },
  { tank: 'shore', u: 21, w: -37.4, plate: { u: 21, y: 1.1, w: -37.6, face: [0, 1], stand: true } },
];
const TICKET_AT = [6.9, -5];                  // where to stand at the counter (local)

/** Signs: the facade, the gate, the price board, the welcome banner and a plate by every label. */
export function buildMarineSigns(kit, scene, labels, photo = null) {
  const all = [...labels, ...MUSEUM], signs = [];
  const sign = (name, pw, ph, u, y, w, face, sw, sh, draw) => signs.push({ name, pw, ph, u, y, w, face, sw, sh, draw });
  const font = (c, wt, px, fam = 'Kanit') => { c.font = `${wt} ${px}px ${fam}, sans-serif`; };
  const centre = (c, text, x, y, max) => { c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(text, x, y, max); };
  const front = [0, 1];
  sign('facade', 2048, 128, 0, 8.25, 1.26, front, 24, 1.5, (c, W, H) => {                             // light letters on the red-brown fascia, as on the real building
    c.fillStyle = '#7c4028'; c.fillRect(0, 0, W, H);
    c.fillStyle = '#f6efe2'; font(c, 600, 76); centre(c, `${t('aqFacade1')}   ·   ${t('aqFacade2')}`, W / 2, H * 0.56, W - 60);
  });
  sign('admission', 1024, 200, 11.74, 4.9, -5, [-1, 0], 5.6, 1.1, (c, W, H) => {                      // over the ticket windows
    c.fillStyle = '#2a86bc'; c.fillRect(0, 0, W, H);
    c.fillStyle = '#ffffff'; font(c, 600, 84); centre(c, t('aqAdmission1'), W / 2, H * 0.4, W - 40);
    font(c, 500, 44); centre(c, t('aqAdmission2'), W / 2, H * 0.82, W - 40);
  });
  for (const fw of [1, -1]) sign(`gate${fw}`, 1024, 220, -12.75, 2.3, M.site.w[1] + fw * 0.51, [0, fw], 8.2, 1.76, (c, W, H) => {   // on both faces of the sign wall
    c.fillStyle = '#f4f1e8'; c.fillRect(0, 0, W, H);
    c.fillStyle = '#1f5fa8'; font(c, 600, 64); centre(c, t('aqGate1'), W / 2, H * 0.27, W - 40);
    font(c, 500, 44); centre(c, t('aqGate2'), W / 2, H * 0.58, W - 40);
    c.fillStyle = '#4a5a6a'; font(c, 400, 34, 'Sarabun'); centre(c, t('aqGate3'), W / 2, H * 0.84, W - 40);
  });
  sign('price', 512, 320, 11.78, 2.7, -5, [-1, 0], 2.4, 1.5, (c, W, H) => {
    c.fillStyle = '#1f5fa8'; c.fillRect(0, 0, W, H); c.fillStyle = '#ffffff';
    font(c, 600, 50); centre(c, t('aqPriceTitle'), W / 2, H * 0.18, W - 30);
    font(c, 500, 44); centre(c, t('aqPriceKid', { n: VISIT.ticket }), W / 2, H * 0.48, W - 30); centre(c, t('aqPriceAdult', { n: VISIT.ticket * 2 }), W / 2, H * 0.72, W - 30);
    font(c, 400, 26, 'Sarabun'); centre(c, t('aqPriceNote'), W / 2, H * 0.91, W - 30);
  });
  sign('welcome', 1024, 128, 0, 4.4, M.turnstile[2] + 0.17, front, 8, 1, (c, W, H) => {
    c.fillStyle = '#0f3a5a'; c.fillRect(0, 0, W, H); c.fillStyle = '#e8f6ff'; font(c, 600, 64); centre(c, t('aqWelcome'), W / 2, H / 2, W - 40);
  });
  for (const L of all) {
    const p = L.plate, Z = ZONES[L.tank];
    if (!p || !Z) continue;
    sign(`plate-${L.tank}-${p.u}`, 256, 128, p.u, p.y + (p.stand ? 0 : 0.0), p.w, p.face, 1.2, 0.6, (c, W, H) => {
      c.fillStyle = '#f8f6f0'; c.fillRect(0, 0, W, H);
      c.fillStyle = '#1f5fa8'; c.fillRect(0, 0, W, 44);
      c.fillStyle = '#ffffff'; font(c, 600, 26); c.textAlign = 'left'; c.textBaseline = 'middle'; c.fillText(`${Z.icon} ${tr(Z.name)}`, 10, 23, W - 20);
      c.fillStyle = '#2a3440'; font(c, 400, 20, 'Sarabun');
      Z.species.slice(0, 3).forEach((id, k) => c.fillText(`${SPECIES[id].icon} ${tr(SPECIES[id].name)}`, 12, 62 + k * 22, W - 24));
    });
    if (p.stand) { const [x, z] = toWorld(p.u, p.w); kit.rod('metal', new THREE.Vector3(x, M.level + M.building.floor, z), new THREE.Vector3(x, M.level + p.y - 0.3, z), 0.03, new THREE.Color('#6a7480')); }
    else { const [x, z] = toWorld(p.u - p.face[0] * 0.02, p.w - p.face[1] * 0.02); kit.box('wall', x, M.level + p.y, z, 1.26, 0.66, 0.02, M.ry + Math.atan2(p.face[0], p.face[1]), new THREE.Color('#1a2430')); }   // a backing board
  }
  if (photo) {                                                                                        // the photo spot's little sign, on a stand
    const { u, w } = photo.sign, [x, z] = toWorld(u, w);
    sign('photo', 256, 128, u, 1.0, w, front, 0.9, 0.45, (c, W, H) => {
      c.fillStyle = '#141c30'; c.fillRect(0, 0, W, H); c.strokeStyle = '#8fd8ff'; c.lineWidth = 6; c.strokeRect(5, 5, W - 10, H - 10);
      c.fillStyle = '#e8f6ff'; font(c, 600, 44); centre(c, '📷', W / 2, H * 0.34, W - 20); font(c, 600, 34); centre(c, t('aqPhotoSign'), W / 2, H * 0.72, W - 24);
    });
    kit.rod('metal', new THREE.Vector3(x, M.level + M.building.floor, z), new THREE.Vector3(x, M.level + 0.8, z), 0.025, new THREE.Color('#6a7480'));
  }
  // pack the signs into one canvas, in rows
  const W = 2048;
  let x = 0, y = 0, row = 0;
  for (const s of signs) { if (x + s.pw > W) { x = 0; y += row; row = 0; } s.px = x; s.py = y; x += s.pw; row = Math.max(row, s.ph); }
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = THREE.MathUtils.ceilPowerOfTwo(y + row);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const redraw = () => {
    const c = canvas.getContext('2d');
    for (const s of signs) { c.save(); c.translate(s.px, s.py); c.beginPath(); c.rect(0, 0, s.pw, s.ph); c.clip(); s.draw(c, s.pw, s.ph); c.restore(); }
    tex.needsUpdate = true;
  };
  redraw(); onLang(redraw); document.fonts?.ready.then(redraw);
  // one quad per sign, facing its way
  const pos = [], uv = [], H = canvas.height;
  for (const s of signs) {
    const [cx, cz] = toWorld(s.u, s.w), [fx, fz] = toWorld(s.u + s.face[0], s.w + s.face[1]), nx = fx - cx, nz = fz - cz;
    const rx = nz, rz = -nx, hw = s.sw / 2, hh = s.sh / 2, yy = M.level + s.y;
    const ox = cx + nx * 0.01, oz = cz + nz * 0.01, c = [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]].map(([a, b]) => [ox + rx * a, yy + b, oz + rz * a]);
    const u0 = s.px / W, u1 = (s.px + s.pw) / W, v1 = 1 - s.py / H, v0 = 1 - (s.py + s.ph) / H, uvs = [[u0, v0], [u1, v0], [u1, v1], [u0, v1]];
    for (const k of [0, 1, 2, 0, 2, 3]) { pos.push(...c[k]); uv.push(...uvs[k]); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  const mesh = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ map: tex }));
  mesh.name = 'marine-signs';
  scene.add(mesh);
  return { labels: all, mesh };
}

/** The ticket, the turnstile, the labels' cards and the roof. Plugs into the hub's F prompt through `interact`. */
export function createMarineVisit({ root, marine, labels, collision, roof, arms, far = [], audio, toast, photo = null, player = null, camera = null }) {
  const card = document.createElement('div');
  card.className = 'aq-card';
  root.appendChild(card);
  let open = null, warned = 0;
  const pts = labels.map(L => { const [x, z] = toWorld(L.u, L.w); return { ...L, x, z }; });
  const [tx, tz] = toWorld(...TICKET_AT), [gx, gz] = toWorld(0, M.turnstile[2] + 1.2);
  const hasTicket = () => P.get().flags.aqTicket === dayKey();
  const openGate = () => { collision.clearRect(marine.gate.x, marine.gate.z, marine.gate.w, marine.gate.d, marine.gate.ry); if (arms) arms.visible = false; };
  if (hasTicket()) openGate(); else collision.rect(marine.gate.x, marine.gate.z, marine.gate.w, marine.gate.d, marine.gate.ry, marine.gate.top);

  const show = L => {
    const Z = ZONES[L.tank];
    open = L;
    card.innerHTML = `<div class="aq-head">${Z.icon} ${tr(Z.name)}</div>` + Z.species.map(id => { const s = SPECIES[id]; return `<div class="aq-row"><span class="aq-ic">${s.icon}</span><div><b>${tr(s.name)}</b><p>${tr(s.fact)}</p></div></div>`; }).join('') + `<button class="aq-close">${t('close')}</button>`;
    card.querySelector('.aq-close').addEventListener('pointerdown', e => { e.stopPropagation(); hide(); });
    card.classList.add('on');
    audio?.play('click');
  };
  const hide = () => { open = null; card.classList.remove('on'); };
  addEventListener('keydown', e => { if (e.code === 'Escape' && open) hide(); });

  const interact = {
    nearest(p) {
      if (!hasTicket() && Math.hypot(p.x - tx, p.z - tz) < VISIT.reach) return { kind: 'ticket' };
      if (photo && player && Math.hypot(p.x - photo.x, p.z - photo.z) < VISIT.photoReach) return { kind: 'photo' };
      let best = null, bd = VISIT.reach;
      for (const L of pts) { const d = Math.hypot(p.x - L.x, p.z - L.z); if (d < bd) { bd = d; best = L; } }
      return best ? { kind: 'label', L: best } : null;
    },
    prompt(it) { return it.kind === 'photo' ? ['aqPhoto', {}] : it.kind === 'ticket' ? ['aqTicket', { n: VISIT.ticket }] : [open === it.L ? 'aqClose' : 'aqLook', { zone: tr(ZONES[it.L.tank].name) }]; },
    use(it) {
      if (it.kind === 'photo') {                                                         // stand on the ring facing the room; the camera comes round in front, the moon behind
        player.place(photo.x, photo.z, photo.yaw);
        if (camera) { Object.assign(camera.state, { yaw: photo.yaw, pitch: photo.pitch, dist: photo.dist }); camera.snap(); }
        player.kid.express(VISIT.smile);
        toast(t('aqPhotoHint'), 'click');
        return;
      }
      if (it.kind === 'ticket') {
        if (P.get().baht >= VISIT.ticket) { P.addBaht(-VISIT.ticket); toast(t('aqTicketPaid', { n: VISIT.ticket }), 'coin'); }
        else toast(t('aqTicketFree'), 'catch');
        P.setFlag('aqTicket', dayKey());
        openGate();
      } else if (open === it.L) hide(); else show(it.L);
    },
  };

  return {
    interact,
    update(dt, p) {
      const [mx, mz] = toWorld(0, 20), near = Math.hypot(p.x - mx, p.z - mz) < 240;
      for (const o of far) o.visible = near;                                             // (nothing of it is drawn from the beach)
      if (arms) arms.visible = near && !hasTicket();
      const inside = marine.inside(p.x, p.z);
      if (roof && roof.visible === inside) roof.visible = !inside;                        // see the kid from the camera, not the roof
      if (open && Math.hypot(p.x - open.x, p.z - open.z) > VISIT.reach + 2) hide();
      warned -= dt;
      if (!hasTicket() && warned <= 0 && Math.hypot(p.x - gx, p.z - gz) < 1.6) { warned = 8; toast(t('aqNeedTicket'), 'thud'); }
    },
  };
}
