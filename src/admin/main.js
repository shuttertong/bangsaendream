// Admin page for ร้านพันธมิตร (admin.html): login, the list of shops with their status, a form
// to add / edit a shop (with the map picker), the approval queue, coupon confirmation, and
// visits / coupons / invoices per shop. Only the admin's email (app_admins) can read or write;
// the database enforces it. Prices come from PARTNERS.prices in shared/config.js.
import { takeSessionFromHash, signedIn, me, sendMagicLink, verifyCode, signOut, rest, rpc, uploadLogo } from './api.js';
import { createMapPicker, zoneAt } from './map.js';
import { PARTNERS } from '../shared/config.js';

const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const STATUS = { pending: 'รออนุมัติ', approved: 'แสดงในเกม', paused: 'พักไว้', rejected: 'ส่งกลับ', draft: 'ร่าง' };
const KIND = { cafe: 'คาเฟ่', restaurant: 'ร้านอาหาร', shop: 'ร้านค้า', rental: 'ร้านเช่า', hotel: 'ที่พัก', other: 'อื่น ๆ' };
const ZONE = { beach: 'ถนนเลียบหาด', walking: 'ถนนคนเดิน', laemthaen: 'แหลมแท่น', ksm: 'เขาสามมุข', village: 'หมู่บ้านชาวประมง' };
const PKG = PARTNERS.prices;
let placements = [], partners = [], editing = null, picker = null;
const toast = (m, bad) => { const d = $('#toast'); d.textContent = m; d.className = bad ? 'bad on' : 'on'; setTimeout(() => d.classList.remove('on'), 2600); };
const fail = e => toast(e.message === 'login' ? 'หมดเวลา เข้าสู่ระบบใหม่' : 'ผิดพลาด: ' + e.message, true);

// ---------- login ----------
takeSessionFromHash();
function showLogin() { $('#login').hidden = false; $('#app').hidden = true; }
function showApp() { $('#login').hidden = true; $('#app').hidden = false; $('#who').textContent = me(); load(); }
$('#f-login').addEventListener('submit', async e => {
  e.preventDefault();
  const email = $('#email').value.trim(), code = $('#code').value.trim();
  try {
    if (code) { await verifyCode(email, code); showApp(); }
    else { await sendMagicLink(email); $('#login-msg').textContent = 'ส่งลิงก์ไปที่อีเมลแล้ว กดลิงก์ในอีเมล (หรือพิมพ์รหัส 6 หลักถ้ามี)'; }
  } catch (err) { $('#login-msg').textContent = 'ส่งไม่ได้: ' + err.message; }
});
$('#logout').addEventListener('click', () => { signOut(); showLogin(); });

// ---------- tabs ----------
$$('nav button').forEach(b => b.addEventListener('click', () => show(b.dataset.tab)));
function show(tab) { $$('nav button').forEach(b => b.classList.toggle('on', b.dataset.tab === tab)); $$('section[data-tab]').forEach(s => { s.hidden = s.dataset.tab !== tab; }); if (tab === 'stats') loadStats(); if (tab === 'edit' && !picker) picker = createMapPicker($('#map'), { onPick: (x, z) => { $('#p-x').value = x; $('#p-z').value = z; $('#p-zone').value = zoneAt(x, z); syncPicker(); } }); if (tab === 'edit') setTimeout(() => { picker?.setDots(placements.map(p => ({ x: +p.x, z: +p.z, name: p.name, color: p.color }))); syncPicker(); }, 0); }
const syncPicker = () => picker?.setCurrent($('#p-x').value ? { x: +$('#p-x').value, z: +$('#p-z').value, yaw: +$('#p-yaw').value } : null);

// ---------- data ----------
async function load() {
  try {
    [partners, placements] = await Promise.all([rest('partners?select=*&order=name'), rest('placements?select=*,partners(name,phone,line_id)&order=created_at.desc')]);
    renderList(); renderQueue(); fillPartnerSelect();
    $('#n-pending').textContent = placements.filter(p => p.status === 'pending').length || '';
  } catch (e) { if (e.message === 'login') showLogin(); else fail(e); }
}
function renderList() {
  const f = $('#filter').value;
  $('#list').innerHTML = placements.filter(p => !f || p.status === f).map(p => `
    <div class="row" data-id="${p.id}">
      <span class="sw" style="background:${esc(p.color)}"></span>
      <div class="grow"><b>${esc(p.name)}</b> <small>${KIND[p.kind] || p.kind} · ${ZONE[p.zone] || p.zone} · ${PKG[p.package]?.th || p.package}</small><br><small>${esc(p.partners?.name || '')}${p.coupon_enabled ? ' · 🎟️ ' + esc(p.coupon_text || '') : ''}</small></div>
      <span class="pill ${p.status}">${STATUS[p.status]}</span>
      <button data-act="edit">แก้ไข</button>
      ${p.status === 'approved' ? '<button data-act="paused">พัก</button>' : p.status !== 'pending' ? '<button data-act="approved">แสดง</button>' : ''}
    </div>`).join('') || '<p class="empty">ยังไม่มีร้าน กด "เพิ่มร้าน" เพื่อเริ่ม</p>';
}
$('#filter').addEventListener('change', renderList);
$('#list').addEventListener('click', e => {
  const b = e.target.closest('button'), row = e.target.closest('.row'); if (!b || !row) return;
  const p = placements.find(x => x.id === row.dataset.id);
  if (b.dataset.act === 'edit') edit(p); else setStatus(p, b.dataset.act);
});
async function setStatus(p, status, note = null) {
  try { await rest(`placements?id=eq.${p.id}`, { method: 'PATCH', body: { status, review_note: note, updated_at: new Date().toISOString() } }); await audit('status', p.id, { status, note }); toast(`${p.name}: ${STATUS[status]}`); load(); } catch (e) { fail(e); }
}
const audit = (what, target, detail) => rest('audit', { method: 'POST', body: { who: me(), what, target, detail }, prefer: 'return=minimal' }).catch(() => {});

// ---------- approval queue ----------
function renderQueue() {
  const q = placements.filter(p => p.status === 'pending');
  $('#queue').innerHTML = q.map(p => `
    <div class="card" data-id="${p.id}">
      <div class="hd"><span class="sw" style="background:${esc(p.color)}"></span><b>${esc(p.name)}</b> <small>${esc(p.name_en || '')} · ${KIND[p.kind]} · ${ZONE[p.zone]} · ${PKG[p.package]?.th}</small></div>
      ${p.logo_url ? `<img class="logo" src="${esc(p.logo_url)}" alt="">` : ''}
      <div class="kv"><span>ตำแหน่ง</span><span>${p.x}, ${p.z}</span><span>เวลาเปิด</span><span>${esc(p.hours || '-')}</span><span>คูปอง</span><span>${p.coupon_enabled ? esc(p.coupon_text) + ` (วันละ ${p.coupon_cap_day})` : 'ไม่มี'}</span><span>บทพูด</span><span>${[p.line1, p.line2, p.line3].filter(Boolean).map(esc).join(' / ') || '-'}</span></div>
      <p class="check">เช็กก่อนอนุมัติ: ชื่อและโลโก้เป็นของร้านจริง · ไม่มีเหล้า บุหรี่ การพนัน เงินกู้ · ข้อความเหมาะกับเด็ก · ตำแหน่งตรงกับร้านจริง</p>
      <div class="acts"><button data-act="approved" class="ok">อนุมัติ · แสดงในเกม</button><input placeholder="เหตุผลที่ส่งกลับ (ถ้ามี)"><button data-act="rejected">ส่งกลับ</button><button data-act="edit">แก้ไข</button></div>
    </div>`).join('') || '<p class="empty">ไม่มีร้านรออนุมัติ</p>';
}
$('#queue').addEventListener('click', e => {
  const b = e.target.closest('button'), card = e.target.closest('.card'); if (!b || !card) return;
  const p = placements.find(x => x.id === card.dataset.id);
  if (b.dataset.act === 'edit') edit(p); else setStatus(p, b.dataset.act, card.querySelector('input').value || null);
});

// ---------- add / edit ----------
function fillPartnerSelect() { $('#p-partner').innerHTML = '<option value="">+ ร้านใหม่ (กรอกชื่อด้านล่าง)</option>' + partners.map(x => `<option value="${x.id}">${esc(x.name)}</option>`).join(''); }
$('#add').addEventListener('click', () => edit(null));
function edit(p) {
  editing = p;
  const f = $('#f-edit'); f.reset();
  $('#edit-title').textContent = p ? `แก้ไข: ${p.name}` : 'เพิ่มร้านพันธมิตร';
  if (p) for (const k of ['name', 'name_en', 'kind', 'zone', 'x', 'z', 'yaw', 'color', 'hours', 'line1', 'line2', 'line3', 'package', 'coupon_text', 'coupon_cap_day', 'starts_on', 'ends_on']) { const el = $(`#p-${k}`); if (el && p[k] != null) el.value = p[k]; }
  $('#p-partner').value = p?.partner_id || ''; $('#p-coupon').checked = !!p?.coupon_enabled; $('#p-logo-now').src = p?.logo_url || ''; $('#p-logo-now').hidden = !p?.logo_url;
  $('#p-color').value = p?.color || '#d8743a'; $('#p-yaw').value = p?.yaw ?? 0;
  show('edit');
}
$('#p-yaw').addEventListener('input', syncPicker);
$('#f-edit').addEventListener('submit', async e => {
  e.preventDefault();
  const v = k => $(`#p-${k}`).value.trim() || null;
  if (!v('x') || !v('z')) return toast('คลิกตำแหน่งร้านบนแผนที่ก่อน', true);
  try {
    let partner_id = $('#p-partner').value;
    if (!partner_id) { const nm = v('partner_name') || v('name'); const [row] = await rest('partners', { method: 'POST', body: { name: nm, phone: v('partner_phone'), line_id: v('partner_line'), owner_email: v('partner_email') } }); partner_id = row.id; }
    const body = { partner_id, name: v('name'), name_en: v('name_en'), kind: v('kind'), zone: v('zone'), x: +v('x'), z: +v('z'), yaw: +v('yaw') || 0, color: v('color'), hours: v('hours'), line1: v('line1'), line2: v('line2'), line3: v('line3'), package: v('package'), coupon_enabled: $('#p-coupon').checked, coupon_text: v('coupon_text'), coupon_cap_day: +v('coupon_cap_day') || 20, starts_on: v('starts_on'), ends_on: v('ends_on'), updated_at: new Date().toISOString() };
    let row;
    if (editing) [row] = await rest(`placements?id=eq.${editing.id}`, { method: 'PATCH', body });
    else [row] = await rest('placements', { method: 'POST', body: { ...body, status: 'pending' } });
    const file = $('#p-logo').files[0];
    if (file) { const url = await uploadLogo(file, row.id); await rest(`placements?id=eq.${row.id}`, { method: 'PATCH', body: { logo_url: url }, prefer: 'return=minimal' }); }
    await audit(editing ? 'edit' : 'create', row.id, { name: body.name });
    toast(editing ? 'บันทึกแล้ว' : 'เพิ่มร้านแล้ว อยู่ในคิวรออนุมัติ'); editing = null; await load(); show(editing ? 'edit' : 'queue');
  } catch (err) { fail(err); }
});
$('#p-partner').addEventListener('change', () => { $('#new-partner').hidden = !!$('#p-partner').value; });

// ---------- coupons ----------
$('#f-redeem').addEventListener('submit', async e => {
  e.preventDefault();
  const code = $('#r-code').value.replace(/\D/g, ''), out = $('#r-out');
  if (code.length !== 6) { out.textContent = 'รหัสต้องมี 6 หลัก'; out.className = 'bad'; return; }
  try {
    const [r] = await rpc('redeem_coupon', { p_code: code });
    const why = { unknown: 'ไม่พบรหัสนี้ หรือใช้ไปแล้ว', expired: 'หมดอายุแล้ว', 'not yours': 'คูปองของร้านอื่น', login: 'ต้องเข้าสู่ระบบ' };
    out.textContent = r.ok ? `✓ ใช้ได้ · ${r.shop} · ${r.coupon_text || ''}` : `✗ ${why[r.reason] || r.reason}${r.shop ? ' · ' + r.shop : ''}`;
    out.className = r.ok ? 'ok' : 'bad'; if (r.ok) $('#r-code').value = '';
  } catch (err) { out.textContent = 'ผิดพลาด: ' + err.message; out.className = 'bad'; }
});

// ---------- stats & invoices ----------
async function loadStats() {
  try {
    const since = new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10), month = new Date().toISOString().slice(0, 7);
    const [visits, coupons, invoices] = await Promise.all([rest(`visits?select=placement_id,day,count&day=gte.${since}`), rest(`coupons?select=placement_id,status,issued_at&issued_at=gte.${since}`), rest('invoices?select=*,partners(name)&order=created_at.desc&limit=50')]);
    const by = {}; for (const p of placements) by[p.id] = { p, visits: 0, issued: 0, redeemed: 0, redeemedMonth: 0 };
    for (const v of visits) if (by[v.placement_id]) by[v.placement_id].visits += v.count;
    for (const c of coupons) { const b = by[c.placement_id]; if (!b) continue; b.issued++; if (c.status === 'redeemed') { b.redeemed++; if (c.issued_at.startsWith(month)) b.redeemedMonth++; } }
    $('#stats').innerHTML = `<table><thead><tr><th>ร้าน</th><th>แพ็กเกจ</th><th class="n">มาเยี่ยม 30 วัน</th><th class="n">คูปองออก</th><th class="n">ใช้จริง</th><th class="n">ค่าใช้จ่ายเดือนนี้</th><th></th></tr></thead><tbody>${Object.values(by).map(b => {
      const due = (b.p.status === 'approved' ? PKG[b.p.package].price : 0) + b.redeemedMonth * PKG.coupon.price;
      return `<tr data-id="${b.p.id}"><td>${esc(b.p.name)}<br><small>${esc(b.p.partners?.name || '')}</small></td><td>${PKG[b.p.package]?.th}</td><td class="n">${b.visits}</td><td class="n">${b.issued}</td><td class="n">${b.redeemed}</td><td class="n">฿${due.toLocaleString()}</td><td><button data-act="invoice" data-amount="${due}" data-month="${month}">ออกใบแจ้งหนี้</button></td></tr>`; }).join('')}</tbody></table>
      <h3>ใบแจ้งหนี้</h3>${invoices.map(i => `<div class="row"><div class="grow"><b>${esc(i.partners?.name)}</b> <small>${i.month.slice(0, 7)}</small></div><span class="n">฿${(+i.amount).toLocaleString()}</span><span class="pill ${i.status}">${{ due: 'ค้างชำระ', paid: 'จ่ายแล้ว', void: 'ยกเลิก' }[i.status]}</span>${i.status === 'due' ? `<button data-act="paid" data-id="${i.id}">รับเงินแล้ว</button>` : ''}</div>`).join('') || '<p class="empty">ยังไม่มีใบแจ้งหนี้</p>'}`;
  } catch (e) { fail(e); }
}
$('#stats').addEventListener('click', async e => {
  const b = e.target.closest('button'); if (!b) return;
  try {
    if (b.dataset.act === 'invoice') {
      const p = placements.find(x => x.id === b.closest('tr').dataset.id);
      await rest('invoices', { method: 'POST', body: { partner_id: p.partner_id, month: b.dataset.month + '-01', amount: +b.dataset.amount, lines: [{ placement: p.name, package: p.package, amount: +b.dataset.amount }] }, prefer: 'return=minimal' });
      toast(`ออกใบแจ้งหนี้ ${p.name} ฿${b.dataset.amount}`);
    } else if (b.dataset.act === 'paid') { await rest(`invoices?id=eq.${b.dataset.id}`, { method: 'PATCH', body: { status: 'paid', paid_at: new Date().toISOString() }, prefer: 'return=minimal' }); toast('บันทึกว่าจ่ายแล้ว'); }
    loadStats();
  } catch (err) { fail(err); }
});

// ---------- start ----------
$('#prices').innerHTML = Object.entries(PKG).map(([k, v]) => `<span class="pill">${v.th} ฿${v.price.toLocaleString()}${k === 'coupon' ? '/ใบ' : k === 'event' ? '/ครั้ง' : '/เดือน'}</span>`).join(' ');
const demoMode = new URLSearchParams(location.search).has('demo');          // preview the pages without a login
if (demoMode) { $('#login').hidden = true; $('#app').hidden = false; $('#who').textContent = 'ตัวอย่าง (ไม่ได้เข้าสู่ระบบ)'; renderList(); renderQueue(); fillPartnerSelect(); }
else if (signedIn()) showApp(); else showLogin();
show('list');
