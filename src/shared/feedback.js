// 💌 Requests & feedback for the developer: a HUD button opens a small panel — pick what kind
// (idea / problem / something you like / a mini-game you want), write up to 500 characters,
// send. Messages go straight into a Supabase table that the public key can only add to.
// Kid-safe: no name / email / phone fields, and a reminder not to type them; a short cooldown.
import { t, onLang, getLang } from './i18n.js';
import { FEEDBACK, GAME_VERSION } from './config.js';

const COOL_KEY = 'bangsaen.feedback.last';

/** ctx: { root (#hud), audio, place() → nearest place id or '' } */
export function createFeedback({ root, audio, place = () => '' }) {
  const F = FEEDBACK;
  if (!F.key) return { open() {}, close() {} };                  // not configured yet: no button
  let kind = F.kinds[0].id, sending = false;

  const btn = document.createElement('button');
  btn.className = 'b-feedback';
  btn.innerHTML = '💌<span></span>';
  const btns = root.querySelector('#ui .btns');
  btns?.insertBefore(btn, btns.querySelector('.b-info'));

  const modal = document.createElement('div');
  modal.className = 'modal fb-panel';
  modal.innerHTML = `<div class="panel">
      <h2></h2><p class="fb-lead"></p>
      <div class="fb-kinds">${F.kinds.map(k => `<button data-k="${k.id}">${k.icon} <span></span></button>`).join('')}</div>
      <textarea maxlength="${F.max}" rows="5"></textarea>
      <div class="fb-row"><span class="fb-safe"></span><span class="fb-count"></span></div>
      <div class="fb-msg"></div>
      <div class="fb-actions"><button class="fb-send"></button><button class="close"></button></div>
    </div>`;
  root.appendChild(modal);
  const $ = q => modal.querySelector(q), text = $('textarea'), msg = $('.fb-msg'), send = $('.fb-send');
  const stop = fn => e => { e.stopPropagation(); fn(e); };

  btn.addEventListener('pointerdown', stop(e => { e.preventDefault(); audio?.play('click'); open(); }));
  $('.close').addEventListener('click', stop(() => close()));
  modal.addEventListener('pointerdown', e => { if (e.target === modal) close(); });
  for (const b of modal.querySelectorAll('.fb-kinds button')) b.addEventListener('click', stop(() => { kind = b.dataset.k; refresh(); }));
  text.addEventListener('input', () => refresh());
  text.addEventListener('keydown', e => e.stopPropagation());       // typing must not walk the kid or open menus
  send.addEventListener('click', stop(() => submit()));

  function refresh() {
    btn.querySelector('span').textContent = t('feedback');
    btn.setAttribute('aria-label', t('feedback'));
    $('h2').textContent = t('feedbackTitle');
    $('.fb-lead').textContent = t('feedbackLead');
    for (const b of modal.querySelectorAll('.fb-kinds button')) {
      b.querySelector('span').textContent = t(`feedbackKind_${b.dataset.k}`);
      b.classList.toggle('on', b.dataset.k === kind);
    }
    text.placeholder = t(`feedbackHint_${kind}`);
    $('.fb-safe').textContent = t('feedbackSafe');
    $('.fb-count').textContent = `${text.value.length}/${F.max}`;
    send.textContent = sending ? t('feedbackSending') : t('feedbackSend');
    send.disabled = sending || text.value.trim().length < F.min;
    $('.close').textContent = t('close');
  }
  onLang(refresh);
  refresh();

  function open() { msg.textContent = ''; msg.className = 'fb-msg'; modal.classList.add('on'); refresh(); setTimeout(() => text.focus(), 50); }
  function close() { modal.classList.remove('on'); text.blur(); }
  const say = (key, ok) => { msg.textContent = t(key, { n: F.cooldown }); msg.className = `fb-msg ${ok ? 'ok' : 'err'}`; };

  async function submit() {
    const message = text.value.trim();
    if (sending || message.length < F.min) return;
    let last = 0;
    try { last = +localStorage.getItem(COOL_KEY) || 0; } catch { /* storage blocked */ }
    if (Date.now() - last < F.cooldown * 1000) { say('feedbackWait', false); return; }
    sending = true; refresh();
    const w = Math.min(screen.width, screen.height);
    const body = {
      kind, message: message.slice(0, F.max), lang: getLang(),
      device: matchMedia('(pointer: coarse)').matches ? (w >= 700 ? 'tablet' : 'phone') : 'desktop',
      place: String(place() || '').slice(0, 40), version: GAME_VERSION,
    };
    const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), F.timeout * 1000);
    try {
      const r = await fetch(F.url, {
        method: 'POST', signal: ctl.signal,
        headers: { apikey: F.key, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      try { localStorage.setItem(COOL_KEY, String(Date.now())); } catch { /* storage blocked */ }
      text.value = '';
      say('feedbackThanks', true);
      audio?.play('coin');
    } catch (e) {
      console.warn('feedback not sent:', e.message);
      say('feedbackFail', false);
    } finally {
      clearTimeout(timer); sending = false; refresh();
    }
  }

  return { open, close };
}
