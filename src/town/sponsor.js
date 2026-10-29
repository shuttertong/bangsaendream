// สนับสนุนด้วยตึกในเกม — a supporter picks a real building on the map and sponsors it (SPONSOR tiers
// in shared/config.js): "ป้ายร้าน" puts a signboard on the front, "ทั้งตึก" dresses the whole facade
// in the shop's colour with an awning, side banners and a rooftop board, "ตึก + มินิเกม" adds the
// shop to a mini-game's start card. Picking happens in the game: the ⓘ panel's "สนับสนุนด้วยตึกในเกม"
// starts pick mode, the kid walks to a building front and presses F, fills in a short form, and the
// request goes to the owner's inbox (supabase/sponsors.sql) — payment is arranged outside the game
// (PromptPay / links in SUPPORT). Approved placements with a `tier` come back through the partner
// list and are dressed here. The same panel also shows how to donate.
import * as THREE from 'three';
import { SUPPORT, SPONSOR, PARTNERS } from '../shared/config.js';
import { t, tr, getLang, onLang } from '../shared/i18n.js';
import { setSponsor } from '../shared/sponsors.js';

const ZONE = { secondary: { th: 'ถนนเลียบหาด', en: 'the beach road' }, tertiary: { th: 'ถนนเลียบหาด', en: 'the beach road' }, residential: { th: 'ซอยในเมือง', en: 'a town lane' }, osm: { th: 'ตึกจริงจากแผนที่', en: 'a real building from the map' } };
const KIND = { shop: { th: 'ตึกแถว', en: 'Shophouse row' }, condo: { th: 'คอนโด', en: 'Condo' }, house: { th: 'บ้าน', en: 'House' }, osm: { th: 'อาคาร', en: 'Building' } };
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

export function createSponsor({ scene, map, hub, root, audio, rows = [], osm = [], lift = () => 0 }) {
  const headers = { apikey: PARTNERS.key, 'Content-Type': 'application/json', Prefer: 'return=minimal' };
  const ground = (x, z) => Math.max(map.heightAt(x, z) + lift(x, z), map.sea);
  const s = { picking: false, near: null, open: false, lastSent: 0, mode: 'sponsor' };
  const pid = (() => { try { return localStorage.getItem('bangsaen.pid') || 'anon'; } catch { return 'anon'; } })();

  // ---------- the buildings a player can pick ----------
  // frontage rows (buildings.js): footprint centre, facing the road, n units of 4 m, depth D, floor y
  const fronts = rows.map((r, i) => (r.kind === 'empty' || r.kind === 'grandma' ? null : { id: `row:${i}`, kind: r.kind, zone: r.road, x: r.x, z: r.z, y: r.y, yaw: r.ry, w: r.n * 4, D: r.D, top: r.top, n: r.n })).filter(Boolean);
  const polys = osm.map((b, i) => { const n = b.p.length; let cx = 0, cz = 0; for (const [x, z] of b.p) { cx += x / n; cz += z / n; } return { id: `osm:${i}`, kind: 'osm', zone: 'osm', x: cx, z: cz, pts: b.p, top: (b.lv || 2) * 3.2 }; });
  /** The nearest building front within `range` m of (px, pz) that faces it, or null. */
  function frontNear(px, pz, range = SPONSOR.range) {
    let best = null, bd = range;
    for (const f of fronts) {
      if (Math.abs(f.x - px) > 60 || Math.abs(f.z - pz) > 60) continue;
      const fx = Math.sin(f.yaw), fz = Math.cos(f.yaw), ax = fz, az = -fx, sx = f.x + fx * (f.D / 2), sz = f.z + fz * (f.D / 2);
      const u = (px - sx) * ax + (pz - sz) * az, out = (px - sx) * fx + (pz - sz) * fz;
      if (out < 0.3 || Math.abs(u) > f.w / 2 + 1.5) continue;         // in front of it, within its width
      const d = Math.hypot(Math.max(0, Math.abs(u) - f.w / 2), out);
      if (d < bd) { bd = d; best = { ...f, sx, sz, yaw: f.yaw }; }
    }
    for (const b of polys) {                                            // real buildings: the edge nearest the player, facing them
      if (Math.abs(b.x - px) > 60 || Math.abs(b.z - pz) > 60) continue;
      const pts = b.pts;
      for (let i = 0; i < pts.length; i++) {
        const [ax, az] = pts[i], [bx, bz] = pts[(i + 1) % pts.length], ex = bx - ax, ez = bz - az, L = Math.hypot(ex, ez) || 1;
        const tt = Math.max(0, Math.min(1, ((px - ax) * ex + (pz - az) * ez) / (L * L))), qx = ax + ex * tt, qz = az + ez * tt, d = Math.hypot(px - qx, pz - qz);
        if (d >= bd || L < 3) continue;
        let nx = ez / L, nz = -ex / L;                                  // a normal; flip it toward the player
        if ((px - qx) * nx + (pz - qz) * nz < 0) { nx = -nx; nz = -nz; }
        if ((b.x - qx) * nx + (b.z - qz) * nz > 0) continue;            // the player is on the building's own side (inside / behind)
        bd = d; best = { ...b, sx: (ax + bx) / 2, sz: (az + bz) / 2, yaw: Math.atan2(nx, nz), w: L, y: ground(b.x, b.z) };
      }
    }
    return best;
  }
  const describe = f => `${tr(KIND[f.kind] || KIND.osm)}${f.n ? ` ${f.n} ${t('spUnits')}` : ''} · ${tr(ZONE[f.zone] || ZONE.osm)}`;

  // ---------- the panel: sponsor a building / donate ----------
  const modal = document.createElement('div');
  modal.className = 'modal sp-panel';
  modal.innerHTML = '<div class="panel"><h2></h2><div class="sp-body"></div><button class="close"></button></div>';
  root.appendChild(modal);
  const $ = q => modal.querySelector(q), stop = fn => e => { e.stopPropagation(); e.preventDefault(); fn(); };
  $('.close').addEventListener('pointerdown', stop(() => toggle(false)));
  modal.addEventListener('pointerdown', e => { if (e.target === modal) toggle(false); });
  addEventListener('keydown', e => { if (e.code === 'Escape') { if (s.open) toggle(false); else if (s.picking) stopPicking(); } });
  function toggle(on) { s.open = on; modal.classList.toggle('on', on); }
  const donateHTML = () => {
    const links = SUPPORT.links.map(l => `<a class="sp-link" href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.name)}</a>`).join('');
    const pp = SUPPORT.promptpay ? `<div class="sp-pp"><div>${t('spPromptPay')}</div><b class="sp-ppid">${esc(SUPPORT.promptpay)}</b><button class="sp-copy">${t('spCopy')}</button><img class="sp-qr" src="${esc(SUPPORT.qr)}" alt="" onerror="this.hidden=true"></div>` : '';
    return `<p class="sp-lead">${t('spDonateText')}</p>${pp}${links ? `<div class="sp-links">${links}</div>` : ''}${!pp && !links ? `<p class="sp-note">${t('spDonateSoon')}</p>` : ''}<p class="sp-note">${t('spThanks')}</p>`;
  };
  function openDonate() {
    s.mode = 'donate';
    $('h2').textContent = t('spDonateTitle'); $('.close').textContent = t('close');
    $('.sp-body').innerHTML = donateHTML() + `<button class="sp-pick">${t('cPick')}</button>`;
    $('.sp-copy')?.addEventListener('pointerdown', stop(() => { navigator.clipboard?.writeText(SUPPORT.promptpay).then(() => hub.hud?.toast(t('spCopied'))); }));
    $('.sp-pick').addEventListener('pointerdown', stop(() => { toggle(false); startPicking(); }));
    toggle(true);
    audio?.play('click');
  }
  function openAsk(f) {
    s.mode = 'sponsor';
    const tiers = Object.entries(SPONSOR.tiers);
    $('h2').textContent = t('spTitle'); $('.close').textContent = t('close');
    $('.sp-body').innerHTML = `<p class="sp-lead">📍 ${esc(describe(f))}<br><small>${t('spIntro')}</small></p>
      <div class="sp-tiers">${tiers.map(([k, v], i) => `<label class="sp-tier"><input type="radio" name="tier" value="${k}" ${i === 1 ? 'checked' : ''}><span class="ic">${v.icon}</span><b>${esc(getLang() === 'th' ? v.th : v.en)}</b><span class="pr">฿${v.price.toLocaleString()}/${t('spMonth')}</span><small>${esc(tr(v.what))}</small></label>`).join('')}</div>
      <form class="sp-form"><input name="shop" maxlength="40" required placeholder="${t('spName')}"><input name="contact" maxlength="120" required placeholder="${t('spContact')}"><textarea name="message" maxlength="300" rows="2" placeholder="${t('spMessage')}"></textarea><button class="sp-send" type="submit">${t('spSend')}</button></form>
      <p class="sp-note">${t('spAfter')}</p>`;
    $('.sp-form').addEventListener('submit', e => { e.preventDefault(); send(f, new FormData(e.target)); });
    $('.sp-form').addEventListener('pointerdown', e => e.stopPropagation());
    toggle(true);
    audio?.play('click');
  }
  async function send(f, data) {
    if (Date.now() - s.lastSent < SPONSOR.cooldown * 1000) { hub.hud?.toast(t('spWait')); return; }
    const body = { x: +f.x.toFixed(1), z: +f.z.toFixed(1), building: describe(f).slice(0, 40), tier: $('.sp-tiers input:checked')?.value || 'sign', shop_name: String(data.get('shop')).trim().slice(0, 40), contact: String(data.get('contact')).trim().slice(0, 120), message: String(data.get('message') || '').trim().slice(0, 300) || null, lang: getLang(), player: pid };
    $('.sp-send').disabled = true;
    try {
      const r = await fetch(`${PARTNERS.rest}/sponsor_requests`, { method: 'POST', headers, body: JSON.stringify(body) });
      if (!r.ok) throw new Error(String(r.status));
      s.lastSent = Date.now();
      $('.sp-body').innerHTML = `<p class="sp-lead">✅ ${t('spSent')}</p>${donateHTML()}`;
      $('.sp-copy')?.addEventListener('pointerdown', stop(() => { navigator.clipboard?.writeText(SUPPORT.promptpay).then(() => hub.hud?.toast(t('spCopied'))); }));
      audio?.play('fanfare');
      stopPicking();
    } catch { hub.hud?.toast(t('spFail')); $('.sp-send').disabled = false; }
  }

  // ---------- pick mode ----------
  function startPicking() { s.picking = true; hub.hud?.toast(t('spPickOn'), 'click'); audio?.play('click'); }
  function stopPicking() { s.picking = false; s.near = null; }
  function update(p, active) {
    if (!s.picking || !active) { s.near = null; return; }
    s.near = frontNear(p.x, p.z);
  }

  // ---------- dressing sponsored buildings (approved placements with a tier) ----------
  const dressed = [];
  function signCanvas(p, logo) {
    const W = 1024, H = 256, c = document.createElement('canvas'); c.width = W; c.height = H;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#fffaf0'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = p.color || '#d8743a'; ctx.fillRect(0, 0, W, 14); ctx.fillRect(0, H - 14, W, 14);
    if (logo) { ctx.save(); ctx.beginPath(); ctx.roundRect?.(18, 22, H - 44, H - 44, 20); if (!ctx.roundRect) ctx.rect(18, 22, H - 44, H - 44); ctx.clip(); ctx.drawImage(logo, 18, 22, H - 44, H - 44); ctx.restore(); }
    const tx = logo ? H + 6 : 28, tw = W - tx - 20, name = p.sign_text || p.name;
    ctx.fillStyle = '#3a3228'; ctx.textBaseline = 'top';
    let size = 110; do { ctx.font = `600 ${size}px Kanit, sans-serif`; size -= 4; } while (ctx.measureText(name).width > tw && size > 24);
    ctx.fillText(name, tx, 34);
    ctx.fillStyle = '#7d6e5c'; ctx.font = '500 48px Kanit, sans-serif';
    ctx.fillText(t('partnerTag') + (p.hours ? ' · ' + p.hours : ''), tx, 166);
    return c;
  }
  function dress(list) {
    // ?partners=demo: demo sponsors with no building get the shophouse rows nearest the start beach
    const demoRows = fronts.filter(f => f.kind === 'shop').sort((a, b) => Math.hypot(a.x - (hub.places.beach?.x ?? 0), a.z - (hub.places.beach?.z ?? 0)) - Math.hypot(b.x - (hub.places.beach?.x ?? 0), b.z - (hub.places.beach?.z ?? 0)));
    let k = 0;
    for (const p of list) {
      if (p.tier && p.tier !== 'kiosk' && p.bx == null && String(p.id).startsWith('demo') && demoRows[k]) { p.bx = demoRows[k].x; p.bz = demoRows[k].z; k++; }
      if (!p.tier || p.tier === 'kiosk' || p.bx == null) continue;
      const f = frontOf(+p.bx, +p.bz);
      if (!f) continue;
      const group = new THREE.Group(), fx = Math.sin(f.yaw), fz = Math.cos(f.yaw), ax = fz, az = -fx, y0 = f.y ?? ground(f.sx, f.sz);
      const w = Math.min(f.w, 12), colour = new THREE.Color(p.color || '#d8743a');
      const tex = new THREE.CanvasTexture(signCanvas(p, null)); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
      const signMat = new THREE.MeshLambertMaterial({ map: tex });
      const place = (mesh, u, h, out) => { mesh.position.set(f.sx + ax * u + fx * out, y0 + h, f.sz + az * u + fz * out); mesh.rotation.y = f.yaw; mesh.castShadow = mesh.receiveShadow = true; group.add(mesh); };
      // every tier: the sign across the front above the ground floor (higher when an awning hangs under it, so the awning never hides the name)
      const big = p.tier === 'building' || p.tier === 'game', sh = big ? 3.7 : 3.0;
      place(new THREE.Mesh(new THREE.BoxGeometry(Math.min(w - 0.4, 6.4), 0.06, 0.12), new THREE.MeshLambertMaterial({ color: '#f4f1e8' })), 0, sh, 0.12);
      place(new THREE.Mesh(new THREE.PlaneGeometry(Math.min(w - 0.6, 6.2), 1.5), signMat), 0, sh, 0.19);
      if (big) {                                                      // the whole front: awning, side banners, rooftop board
        const awn = new THREE.Mesh(new THREE.BoxGeometry(w, 0.08, 1.6).rotateX(-0.2), new THREE.MeshLambertMaterial({ color: colour }));
        place(awn, 0, 2.6, 0.75);
        for (let i = 0; i < Math.round(w / 0.5); i++) place(new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.14, 0.04), new THREE.MeshLambertMaterial({ color: i % 2 ? '#f4f1e8' : colour })), -w / 2 + 0.25 + i * 0.5, 2.42, 1.5);
        for (const sx of [-1, 1]) place(new THREE.Mesh(new THREE.PlaneGeometry(0.9, Math.max(2.5, f.top * 0.45)), new THREE.MeshLambertMaterial({ color: colour, side: THREE.DoubleSide })), sx * (w / 2 - 0.55), 4.0 + Math.max(2.5, f.top * 0.45) / 2 - 1.2, 0.2);
        place(new THREE.Mesh(new THREE.PlaneGeometry(Math.min(w, 7), 1.7), signMat), 0, (f.top || 7) + 0.9, -0.6);
        place(new THREE.Mesh(new THREE.BoxGeometry(Math.min(w, 7) + 0.3, 0.1, 0.1), new THREE.MeshLambertMaterial({ color: '#f4f1e8' })), 0, f.top || 7, -0.6);
      }
      scene.add(group);
      dressed.push({ p, f, group, tex });
      // the coupon prompt and the travel pin stand in front of the sign
      p.x = f.sx + fx * 2.2; p.z = f.sz + fz * 2.2; p.yaw = f.yaw + Math.PI;
      if (hub.places[`partner:${p.id}`]) Object.assign(hub.places[`partner:${p.id}`], { x: p.x, z: p.z, yaw: p.yaw });
      if (p.tier === 'game' && p.game) setSponsor(p.game, { name: p.name, name_en: p.name_en, color: p.color, logo_url: p.logo_url });
      if (p.logo_url) { const im = new Image(); im.crossOrigin = 'anonymous'; im.onload = () => { tex.image = signCanvas(p, im); tex.needsUpdate = true; }; im.src = p.logo_url; }
    }
    onLang(() => { for (const d of dressed) { d.tex.image = signCanvas(d.p, null); d.tex.needsUpdate = true; } });
  }
  /** The building whose footprint centre is nearest (bx, bz), as a front record. */
  function frontOf(bx, bz) {
    let best = null, bd = 12;
    for (const f of fronts) { const d = Math.hypot(f.x - bx, f.z - bz); if (d < bd) { bd = d; best = f; } }
    if (best) { const fx = Math.sin(best.yaw), fz = Math.cos(best.yaw); return { ...best, sx: best.x + fx * (best.D / 2), sz: best.z + fz * (best.D / 2) }; }
    for (const b of polys) { const d = Math.hypot(b.x - bx, b.z - bz); if (d < bd) { bd = d; best = b; } }
    return best ? frontNear(best.x + 0.01, best.z, 1e9) : null;      // (a real building: its edge nearest the centre, i.e. the shortest side — good enough for a sign)
  }

  return {
    get picking() { return s.picking; }, get near() { return s.near; }, get open() { return s.open; },
    startPicking, stopPicking, openDonate, dress, update,
    /** F in pick mode at a building. */ ask() { if (s.near) openAsk(s.near); },
    prompt: () => ['sponsorAsk', { what: s.near ? describe(s.near) : '' }],
    debug: { fronts, polys, frontNear, dressed },
  };
}
