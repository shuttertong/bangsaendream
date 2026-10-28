// โปสการ์ดจากบางแสน — the 📷 button: a snapshot of the game in a postcard frame (the title, where
// you are, the date, your journal title) to save or share. The frame is drawn on a 2D canvas over
// the WebGL frame; nothing leaves the device unless the player chooses to share it.
import { t, tr, getLang } from '../shared/i18n.js';
import * as P from '../shared/progress.js';
import { titleFor } from '../shared/goals.js';

const CARD = { max: 1280, border: 34, band: 112, paper: '#fbf6ea', ink: '#4a3a2a', accent: '#d46a2a', stampW: 150 };

export function createPostcard({ root, renderer, render, hub, audio, journal }) {
  const stop = fn => e => { e.stopPropagation(); e.preventDefault(); fn(); };
  let open = false, canvas = null;

  const btn = document.createElement('button');
  btn.className = 'b-photo';
  btn.innerHTML = '📷<span></span>';
  const btns = root.querySelector('#ui .btns');
  btns?.insertBefore(btn, btns.querySelector('.b-info'));
  const modal = document.createElement('div');
  modal.className = 'modal pc-panel';
  modal.innerHTML = `<div class="panel"><h2></h2><img class="pc-img" alt=""><div class="pc-btns"><button class="pc-save"></button><button class="pc-share"></button><button class="close"></button></div></div>`;
  root.appendChild(modal);
  const $ = q => modal.querySelector(q);
  btn.addEventListener('pointerdown', stop(() => { if (!hub.frozen) snap(); }));
  $('.close').addEventListener('pointerdown', stop(() => toggle(false)));
  modal.addEventListener('pointerdown', e => { if (e.target === modal) toggle(false); });
  $('.pc-save').addEventListener('pointerdown', stop(save));
  $('.pc-share').addEventListener('pointerdown', stop(share));
  addEventListener('keydown', e => { if (e.code === 'Escape' && open) toggle(false); });
  function toggle(on) { open = on; modal.classList.toggle('on', on); }
  function labels() {
    btn.querySelector('span').textContent = t('photo');
    btn.setAttribute('aria-label', t('photo'));
    $('h2').textContent = t('pcTitle'); $('.pc-save').textContent = t('pcSave'); $('.pc-share').textContent = t('pcShare'); $('.close').textContent = t('close');
    $('.pc-share').hidden = !(navigator.canShare && navigator.share);
  }

  /** Where the kid is, as the nearest named place. */
  function placeName() {
    const p = hub.places, k = Object.values(p).reduce((best, q) => { const d = Math.hypot(q.x - X(), q.z - Z()); return !best || d < best.d ? { q, d } : best; }, null);
    return k ? tr(k.q.name) : '';
  }
  const X = () => renderer.__kid?.x ?? 0, Z = () => renderer.__kid?.z ?? 0;

  /** Draw the frame: paper border, the picture, a stamp and a postmark, a caption band. */
  function snap() {
    audio?.play('click');
    render();                                                          // a fresh frame, read back in the same task (no preserved buffer needed)
    const src = renderer.domElement, k = Math.min(1, CARD.max / src.width), pw = Math.round(src.width * k), ph = Math.round(src.height * k);
    const B = CARD.border, W = pw + B * 2, H = ph + B * 2 + CARD.band, th = getLang() === 'th';
    canvas = document.createElement('canvas'); canvas.width = W; canvas.height = H;
    const c = canvas.getContext('2d');
    c.fillStyle = CARD.paper; c.fillRect(0, 0, W, H);
    c.drawImage(src, B, B, pw, ph);
    c.strokeStyle = '#e6dcc8'; c.lineWidth = 2; c.strokeRect(B - 1, B - 1, pw + 2, ph + 2);
    // caption band
    const y = B + ph + 14;
    c.fillStyle = CARD.ink; c.font = `600 ${Math.round(W * 0.034)}px Kanit, sans-serif`; c.textBaseline = 'top';
    c.fillText(t('title'), B + 6, y);
    c.fillStyle = CARD.accent; c.font = `500 ${Math.round(W * 0.02)}px Kanit, sans-serif`;
    c.fillText(t('pcFrom', { place: placeName() }), B + 6, y + Math.round(W * 0.044));
    const badges = Object.keys(P.get().journal.badges).length;
    c.fillStyle = '#8a7a66'; c.font = `400 ${Math.round(W * 0.017)}px Sarabun, sans-serif`;
    c.fillText(`${new Date().toLocaleDateString(th ? 'th-TH' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' })} · 👑 ${tr(titleFor(badges))}`, B + 6, y + Math.round(W * 0.072));
    // stamp (top right) and a postmark over its corner
    const sw = Math.round(W * 0.11), sh = Math.round(sw * 1.2), sx = W - B - sw - 8, sy = B + 8;
    c.fillStyle = '#fff'; c.fillRect(sx - 4, sy - 4, sw + 8, sh + 8);
    c.fillStyle = '#4fb3a8'; c.fillRect(sx, sy, sw, sh);
    c.fillStyle = '#2f78c8'; c.fillRect(sx, sy, sw, sh * 0.55);
    c.fillStyle = '#f1c53a'; c.beginPath(); c.arc(sx + sw * 0.72, sy + sh * 0.3, sw * 0.13, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#eee2c6'; c.fillRect(sx, sy + sh * 0.72, sw, sh * 0.28);
    c.fillStyle = '#4a3a2a'; c.font = `600 ${Math.round(sw * 0.17)}px Kanit, sans-serif`; c.textAlign = 'center';
    c.fillText(th ? 'บางแสน' : 'BANG SAEN', sx + sw / 2, sy + sh * 0.76); c.textAlign = 'left';
    c.strokeStyle = 'rgba(74,58,42,.55)'; c.lineWidth = 3; c.beginPath(); c.arc(sx - 6, sy + sh + 4, sw * 0.42, 0, Math.PI * 2); c.stroke();
    c.beginPath(); c.arc(sx - 6, sy + sh + 4, sw * 0.3, 0, Math.PI * 2); c.stroke();
    for (let i = 0; i < 4; i++) { c.beginPath(); c.moveTo(sx + sw * 0.4, sy + sh + 4 - 12 + i * 8); c.lineTo(sx + sw * 0.85, sy + sh + 4 - 12 + i * 8); c.stroke(); }
    $('.pc-img').src = canvas.toDataURL('image/jpeg', 0.9);
    labels();
    toggle(true);
    journal?.event('photo');
  }
  const fileName = () => `bangsaen-${new Date().toISOString().slice(0, 10)}.jpg`;
  function save() {
    if (!canvas) return;
    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/jpeg', 0.9); a.download = fileName();
    a.click();
    audio?.play('coin');
  }
  async function share() {
    if (!canvas) return;
    const blob = await new Promise(r => canvas.toBlob(r, 'image/jpeg', 0.9)), file = new File([blob], fileName(), { type: 'image/jpeg' });
    try { if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title: t('title') }); else save(); } catch { /* the player closed the share sheet */ }
  }
  labels();
  return { get open() { return open; }, labels, /** main.js: where the kid is (for the caption). */ set kid(p) { renderer.__kid = p; } };
}
