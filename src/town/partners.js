// ร้านพันธมิตร — real Bang Saen shops that sponsor the game (see supabase/partners.sql and admin.html).
// At load, approved placements come from Supabase (public view, publishable key). Each becomes a
// small kiosk in the shop's colour at its real spot, with a sign (name + logo + "ร้านพันธมิตร"),
// a pin in the travel menu, a visit counter when the kid walks up, and, if the shop offers one,
// a coupon: a server-made 6-digit code the family shows at the real shop. No personal data: the
// player id is a random string kept in this browser.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Kit } from './assets/kit.js';
import { PARTNERS } from '../shared/config.js';
import { t, tr, onLang } from '../shared/i18n.js';
import * as P from '../shared/progress.js';

const PID_KEY = 'bangsaen.pid', COUPON_KEY = 'bangsaen.coupons';
const col = h => new THREE.Color(h);

export function createPartners({ scene, map, collision, hub, root, audio }) {
  const C = PARTNERS, list = [], visited = new Set();
  let kit = null, signs = null, logos = new Map();
  const pid = (() => { try { let v = localStorage.getItem(PID_KEY); if (!v) { v = Math.random().toString(36).slice(2, 12); localStorage.setItem(PID_KEY, v); } return v; } catch { return 'anon' + Math.floor(Math.random() * 1e6); } })();
  const headers = { apikey: C.key, 'Content-Type': 'application/json' };

  // ---------- the coupon panel ----------
  const modal = document.createElement('div');
  modal.className = 'modal cp-panel';
  modal.innerHTML = '<div class="panel"><h2></h2><div class="cp-body"></div><button class="close"></button></div>';
  root.appendChild(modal);
  const $ = q => modal.querySelector(q);
  $('.close').addEventListener('pointerdown', e => { e.stopPropagation(); modal.classList.remove('on'); });
  modal.addEventListener('pointerdown', e => { if (e.target === modal) modal.classList.remove('on'); });
  const saved = () => { try { return JSON.parse(localStorage.getItem(COUPON_KEY) || '[]'); } catch { return []; } };
  const remember = c => { try { const l = saved().filter(o => o.code !== c.code); l.unshift(c); localStorage.setItem(COUPON_KEY, JSON.stringify(l.slice(0, 20))); } catch { /* storage blocked */ } };
  const fmtDate = iso => new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
  function showCoupon(c, fresh) {
    $('h2').textContent = t('couponTitle');
    $('.close').textContent = t('close');
    const mine = saved().filter(o => o.code !== c.code && new Date(o.expires_at) > new Date());
    $('.cp-body').innerHTML = `
      <div class="cp-card" style="--shop:${c.color || '#d8743a'}">
        <div class="cp-shop">${esc(c.shop)}</div>
        <div class="cp-what">${esc(c.coupon_text || '')}</div>
        <div class="cp-code">${c.code.slice(0, 3)} ${c.code.slice(3)}</div>
        <div class="cp-exp">${t('couponUntil', { d: fmtDate(c.expires_at) })}</div>
      </div>
      <p class="cp-hint">${fresh ? t('couponShow') : t('couponAgain')}</p>
      ${mine.length ? `<h3>${t('couponMine')}</h3>` + mine.map(o => `<div class="dest cp-row"><span class="ic">🎟️</span><span class="nm">${esc(o.shop)} · ${esc(o.coupon_text || '')}</span><span class="here">${o.code}</span></div>`).join('') : ''}`;
    modal.classList.add('on');
    audio?.play('coin');
  }
  const esc = s => String(s ?? '').replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]);

  // ---------- geometry ----------
  function booth(k, p) {
    const y = Math.max(map.heightAt(p.x, p.z), map.sea) + 0.02, f = k.frame(p.x, y, p.z, p.yaw), main = col(p.color), trim = col('#f4f1e8');
    f.box('wall', 0, 0.45, 0, 2.4, 0.9, 0.9, main);                                   // counter body
    f.box('wall', 0, 0.92, 0, 2.5, 0.05, 1.0, trim);                                   // counter top
    f.box('wall', 0, 0.3, 0.46, 2.2, 0.5, 0.02, col('#eceae4'));                      // front panel
    for (const u of [-1.15, 1.15]) f.box('wall', u, 1.3, -0.35, 0.08, 2.6, 0.08, trim);   // posts
    const roof = new THREE.BoxGeometry(2.9, 0.06, 1.5).rotateX(-0.22);                 // sloping awning
    k.add('wall', roof, new THREE.Matrix4().makeRotationY(p.yaw).setPosition(f.P(0, 2.55, 0.15)), main);
    for (let i = 0; i < 6; i++) k.add('wall', new THREE.BoxGeometry(0.42, 0.14, 0.03), new THREE.Matrix4().makeRotationY(p.yaw).setPosition(f.P(-1.25 + i * 0.5, 2.38, 0.86)), i % 2 ? trim : main);   // scalloped edge
    f.box('wall', 0, 1.6, -0.42, 2.3, 0.02, 0.6, trim);                                // back shelf
    for (let i = 0; i < 4; i++) f.box('wall', -0.75 + i * 0.5, 1.72, -0.42, 0.3, 0.22, 0.3, i % 2 ? main : col('#4fb3a8'));   // goods on the shelf
    f.box('wall', -0.9, 0.22, -0.9, 0.34, 0.44, 0.34, col('#3a9a6a'));                 // stool
    const sign = new THREE.Matrix4().makeRotationY(p.yaw).setPosition(f.P(0, 3.05, 0.1));
    f.box('wall', 0, 3.05, 0.07, 2.62, 0.72, 0.06, trim);                              // sign frame
    collision.rect(p.x, p.z, 2.6, 1.1, p.yaw, y + 1);
    return sign;
  }
  function drawSign(ctx, W, rowH, i, p) {
    const y0 = i * rowH;
    ctx.fillStyle = '#fffaf0'; ctx.fillRect(0, y0, W, rowH);
    ctx.fillStyle = p.color; ctx.fillRect(0, y0, W, 10); ctx.fillRect(0, y0 + rowH - 10, W, 10);
    const logo = logos.get(p.id);
    if (logo) { ctx.save(); ctx.beginPath(); ctx.roundRect?.(16, y0 + 18, rowH - 36, rowH - 36, 18); if (!ctx.roundRect) ctx.rect(16, y0 + 18, rowH - 36, rowH - 36); ctx.clip(); ctx.drawImage(logo, 16, y0 + 18, rowH - 36, rowH - 36); ctx.restore(); }
    const tx = logo ? rowH + 4 : 24, tw = W - tx - 16;
    ctx.fillStyle = '#3a3228'; ctx.textBaseline = 'top';
    let size = Math.round(rowH * 0.46); do { ctx.font = `600 ${size}px Kanit, sans-serif`; size -= 2; } while (ctx.measureText(p.name).width > tw && size > 18);
    ctx.fillText(p.name, tx, y0 + rowH * 0.14);
    ctx.fillStyle = '#7d6e5c'; ctx.font = `500 ${Math.round(rowH * 0.2)}px Kanit, sans-serif`;
    ctx.fillText(t('partnerTag') + (p.hours ? ' · ' + p.hours : ''), tx, y0 + rowH * 0.64);
  }
  function build() {
    if (!list.length) return;
    kit = new Kit();
    const boards = list.map(p => booth(kit, p));
    scene.add(kit.build());
    // one canvas for every sign: a row each
    const W = 1024, rowH = 256, canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = rowH * list.length;
    const tex = new THREE.CanvasTexture(canvas); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
    const geos = boards.map((m, i) => {
      const g = new THREE.PlaneGeometry(2.5, 0.62).applyMatrix4(m), uv = g.attributes.uv;
      for (let k = 0; k < uv.count; k++) uv.setY(k, 1 - (i + 1 - uv.getY(k)) / list.length);   // row i, top to bottom
      return g;
    });
    signs = new THREE.Mesh(mergeGeometries(geos), new THREE.MeshLambertMaterial({ map: tex }));
    signs.receiveShadow = true; scene.add(signs);
    const redraw = () => { const ctx = canvas.getContext('2d'); list.forEach((p, i) => drawSign(ctx, W, rowH, i, p)); tex.needsUpdate = true; };
    redraw(); document.fonts?.ready.then(redraw); onLang(redraw);
    for (const p of list) if (p.logo_url) { const im = new Image(); im.crossOrigin = 'anonymous'; im.onload = () => { logos.set(p.id, im); redraw(); }; im.src = p.logo_url; }
    // travel pins, in front of the counter
    for (const p of list) {
      const fx = Math.sin(p.yaw), fz = Math.cos(p.yaw);
      hub.places[`partner:${p.id}`] = { id: `partner:${p.id}`, name: { th: p.name, en: p.name_en || p.name }, icon: 'partner', x: p.x + fx * 2.4, z: p.z + fz * 2.4, yaw: p.yaw + Math.PI };
    }
  }

  // ---------- data ----------
  // ?partners=demo: one fictional demo shop (no database), for previews and tests
  const demo = new URLSearchParams(location.search).get('partners') === 'demo';
  const DEMO = [{ id: 'demo', name: 'คาเฟ่ตัวอย่าง', name_en: 'Demo Cafe', kind: 'cafe', zone: 'beach', x: 318, z: 1000, yaw: -2.3, color: '#2a8f9a', logo_url: null, hours: '08:00–18:00', package: 'shop', coupon_enabled: true, coupon_text: 'ลด ฿10 (ตัวอย่าง)' }];
  (demo ? Promise.resolve(DEMO) : fetch(`${C.rest}/public_placements?select=*`, { headers }).then(r => (r.ok ? r.json() : []))).then(rows => {
    for (const r of rows) list.push({ ...r, x: +r.x, z: +r.z, yaw: +r.yaw });
    build();
  }).catch(() => { /* offline or not set up yet: the hub simply has no partner shops */ });

  const near = p => { let best = null, bd = C.range; for (const s of list) { const d = Math.hypot(s.x - p.x, s.z - p.z); if (d < bd) { bd = d; best = s; } } return best; };
  async function use(s) {
    if (!s.coupon_enabled) { showInfo(s); return; }
    audio?.play('click');
    if (demo) { const c = { code: '000000', expires_at: new Date(Date.now() + 7 * 864e5).toISOString(), shop: s.name, coupon_text: s.coupon_text, color: s.color, placement: s.id }; showCoupon(c, true); return; }
    try {
      const r = await fetch(`${C.rest}/rpc/issue_coupon`, { method: 'POST', headers, body: JSON.stringify({ p_placement: s.id, p_player: pid }) });
      const data = await r.json();
      if (!r.ok) throw new Error(data?.message || r.status);
      const c = { ...data[0], color: s.color, placement: s.id, issued: Date.now() };
      remember(c); P.addItem('coupon');
      showCoupon(c, true);
    } catch (e) {
      hub.hud?.toast(t(/cap/.test(e.message) ? 'couponGone' : 'couponFail'));
    }
  }
  function showInfo(s) {
    $('h2').textContent = s.name; $('.close').textContent = t('close');
    $('.cp-body').innerHTML = `<p class="cp-hint">${t('partnerInfo')}${s.hours ? `<br>🕒 ${esc(s.hours)}` : ''}</p>`;
    modal.classList.add('on');
  }
  function update(p) {
    for (const s of list) {
      if (visited.has(s.id) || Math.hypot(s.x - p.x, s.z - p.z) > C.visitRange) continue;
      visited.add(s.id);
      fetch(`${C.rest}/rpc/log_visit`, { method: 'POST', headers, body: JSON.stringify({ p_placement: s.id }) }).catch(() => {});
    }
  }
  return {
    list, nearest: near, use, update,
    prompt: s => [s.coupon_enabled ? 'partnerCoupon' : 'partnerLook', { shop: s.name }],
    get active() { return modal.classList.contains('on'); },
    openMine() { const l = saved().filter(o => new Date(o.expires_at) > new Date()); if (l.length) showCoupon(l[0], false); else hub.hud?.toast(t('couponNone')); },
  };
}
