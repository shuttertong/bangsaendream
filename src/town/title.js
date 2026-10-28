// Title card (first tap also unlocks audio on iOS) and the ending card.
import { t, tr } from '../shared/i18n.js';
import * as P from '../shared/progress.js';
import { GAME_VERSION } from '../shared/config.js';
import { dailyTasks } from '../shared/goals.js';
import { dayKey } from '../shared/wardrobe.js';
import { activeEvent } from '../shared/events.js';

/** status(): { online: players online now (−1: not connected), friends: [{ name, x, z }] } — polled while the card is up. */
export function showTitle(root, { onStart, status = null }) {
  const el = document.createElement('div');
  el.id = 'title';
  const returning = !!P.get().met.grandma, j = P.get().journal;
  const left = dailyTasks(dayKey()).filter(x => (j.day === dayKey() ? j.tasks[x.id] || 0 : 0) < x.n).length;   // (the journal has rolled the day already)
  const daily = returning ? [j.streak ? t('titleStreak', { n: j.streak }) : '', left ? t('titleDaily', { n: left }) : t('titleDailyDone')].filter(Boolean).join(' · ') : '';
  el.innerHTML = `
    <div class="t-card">
      <h1>${t('title')}</h1>
      <p class="t-sub">${t('titleSub')}</p>
      <button class="t-go">${returning ? t('titleContinue') : t('titlePlay')}</button>
      ${daily ? `<p class="t-daily">${daily}</p>` : ''}
      ${activeEvent() ? `<p class="t-event">${activeEvent().icon} ${tr(activeEvent().name)} · ${tr(activeEvent().line)}</p>` : ''}
      <p class="t-online"></p><button class="t-friend" hidden></button>
      <p class="t-hint">🔊 ${t('titleHint')}</p>
      <p class="t-ver">v${GAME_VERSION}</p>
    </div>`;
  root.appendChild(el);
  let goTo = null, poll = 0;
  const go = e => { e?.preventDefault(); e?.stopPropagation(); clearInterval(poll); el.classList.add('out'); setTimeout(() => el.remove(), 600); onStart?.(goTo); removeEventListener('keydown', key); };
  // who is on the beach right now, and a friend to go straight to
  const online = el.querySelector('.t-online'), friendBtn = el.querySelector('.t-friend');
  const refresh = () => {
    const st = status?.();
    if (!st) return;
    online.textContent = st.online < 0 ? t('titleOffline') : t('titleOnline', { n: st.online + 1 });
    const f = st.friends?.[0];
    friendBtn.hidden = !f;
    if (f) { friendBtn.textContent = t('titleGo', { name: f.name }) + (st.friends.length > 1 ? ` (+${st.friends.length - 1})` : ''); goTo = { x: f.x, z: f.z, name: f.name }; } else goTo = null;
  };
  if (status) { refresh(); poll = setInterval(refresh, 1500); }
  friendBtn.addEventListener('pointerdown', e => { if (goTo) go(e); });
  const key = e => { if (e.code === 'Enter' || e.code === 'Space') go(e); };
  el.querySelector('.t-go').addEventListener('pointerdown', go);
  addEventListener('keydown', key);
  return el;
}

export function showEnding(root, audio) {
  const s = P.get();
  const items = Object.values(s.bag).reduce((a, n) => a + n, 0);
  const plays = Object.values(s.best).reduce((a, b) => a + (b.plays || 0), 0);
  const el = document.createElement('div');
  el.id = 'ending';
  el.innerHTML = `
    <div class="t-card">
      <p class="e-sun">🌅</p>
      <h1>${t('endTitle')}</h1>
      <p class="t-sub">${t('endText')}</p>
      <p class="e-stats">${t('endStats', { baht: s.baht.toLocaleString(), items, plays })}</p>
      <button class="t-go">${t('keepPlaying')}</button>
    </div>`;
  root.appendChild(el);
  audio?.play('fanfare');
  el.querySelector('.t-go').addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); el.classList.add('out'); setTimeout(() => el.remove(), 600); });
}
